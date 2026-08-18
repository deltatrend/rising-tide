import Link from 'next/link';

export function SectionHeader({
  title,
  description,
  action,
  level = 2,
}: {
  title: string;
  description?: string;
  action?: { href: string; label: string };
  level?: 2 | 3;
}) {
  const Heading = level === 3 ? 'h3' : 'h2';

  return (
    <div className="section-header">
      <div>
        <Heading>{title}</Heading>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? (
        <Link className="button button--secondary button--small" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {lede ? <p className="page-header__lede">{lede}</p> : null}
      {children}
    </header>
  );
}
