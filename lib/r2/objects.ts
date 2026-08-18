/**
 * R2 object operations and the deterministic key scheme.
 *
 * Key format (documented and stable):
 *   legiscan/{sessionId}/{billId}/{documentType}/{documentId}.{ext}
 *
 * Because the key is derived from immutable identifiers, an identical document
 * always maps to the same object — which is how re-uploading is avoided.
 */

import type { DocumentKind } from '@/lib/legiscan/documents';
import { mimeExtension } from '@/lib/legiscan/enums';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  R2NotConfiguredError,
  getR2Client,
  getSignedUrl,
} from './client';

export interface ObjectKeyParts {
  sessionId: number;
  billId: number;
  documentKind: DocumentKind;
  documentId: number;
  mimeId?: number | null;
  mime?: string | null;
}

export function buildObjectKey(parts: ObjectKeyParts): string {
  const extension = mimeExtension(parts.mimeId ?? null, parts.mime ?? null);
  return `legiscan/${parts.sessionId}/${parts.billId}/${parts.documentKind}/${parts.documentId}.${extension}`;
}

export interface StoreResult {
  objectKey: string;
  bucket: string;
  /** False when the object was already present and nothing was uploaded. */
  uploaded: boolean;
  sizeBytes: number;
}

/** True when an object already exists, so we never re-upload identical bytes. */
export async function objectExists(objectKey: string): Promise<boolean> {
  const { client, config } = getR2Client();
  try {
    await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    return true;
  } catch (error) {
    if (isNotFound(error)) return false;
    throw error;
  }
}

export interface StoreDocumentInput {
  objectKey: string;
  bytes: Uint8Array;
  contentType: string;
  /** MD5 from LegiScan, stored as object metadata for provenance. */
  checksum?: string | null;
  sourceUrl?: string | null;
  externalDocumentId: number;
  documentKind: DocumentKind;
}

/**
 * Uploads only if the key is absent. Metadata keeps the provenance trail with
 * the bytes themselves, so an object is still identifiable outside the database.
 */
export async function storeDocument(input: StoreDocumentInput): Promise<StoreResult> {
  const { client, config } = getR2Client();

  if (await objectExists(input.objectKey)) {
    return {
      objectKey: input.objectKey,
      bucket: config.bucket,
      uploaded: false,
      sizeBytes: input.bytes.byteLength,
    };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.objectKey,
      Body: input.bytes,
      ContentType: input.contentType,
      Metadata: {
        'legiscan-document-kind': input.documentKind,
        'legiscan-document-id': String(input.externalDocumentId),
        ...(input.checksum ? { 'legiscan-md5': input.checksum } : {}),
        ...(input.sourceUrl ? { 'source-url': input.sourceUrl.slice(0, 1024) } : {}),
        'cached-by': 'rising-tide',
        'cached-at': new Date().toISOString(),
      },
    }),
  );

  return {
    objectKey: input.objectKey,
    bucket: config.bucket,
    uploaded: true,
    sizeBytes: input.bytes.byteLength,
  };
}

/** Short-lived read URL. Default 5 minutes — long enough to click, not to share. */
export async function createReadUrl(objectKey: string, expiresInSeconds = 300): Promise<string> {
  const { client, config } = getR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    { expiresIn: expiresInSeconds },
  );
}

export interface FetchedObject {
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength?: number;
}

/** Streams an object for a server route to relay, keeping the bucket private. */
export async function fetchObject(objectKey: string): Promise<FetchedObject | null> {
  const { client, config } = getR2Client();

  try {
    const response = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }),
    );

    if (!response.Body) return null;

    return {
      body: response.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      contentType: response.ContentType ?? 'application/octet-stream',
      contentLength: response.ContentLength,
    };
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === 'NotFound' || candidate.$metadata?.httpStatusCode === 404;
}

export { R2NotConfiguredError };
