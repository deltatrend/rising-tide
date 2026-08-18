/** Lookups for the server-mediated document download route. */

import { eq } from 'drizzle-orm';

import type { DocumentKind } from '@/lib/legiscan/documents';
import { safeQuery } from '../client';
import { amendments, billDocuments, r2Objects, supplements } from '../schema';

export interface CachedDocumentRef {
  objectKey: string;
  contentType: string | null;
  sizeBytes: number | null;
  sourceUrl: string | null;
  filename: string;
}

/**
 * Resolves a cached document to its R2 object. Returns null when the document
 * exists but was never cached, which is the normal case for most documents.
 */
export async function findCachedDocument(
  kind: DocumentKind,
  externalDocumentId: number,
): Promise<CachedDocumentRef | null> {
  return safeQuery<CachedDocumentRef | null>(
    async (db) => {
      const [object] = await db
        .select()
        .from(r2Objects)
        .where(eq(r2Objects.externalDocumentId, externalDocumentId))
        .limit(1);

      if (!object || object.documentKind !== kind) return null;

      let label = `${kind}-${externalDocumentId}`;

      if (kind === 'text') {
        const [doc] = await db
          .select()
          .from(billDocuments)
          .where(eq(billDocuments.legiscanDocId, externalDocumentId))
          .limit(1);
        if (doc?.versionType) label = `${doc.versionType}-${externalDocumentId}`;
      } else if (kind === 'amendment') {
        const [doc] = await db
          .select()
          .from(amendments)
          .where(eq(amendments.legiscanAmendmentId, externalDocumentId))
          .limit(1);
        if (doc?.title) label = `amendment-${externalDocumentId}`;
      } else {
        const [doc] = await db
          .select()
          .from(supplements)
          .where(eq(supplements.legiscanSupplementId, externalDocumentId))
          .limit(1);
        if (doc?.supplementType) label = `${doc.supplementType}-${externalDocumentId}`;
      }

      const extension = object.objectKey.split('.').pop() ?? 'bin';

      return {
        objectKey: object.objectKey,
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
        sourceUrl: object.sourceUrl,
        filename: `${label.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.${extension}`,
      };
    },
    null,
    'findCachedDocument',
  );
}
