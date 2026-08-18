import { describe, expect, it } from 'vitest';

import { classifyWaterRelevance, prescreenCandidate } from '@/lib/classification/deterministic';
import { resolveTracking } from '@/lib/classification';
import { SCORING } from '@/config/water-taxonomy';
import { getTopicDefinition } from '@/config/topics';
import { fixtureBills } from '@/lib/fixtures/legiscan';

function classifyFixture(billNumber: string) {
  const bill = fixtureBills().find((b) => b.bill_number === billNumber);
  if (!bill) throw new Error(`No fixture named ${billNumber}`);

  return classifyWaterRelevance({
    billNumber: bill.bill_number,
    title: bill.title,
    description: bill.description,
    subjects: bill.subjects.filter((s) => s.subject_name).map((s) => s.subject_name!),
  });
}

describe('water relevance classifier', () => {
  it('tracks a bill whose title is unambiguously about drinking water', () => {
    const result = classifyFixture('S1001');

    expect(result.relevant).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(SCORING.relevanceThreshold);
    expect(result.topics).toContain('drinking-water');
    expect(result.evidence.some((e) => e.field === 'title')).toBe(true);
  });

  it('tracks a wetlands bill and assigns the wetlands topic', () => {
    const result = classifyFixture('S3320');

    expect(result.relevant).toBe(true);
    expect(result.topics).toContain('wetlands');
  });

  it('tracks a stormwater bill and connects it to sewage overflows', () => {
    const result = classifyFixture('A4478');

    expect(result.relevant).toBe(true);
    expect(result.topics).toContain('stormwater');
  });

  it('rejects figurative water language such as "watered stock"', () => {
    const result = classifyFixture('S5590');

    expect(result.relevant).toBe(false);
    expect(result.score).toBeLessThan(SCORING.relevanceThreshold);
    expect(result.penalties.join(' ')).toMatch(/figurative/i);
  });

  it('never invents a topic that is not in the taxonomy', () => {
    for (const billNumber of ['S1001', 'S3320', 'A4478']) {
      for (const slug of classifyFixture(billNumber).topics) {
        expect(getTopicDefinition(slug), `${slug} is not a configured topic`).toBeDefined();
      }
    }
  });

  it('assigns at most the configured number of topics', () => {
    const result = classifyWaterRelevance({
      title:
        'Relates to drinking water, wetlands, stormwater, groundwater, fisheries, tidal wetlands, ' +
        'coastal erosion, PFAS contamination, sewage overflows and Long Island Sound restoration',
    });

    expect(result.topics.length).toBeLessThanOrEqual(SCORING.maxTopicsPerBill);
  });

  it('does not track a bill on the strength of one generic mention', () => {
    const result = classifyWaterRelevance({
      title: 'Relates to the water supply of the state fairgrounds concession stands',
      description: 'Authorizes a concession agreement.',
    });

    expect(result.score).toBeLessThan(100);
    expect(result.evidence.length).toBeGreaterThan(0);
  });

  it('down-weights water language buried in a budget vehicle', () => {
    const budget = classifyWaterRelevance({
      title: 'Makes appropriations for the support of government - capital projects budget',
      description:
        'An act making appropriations for the support of government, including amounts available for water systems.',
    });

    expect(budget.relevant).toBe(false);
    expect(budget.penalties.join(' ')).toMatch(/budget|omnibus/i);
  });

  it('weighs a title match above the same phrase in a description', () => {
    const inTitle = classifyWaterRelevance({ title: 'Relates to drinking water standards' });
    const inDescription = classifyWaterRelevance({
      title: 'Relates to certain standards',
      description: 'Relates to drinking water standards for public systems.',
    });

    expect(inTitle.score).toBeGreaterThan(inDescription.score);
  });

  it('produces a reason a non-expert can read, without jargon or scores', () => {
    const result = classifyFixture('S1001');

    expect(result.reason.length).toBeGreaterThan(20);
    expect(result.reason).not.toMatch(/\bscore\b/i);
    expect(result.reason).not.toMatch(/tier|weight|regex/i);
    expect(result.reason.endsWith('.')).toBe(true);
  });

  it('never repeats the same concept twice in one reason', () => {
    const result = classifyWaterRelevance({
      title: 'Relates to drinking water testing',
      description: 'Relates to drinking water testing requirements for drinking water systems.',
    });

    const mentions = result.reason.toLowerCase().split('drinking water').length - 1;
    expect(mentions).toBeLessThanOrEqual(1);
  });

  it('is deterministic — the same input always produces the same output', () => {
    const first = classifyFixture('S1001');
    const second = classifyFixture('S1001');

    expect(second.score).toBe(first.score);
    expect(second.topics).toEqual(first.topics);
    expect(second.reason).toBe(first.reason);
  });

  it('stamps a classifier version so past decisions stay auditable', () => {
    expect(classifyFixture('S1001').classifierVersion).toMatch(/\S+/);
  });

  it('pre-screens candidates cheaply from a title alone', () => {
    // The pre-screen decides whether a candidate is worth one getBill query, so
    // a false negative here costs coverage and a false positive costs quota.
    const water = prescreenCandidate('Relates to tidal wetlands permits');
    const notWater = prescreenCandidate('Relates to motor vehicle registration fees');

    expect(water.passes).toBe(true);
    expect(water.rawScore).toBeGreaterThanOrEqual(SCORING.prescreenThreshold);
    expect(notWater.passes).toBe(false);
  });
});

describe('manual overrides', () => {
  const relevant = { relevant: true, reason: 'Automatically identified as water policy.' };
  const notRelevant = { relevant: false, reason: 'No water-policy language found.' };

  it('follows the classifier when no override exists', () => {
    const tracking = resolveTracking(relevant, null);
    expect(tracking.isTracked).toBe(true);
    expect(tracking.source).toBe('automatic');
  });

  it('lets a reviewer include a bill the classifier rejected', () => {
    const tracking = resolveTracking(notRelevant, {
      decision: 'include',
      reason: 'Funds lead service line replacement.',
    });

    expect(tracking.isTracked).toBe(true);
    expect(tracking.source).toBe('manual');
    expect(tracking.explanation).toContain('Funds lead service line replacement.');
  });

  it('lets a reviewer exclude a bill the classifier accepted', () => {
    const tracking = resolveTracking(relevant, {
      decision: 'exclude',
      reason: 'Concerns bottled beverage labelling, not water policy.',
    });

    expect(tracking.isTracked).toBe(false);
    expect(tracking.source).toBe('manual');
  });

  it('returns to the automatic decision once an override is cleared', () => {
    const tracking = resolveTracking(relevant, {
      decision: 'exclude',
      reason: 'Was mis-scoped.',
      clearedAt: new Date('2025-05-01'),
    });

    expect(tracking.isTracked).toBe(true);
    expect(tracking.source).toBe('automatic');
  });
});
