export function Callout({
  title,
  tone = 'default',
  children,
}: {
  title?: string;
  tone?: 'default' | 'warn' | 'quiet';
  children: React.ReactNode;
}) {
  const className = tone === 'default' ? 'callout' : `callout callout--${tone}`;

  return (
    <div className={className}>
      {title ? <strong className="callout__title">{title}</strong> : null}
      {children}
    </div>
  );
}
