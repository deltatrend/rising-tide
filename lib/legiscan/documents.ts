/**
 * getBillText / getAmendment / getSupplement.
 *
 * These return the document base64-encoded inside JSON. The encoded string is
 * decoded here on the server and handed to the R2 layer as bytes — it must never
 * be written into Postgres and never sent to a browser.
 *
 * All three documents are static once published, so the sync layer only ever
 * requests one whose hash it has not already stored.
 */

import { createHash } from 'node:crypto';

import type { LegiScanClient } from './client';
import { LegiScanError } from './client';
import {
  amendmentResponseSchema,
  billTextResponseSchema,
  supplementResponseSchema,
  type LegiScanDocumentAmendment,
  type LegiScanDocumentSupplement,
  type LegiScanDocumentText,
} from './schemas';

export type DocumentKind = 'text' | 'amendment' | 'supplement';

export interface DecodedDocument {
  kind: DocumentKind;
  externalDocumentId: number;
  billId: number | null;
  bytes: Uint8Array;
  contentType: string;
  /** MD5 supplied by LegiScan for the decoded bytes, when present. */
  sourceHash: string | null;
  /** MD5 we computed ourselves — used to verify the download. */
  computedHash: string;
  sizeBytes: number;
  declaredSize: number | null;
}

/** One API query. */
export async function fetchBillTextDocument(
  client: LegiScanClient,
  docId: number,
): Promise<LegiScanDocumentText> {
  const body = await client.call('getBillText', { id: docId });
  return billTextResponseSchema.parse(body).text;
}

/** One API query. */
export async function fetchAmendmentDocument(
  client: LegiScanClient,
  amendmentId: number,
): Promise<LegiScanDocumentAmendment> {
  const body = await client.call('getAmendment', { id: amendmentId });
  return amendmentResponseSchema.parse(body).amendment;
}

/** One API query. */
export async function fetchSupplementDocument(
  client: LegiScanClient,
  supplementId: number,
): Promise<LegiScanDocumentSupplement> {
  const body = await client.call('getSupplement', { id: supplementId });
  return supplementResponseSchema.parse(body).supplement;
}

export function decodeBase64Document(encoded: string): Uint8Array {
  const cleaned = encoded.replace(/\s+/g, '');
  const buffer = Buffer.from(cleaned, 'base64');
  if (buffer.length === 0) {
    throw new Error('Decoded document was empty');
  }
  return new Uint8Array(buffer);
}

export function md5(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex');
}

/**
 * Fetches and decodes a document of any of the three kinds.
 * Throws a LegiScanError on a corrupt payload so the caller can record the
 * failure against one document without aborting the whole run.
 */
export async function fetchDocument(
  client: LegiScanClient,
  kind: DocumentKind,
  externalDocumentId: number,
): Promise<DecodedDocument> {
  if (kind === 'text') {
    const doc = await fetchBillTextDocument(client, externalDocumentId);
    return finalize(kind, externalDocumentId, doc.bill_id ?? null, doc.doc, {
      contentType: doc.mime,
      sourceHash: doc.text_hash,
      declaredSize: doc.text_size,
    });
  }

  if (kind === 'amendment') {
    const doc = await fetchAmendmentDocument(client, externalDocumentId);
    return finalize(kind, externalDocumentId, doc.bill_id ?? null, doc.doc, {
      contentType: doc.mime,
      sourceHash: doc.amendment_hash,
      declaredSize: doc.amendment_size,
    });
  }

  const doc = await fetchSupplementDocument(client, externalDocumentId);
  return finalize(kind, externalDocumentId, doc.bill_id ?? null, doc.doc, {
    contentType: doc.mime,
    sourceHash: doc.supplement_hash,
    declaredSize: doc.supplement_size,
  });
}

function finalize(
  kind: DocumentKind,
  externalDocumentId: number,
  billId: number | null,
  encoded: string,
  meta: { contentType: string | null; sourceHash: string | null; declaredSize: number | null },
): DecodedDocument {
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64Document(encoded);
  } catch (error) {
    throw new LegiScanError('parse', `document:${kind}`, 'Document payload could not be decoded', {
      cause: error,
    });
  }

  return {
    kind,
    externalDocumentId,
    billId,
    bytes,
    contentType: meta.contentType ?? 'application/octet-stream',
    sourceHash: meta.sourceHash,
    computedHash: md5(bytes),
    sizeBytes: bytes.byteLength,
    declaredSize: meta.declaredSize,
  };
}

/**
 * A document only needs downloading when we have never stored it, or when the
 * source hash has changed. This is what keeps identical documents from ever
 * being retrieved twice.
 */
export function shouldFetchDocument(input: {
  storedHash: string | null | undefined;
  isCached: boolean;
  incomingHash: string | null | undefined;
}): boolean {
  if (!input.isCached) return true;
  if (!input.incomingHash || !input.storedHash) return false;
  return input.incomingHash !== input.storedHash;
}
