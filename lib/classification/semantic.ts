/**
 * Placeholder semantic classification provider.
 *
 * Rising Tide deliberately ships without any paid AI dependency. This file
 * exists so a future developer can drop in an embedding or LLM based check for
 * borderline candidates without changing the synchronization pipeline, the
 * database schema, or any page.
 *
 * Contract for whoever implements it:
 *   - It must remain OPTIONAL. `available` stays false unless explicitly
 *     configured, and nothing in the request path may depend on it.
 *   - It runs during synchronization only — never during page rendering.
 *   - It should only be consulted for candidates the deterministic classifier
 *     scored near the threshold (see SEMANTIC_REVIEW_BAND below).
 *   - It must return the same WaterRelevanceResult shape, including evidence
 *     and a reader-facing reason.
 */

import { CLASSIFIER_VERSION } from '@/config/water-taxonomy';
import type { ClassifiableBill, ClassificationProvider, WaterRelevanceResult } from './types';

/** Scores inside this band are ambiguous enough to be worth a second opinion. */
export const SEMANTIC_REVIEW_BAND = { min: 30, max: 60 } as const;

export function isBorderline(score: number): boolean {
  return score >= SEMANTIC_REVIEW_BAND.min && score <= SEMANTIC_REVIEW_BAND.max;
}

export const semanticProvider: ClassificationProvider = {
  name: 'semantic',
  version: `semantic-unconfigured-${CLASSIFIER_VERSION}`,
  available: false,
  async classify(_bill: ClassifiableBill): Promise<WaterRelevanceResult> {
    throw new Error(
      'Semantic classification is not configured. Rising Tide runs on the deterministic classifier by design.',
    );
  },
};
