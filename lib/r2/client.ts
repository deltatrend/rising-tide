/**
 * Cloudflare R2 client (S3-compatible), server only.
 *
 * Scope: large, immutable legislative document blobs — bill text PDFs,
 * amendments, fiscal notes, veto letters. Nothing else. Structured metadata
 * lives in Postgres; R2 is never used as a general cache or database.
 *
 * The bucket stays private. Visitors never receive write credentials: documents
 * are either streamed through a server route or offered as a short-lived signed
 * read URL generated on the server.
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { getR2Config, type R2Config } from '@/lib/env';

if (typeof window !== 'undefined') {
  throw new Error('The R2 client is server-only. Write credentials must never reach the browser.');
}

export class R2NotConfiguredError extends Error {
  constructor() {
    super('Cloudflare R2 is not configured. Document caching is disabled.');
    this.name = 'R2NotConfiguredError';
  }
}

interface GlobalWithR2 {
  __risingTideR2?: S3Client;
}

const globalForR2 = globalThis as unknown as GlobalWithR2;

export function getR2Client(): { client: S3Client; config: R2Config } {
  const config = getR2Config();
  if (!config) throw new R2NotConfiguredError();

  if (!globalForR2.__risingTideR2) {
    globalForR2.__risingTideR2 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // R2 requires path-style addressing.
      forcePathStyle: true,
    });
  }

  return { client: globalForR2.__risingTideR2, config };
}

export { GetObjectCommand, HeadObjectCommand, PutObjectCommand, getSignedUrl };
