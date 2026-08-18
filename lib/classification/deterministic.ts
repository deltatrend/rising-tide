/**
 * Deterministic water-relevance classifier.
 *
 * No AI service, no network, no API key — the same input always produces the
 * same output, which is what makes the methodology page honest and the tests
 * meaningful.
 *
 * The pipeline for each field (title, description, subjects, committee, text):
 *   1. normalize the text
 *   2. mask idiomatic decoys ("watershed moment") so they cannot match
 *   3. find every taxonomy phrase, longest phrase first, consuming characters
 *      so "water" cannot also score inside "drinking water"
 *   4. award points = tier weight x field multiplier x repetition factor
 *
 * Raw points are then damped through 1 - e^(-raw/k) to a 0-100 score, so the
 * first strong signal matters enormously and the twentieth barely moves it.
 */

import {
  CLASSIFIER_VERSION,
  DECOY_PHRASES,
  DILUTION_TITLE_PATTERNS,
  FIELD_MULTIPLIERS,
  NY_WATER_BODIES,
  SCORING,
  TIER_WEIGHTS,
  WATER_BODY_WEIGHT,
  WATER_CONCEPTS,
  WATER_RELEVANT_COMMITTEES,
  type ConceptTier,
  type EvidenceField,
} from '@/config/water-taxonomy';
import type {
  ClassifiableBill,
  ClassificationProvider,
  RelevanceEvidence,
  WaterRelevanceResult,
} from './types';

/* ------------------------------------------------------------------------- */
/* Phrase index                                                               */
/* ------------------------------------------------------------------------- */

interface IndexedTerm {
  term: string;
  regex: RegExp;
  conceptId: string;
  label: string;
  tier: ConceptTier | 'waterbody';
  topics: string[];
  weight: number;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Boundaries are lookarounds rather than \b so phrases containing punctuation
 * ("1,4-dioxane", "st. lawrence river") still behave.
 */
function buildTermRegex(term: string): RegExp {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, 'g');
}

function buildIndex(): IndexedTerm[] {
  const index: IndexedTerm[] = [];

  for (const concept of WATER_CONCEPTS) {
    for (const term of concept.terms) {
      index.push({
        term,
        regex: buildTermRegex(term),
        conceptId: concept.id,
        label: concept.label,
        tier: concept.tier,
        topics: [...concept.topics],
        weight: TIER_WEIGHTS[concept.tier],
      });
    }
  }

  for (const body of NY_WATER_BODIES) {
    for (const term of body.terms) {
      index.push({
        term,
        regex: buildTermRegex(term),
        conceptId: body.id,
        label: body.label,
        tier: 'waterbody',
        topics: [...body.topics],
        weight: WATER_BODY_WEIGHT,
      });
    }
  }

  // Longest phrases win the character range, so specific beats generic.
  return index.sort((a, b) => b.term.length - a.term.length);
}

const TERM_INDEX = buildIndex();

/* ------------------------------------------------------------------------- */
/* Text preparation                                                           */
/* ------------------------------------------------------------------------- */

