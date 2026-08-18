/**
 * Emits one JSON-LD script. Data is ours (config and the legislative record),
 * never visitor input, so stringifying it here is safe.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
