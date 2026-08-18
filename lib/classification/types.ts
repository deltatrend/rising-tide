import type { ConceptTier, EvidenceField } from '@/config/water-taxonomy';

/** A single reason the classifier believes a bill relates to water policy. */
export interface RelevanceEvidence {
  /** Concept or waterbody id from config/water-taxonomy.ts. */
  conceptId: string;
  /** Reader-facing phrasing, e.g. "drinking water". */
  label: string;
  field: EvidenceField;
  tier: ConceptTier | 'waterbody';
  /** The exact phrases that matched, for transparency. */
  matches: string[];
  occurrences: number;
  /** Raw points contributed before normalization. */
  points: number;
  topics: string[];
}

export interface WaterRelevanceResult {
  relevant: boolean;
  /** 0-100. */
  score: number;
  topics: string[];
  evidence: RelevanceEvidence[];
  /** One restrained sentence suitable for showing to visitors. */
  reason: string;
  classifierVersion: string;
  provider: string;
  /** Unnormalized points, useful for pre-screening and debugging. */
  rawScore: number;
  /** Human-readable notes about down-weighting that was applied. */
  penalties: string[];
}

/** The minimum a provider needs in order to judge a bill. */
export interface ClassifiableBill {
  billNumber?: string | null;
  title: string;
  description?: string | null;
  /** Official LegiScan subject names. */
  subjects?: string[] | null;
  /** Current or pending committee name. */
  committeeName?: string | null;
  /** Optional extracted bill text. Never required. */
  text?: string | null;
}

/**
 * Classification is provider-based so a future semantic classifier can be added
 * without touching the synchronization pipeline or the database schema.
 */
export interface ClassificationProvider {
  readonly name: string;
  readonly version: string;
  readonly available: boolean;
  classify(bill: ClassifiableBill): Promise<WaterRelevanceResult>;
}

export interface TopicScore {
  slug: string;
  score: number;
}