export function normalizeForMatching(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Replaces decoy phrases with same-length filler so offsets stay valid. */
export function maskDecoys(text: string): { masked: string; decoys: string[] } {
  let masked = text;
  const found: string[] = [];

  for (const phrase of DECOY_PHRASES) {
    const regex = buildTermRegex(phrase);
    masked = masked.replace(regex, (match) => {
      found.push(phrase);
      return '\u0000'.repeat(match.length);
    });
  }

  return { masked, decoys: found };
}

/* ------------------------------------------------------------------------- */
/* Field scanning                                                             */
/* ------------------------------------------------------------------------- */

interface FieldMatch {
  conceptId: string;
  label: string;
  tier: ConceptTier | 'waterbody';
  topics: string[];
  weight: number;
  matches: string[];
  occurrences: number;
}

function scanField(rawText: string): { matches: Map<string, FieldMatch>; decoys: string[] } {
  const normalized = normalizeForMatching(rawText);
  const { masked, decoys } = maskDecoys(normalized);
  const consumed = new Array<boolean>(masked.length).fill(false);
  const byConcept = new Map<string, FieldMatch>();

  for (const entry of TERM_INDEX) {
    entry.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = entry.regex.exec(masked)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      let overlaps = false;
      for (let i = start; i < end; i += 1) {
        if (consumed[i]) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      for (let i = start; i < end; i += 1) consumed[i] = true;

      const existing = byConcept.get(entry.conceptId);
      if (existing) {
        existing.occurrences += 1;
        if (!existing.matches.includes(entry.term)) existing.matches.push(entry.term);
      } else {
        byConcept.set(entry.conceptId, {
          conceptId: entry.conceptId,
          label: entry.label,
          tier: entry.tier,
          topics: entry.topics,
          weight: entry.weight,
          matches: [entry.term],
          occurrences: 1,
        });
      }
    }
  }

  return { matches: byConcept, decoys };
}

function repetitionFactor(field: EvidenceField, occurrences: number): number {
  if (field === 'text') {
    return Math.min(SCORING.repeatBonusCap, 0.5 + occurrences * SCORING.repeatBonusPerMatch);
  }
  return Math.min(
    SCORING.repeatBonusCap,
    1 + (occurrences - 1) * SCORING.repeatBonusPerMatch,
  );
}

/* ------------------------------------------------------------------------- */
/* Classification                                                             */
/* ------------------------------------------------------------------------- */

export function classifyWaterRelevance(bill: ClassifiableBill): WaterRelevanceResult {
  const evidence: RelevanceEvidence[] = [];
  const penalties: string[] = [];
  const decoysSeen = new Set<string>();

  const fields: { field: EvidenceField; value: string | null | undefined }[] = [
    { field: 'title', value: bill.title },
    { field: 'description', value: bill.description },
    { field: 'subjects', value: bill.subjects?.length ? bill.subjects.join(' . ') : null },
    { field: 'committee', value: bill.committeeName },
    { field: 'text', value: bill.text },
  ];

  for (const { field, value } of fields) {
    if (!value || !value.trim()) continue;

    // The committee field only counts when it is a committee that plausibly
    // handles water policy; "Rules" tells us nothing about subject matter.
    if (field === 'committee') {
      const name = value.toLowerCase();
      const plausible = WATER_RELEVANT_COMMITTEES.some((c) => name.includes(c));
      if (!plausible) continue;
    }

    const { matches, decoys } = scanField(value);
    decoys.forEach((d) => decoysSeen.add(d));

    for (const m of matches.values()) {
      if (field === 'text') {
        const minimum =
          m.tier === 'generic' ? SCORING.minGenericTextOccurrences : SCORING.minTextOccurrences;
        if (m.occurrences < minimum) continue;
      }

      const points =
        m.weight * FIELD_MULTIPLIERS[field] * repetitionFactor(field, m.occurrences);

      evidence.push({
        conceptId: m.conceptId,
        label: m.label,
        field,
        tier: m.tier,
        matches: m.matches,
        occurrences: m.occurrences,
        points: Math.round(points * 100) / 100,
        topics: m.topics,
      });
    }
  }

  // A committee alone is context, never proof.
  const substantiveEvidence = evidence.filter((e) => e.field !== 'committee');
  const hasNonGeneric = substantiveEvidence.some((e) => e.tier !== 'generic');
  const hasStrongSignal = evidence.some(
    (e) =>
      (e.tier === 'core' || e.tier === 'strong' || e.tier === 'waterbody') &&
      (e.field === 'title' || e.field === 'description' || e.field === 'subjects'),
  );

  let raw = evidence.reduce((sum, e) => sum + e.points, 0);

  if (
    !hasStrongSignal &&
    DILUTION_TITLE_PATTERNS.some((pattern) => pattern.test(bill.title))
  ) {
    raw *= SCORING.dilutionPenalty;
    penalties.push(
      'Down-weighted: water language appears only incidentally inside a budget or omnibus vehicle.',
    );
  }

  const bodyLength = (bill.description?.length ?? 0) + (bill.text?.length ?? 0);
  if (!hasNonGeneric && bodyLength > 4000) {
    raw *= SCORING.dilutionPenalty;
    penalties.push(
      'Down-weighted: only generic water words in a long document with no specific water-policy language.',
    );
  }

  if (decoysSeen.size > 0) {
    penalties.push(
      `Ignored figurative language: ${[...decoysSeen].slice(0, 3).join(', ')}.`,
    );
  }

  const score = Math.round(100 * (1 - Math.exp(-raw / SCORING.normalizationConstant)));
  const relevant = score >= SCORING.relevanceThreshold && hasNonGeneric;

  evidence.sort((a, b) => b.points - a.points);

  const topics = assignTopics(evidence);
  const reason = buildReason({ relevant, evidence, topics });

  return {
    relevant,
    score,
    topics,
    evidence,
    reason,
    classifierVersion: CLASSIFIER_VERSION,
    provider: 'deterministic',
    rawScore: Math.round(raw * 100) / 100,
    penalties,
  };
}

/* ------------------------------------------------------------------------- */
/* Topic assignment                                                           */
/* ------------------------------------------------------------------------- */

export function scoreTopics(evidence: RelevanceEvidence[]): Map<string, number> {
  const scores = new Map<string, number>();

  for (const item of evidence) {
    for (const slug of item.topics) {
      scores.set(slug, (scores.get(slug) ?? 0) + item.points);
    }
  }

  return scores;
}

function assignTopics(evidence: RelevanceEvidence[]): string[] {
  const scores = scoreTopics(evidence);

  return [...scores.entries()]
    .filter(([, score]) => score >= SCORING.topicAssignmentThreshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SCORING.maxTopicsPerBill)
    .map(([slug]) => slug);
}

/* ------------------------------------------------------------------------- */
/* Explanation                                                                */
/* ------------------------------------------------------------------------- */

const FIELD_PHRASES: Record<EvidenceField, string> = {
  title: 'its title refers to',
  description: 'its official description discusses',
  subjects: 'New York files it under official subjects covering',
  committee: 'it sits with a committee that handles',
  text: 'the bill text repeatedly discusses',
};

function joinLabels(labels: string[]): string {
  const unique = [...new Set(labels)];
  if (unique.length === 1) return unique[0]!;
  if (unique.length === 2) return `${unique[0]} and ${unique[1]}`;
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

/**
 * Produces one restrained sentence. Visitors see this; they never see raw
 * weights, which belong on the methodology page instead.
 */
export function buildReason(input: {
  relevant: boolean;
  evidence: RelevanceEvidence[];
  topics: string[];
}): string {
  const { relevant, evidence } = input;

  if (evidence.length === 0) {
    return 'No water-policy language was found in the official title, description or subjects.';
  }

  if (!relevant) {
    const labels = joinLabels(evidence.slice(0, 2).map((e) => e.label));
    return `Not tracked: references to ${labels} appear to be incidental rather than the subject of the bill.`;
  }

  const meaningful = evidence.filter((e) => e.tier !== 'generic');
  const source = meaningful.length > 0 ? meaningful : evidence;

  // New York descriptions frequently restate the title, so a concept is
  // attributed to the single strongest place it appears and never repeated.
  const claimed = new Set<string>();
  const byField = new Map<EvidenceField, string[]>();

  for (const item of source) {
    if (claimed.has(item.label)) continue;
    const list = byField.get(item.field) ?? [];
    if (list.length >= 3) continue;
    list.push(item.label);
    claimed.add(item.label);
    byField.set(item.field, list);
  }

  const order: EvidenceField[] = ['title', 'description', 'subjects', 'text', 'committee'];
  const clauses: string[] = [];

  for (const field of order) {
    const labels = byField.get(field);
    if (!labels || labels.length === 0) continue;
    clauses.push(`${FIELD_PHRASES[field]} ${joinLabels(labels)}`);
    if (clauses.length === 2) break;
  }

  if (clauses.length === 0) {
    return `Tracked because it concerns ${joinLabels(source.slice(0, 2).map((e) => e.label))}.`;
  }

  return `Tracked because ${clauses.join(', and ')}.`;
}

/* ------------------------------------------------------------------------- */
/* Cheap pre-screen used before spending a getBill query                      */
/* ------------------------------------------------------------------------- */

export interface PrescreenResult {
  passes: boolean;
  rawScore: number;
  score: number;
}

/**
 * Search results give us a title but no description, so this decides whether a
 * candidate is worth one LegiScan detail query. It is intentionally generous —
 * a false positive costs one query, a false negative loses a bill entirely.
 */
export function prescreenCandidate(title: string, extraText?: string | null): PrescreenResult {
  const result = classifyWaterRelevance({ title, description: extraText ?? null });
  return {
    passes: result.rawScore >= SCORING.prescreenThreshold,
    rawScore: result.rawScore,
    score: result.score,
  };
}

/* ------------------------------------------------------------------------- */
/* Provider wrapper                                                           */
/* ------------------------------------------------------------------------- */

export const deterministicProvider: ClassificationProvider = {
  name: 'deterministic',
  version: CLASSIFIER_VERSION,
  available: true,
  async classify(bill: ClassifiableBill): Promise<WaterRelevanceResult> {
    return classifyWaterRelevance(bill);
  },
};
