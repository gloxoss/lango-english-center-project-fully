import type { ResolvedSite } from './site-resolver';

const SOCIAL_LABELS: { key: keyof NonNullable<ResolvedSite['theme']>; label: string }[] = [
  { key: 'socialFacebook', label: 'Facebook' },
  { key: 'socialTwitter', label: 'Twitter / X' },
  { key: 'socialYoutube', label: 'YouTube' },
  { key: 'socialLinkedin', label: 'LinkedIn' },
  { key: 'socialInstagram', label: 'Instagram' },
  { key: 'socialPinterest', label: 'Pinterest' },
];

export function SiteFooter({ site }: { site: ResolvedSite }) {
  const { theme } = site;
  if (!theme) {
    return null;
  }

  const socialLinks = SOCIAL_LABELS
    .map(s => ({ label: s.label, url: theme[s.key] as string | null }))
    .filter(s => s.url);

  return (
    <footer>
      <div style={{ backgroundColor: theme.colorFooterBackground, color: theme.colorFooterText }} className="px-6 py-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-sm">
          <div>
            <h3 className="font-extrabold mb-2">{theme.siteTitle}</h3>
            <p className="opacity-80">{theme.footerAboutText}</p>
          </div>
          <div>
            <h4 className="font-bold mb-2 opacity-90">Contact</h4>
            <ul className="space-y-1 opacity-80">
              {theme.address && <li>{theme.address}</li>}
              {theme.phone && <li>{theme.phone}</li>}
              {theme.email && <li>{theme.email}</li>}
              {theme.workingHours && <li>{theme.workingHours}</li>}
            </ul>
          </div>
          {socialLinks.length > 0 && (
            <div>
              <h4 className="font-bold mb-2 opacity-90">Suivez-nous</h4>
              <ul className="space-y-1">
                {socialLinks.map(s => (
                  <li key={s.label}>
                    <a href={s.url ?? '#'} target="_blank" rel="noopener noreferrer" className="opacity-80 hover:opacity-100 underline">
                      {s.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div style={{ backgroundColor: theme.colorCopyrightBackground, color: theme.colorCopyrightText }} className="px-6 py-3 text-xs text-center">
        {theme.copyrightText || `© ${new Date().getFullYear()} ${theme.siteTitle}`}
      </div>
    </footer>
  );
}
