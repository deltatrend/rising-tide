/**
 * Classification entry point.
 *
 * Everything else in the app should import from here rather than reaching for a
 * specific provider, so swapping or layering providers stays a local change.
 */

import { deterministicProvider } from './deterministic';
import { isBorderline, semanticProvider } from './semantic';
import type {
  ClassifiableBill,
  ClassificationProvider,
  WaterRelevanceResult,
} from './types';

export { classifyWaterRelevance, prescreenCandidate } from './deterministic';
export { isBorderline, SEMANTIC_REVIEW_BAND } from './semantic';
export type * from './types';

export function getProviders(): ClassificationProvider[] {
  return [deterministicProvider, semanticProvider].filter((p) => p.available);
}

/**
 * Classifies a bill using the deterministic provider, optionally asking an
 * available semantic provider to break a tie on borderline scores.
 * Never throws because of the optional provider.
 */
export async function classifyBill(bill: ClassifiableBill): Promise<WaterRelevanceResult> {
  const base = await deterministicProvider.classify(bill);

  if (!semanticProvider.available || !isBorderline(base.score)) {
    return base;
  }

  try {
    const semantic = await semanticProvider.classify(bill);
    return {
      ...semantic,
      evidence: [...base.evidence, ...semantic.evidence],
      classifierVersion: `${base.classifierVersion}+${semantic.classifierVersion}`,
    };
  } catch {
    // An optional provider failing must never lose a bill.
    return base;
  }
}

/* ------------------------------------------------------------------------- */
/* Manual overrides                                                           */
/* ------------------------------------------------------------------------- */

export type OverrideDecision = 'include' | 'exclude';

export interface OverrideRecord {
  decision: OverrideDecision;
  reason: string;
  clearedAt?: Date | null;
}

export type TrackingSource = 'automatic' | 'manual';

export interface EffectiveTracking {
  isTracked: boolean;
  source: TrackingSource;
  /** Sentence explaining the decision that is safe to show a visitor. */
  explanation: string;
}

/**
 * Manual decisions win over the classifier until they are explicitly cleared.
 * `clearedAt` keeps the audit trail instead of deleting the row.
 */
export function resolveTracking(
  classification: Pick<WaterRelevanceResult, 'relevant' | 'reason'>,
  override?: OverrideRecord | null,
): EffectiveTracking {
  if (override && !override.clearedAt) {
    return {
      isTracked: override.decision === 'include',
      source: 'manual',
      explanation:
        override.decision === 'include'
          ? `Included by a Rising Tide reviewer: ${override.reason}`
          : `Excluded by a Rising Tide reviewer: ${override.reason}`,
    };
  }

  return {
    isTracked: classification.relevant,
    source: 'automatic',
    explanation: classification.reason,
  };
}
