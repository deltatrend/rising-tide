import { NextResponse } from 'next/server';

import { findCachedDocument } from '@/lib/db/queries/documents';
import { isR2Configured } from '@/lib/env';
import type { DocumentKind } from '@/lib/legiscan/documents';
import { fetchObject } from '@/lib/r2/objects';

export const runtime = 'nodejs';

const KINDS: DocumentKind[] = ['text', 'amendment', 'supplement'];

/**
 * Relays a cached legislative document out of the private R2 bucket.
 *
 * The bucket has no public access and credentials never leave the server; this
 * route streams the bytes instead of redirecting to a signed URL so links stay
 * stable and shareable. If R2 is not configured, or a document was never
 * cached, we send the reader to the authoritative source rather than failing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;

  if (!KINDS.includes(kind as DocumentKind)) {
    return NextResponse.json({ error: 'Unknown document type' }, { status: 404 });
  }

  const documentId = Number(id);
  if (!Number.isInteger(documentId) || documentId <= 0) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  const record = await findCachedDocument(kind as DocumentKind, documentId);

  if (!record) {
    return NextResponse.json(
      { error: 'This document is not cached. Use the official source link on the bill page.' },
      { status: 404 },
    );
  }

  if (!isR2Configured()) {
    return record.sourceUrl
      ? NextResponse.redirect(record.sourceUrl, 302)
      : NextResponse.json({ error: 'Document storage is not configured.' }, { status: 503 });
  }

  try {
    const object = await fetchObject(record.objectKey);

    if (!object) {
      return record.sourceUrl
        ? NextResponse.redirect(record.sourceUrl, 302)
        : NextResponse.json({ error: 'Document is no longer cached.' }, { status: 404 });
    }

    return new NextResponse(object.body, {
      headers: {
        'Content-Type': object.contentType || record.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${record.filename}"`,
        // Legislative documents are immutable once published.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
        ...(object.contentLength ? { 'Content-Length': String(object.contentLength) } : {}),
      },
    });
  } catch (error) {
    console.error(
      'Failed to stream cached document:',
      error instanceof Error ? error.message : 'unknown error',
    );

    return record.sourceUrl
      ? NextResponse.redirect(record.sourceUrl, 302)
      : NextResponse.json({ error: 'Document could not be retrieved.' }, { status: 502 });
  }
}
