import Link from 'next/link';
import type { ResolvedSite } from './site-resolver';

type HeaderMenuItem = Pick<ResolvedSite['menu'][number], 'id' | 'label' | 'linkType' | 'linkValue'>;

// A school that has not built a menu yet still needs a way around its own
// site: fall back to the standard pages in the visitor's language (audit S-55).
const DEFAULT_MENU: Record<string, [string, string][]> = {
  fr: [['home', 'Accueil'], ['about', 'À propos'], ['services', 'Services'], ['news', 'Actualités'], ['events', 'Événements'], ['gallery', 'Galerie'], ['faq', 'FAQ'], ['contact', 'Contact']],
  en: [['home', 'Home'], ['about', 'About'], ['services', 'Services'], ['news', 'News'], ['events', 'Events'], ['gallery', 'Gallery'], ['faq', 'FAQ'], ['contact', 'Contact']],
  ar: [['home', 'الرئيسية'], ['about', 'من نحن'], ['services', 'الخدمات'], ['news', 'الأخبار'], ['events', 'الفعاليات'], ['gallery', 'المعرض'], ['faq', 'الأسئلة الشائعة'], ['contact', 'اتصل بنا']],
};

function defaultMenu(locale: string): HeaderMenuItem[] {
  return (DEFAULT_MENU[locale] ?? DEFAULT_MENU.fr!).map(([page, label]) => ({ id: `default-${page}`, label, linkType: 'page', linkValue: page } as HeaderMenuItem));
}

function menuItemHref(item: HeaderMenuItem, locale: string, tenantSlug: string) {
  if (item.linkType === 'external') {
    return item.linkValue;
  }
  if (item.linkType === 'anchor') {
    return item.linkValue.startsWith('#') ? item.linkValue : `#${item.linkValue}`;
  }
  // linkType === 'page'
  const base = `/${locale}/${tenantSlug}`;
  if (item.linkValue === 'home') {
    return base;
  }
  return `${base}/${item.linkValue}`;
}

export function SiteHeader({ site, locale }: { site: ResolvedSite; locale: string }) {
  const { tenant, logoUrl, theme } = site;
  const menu: HeaderMenuItem[] = site.menu.length > 0 ? site.menu : defaultMenu(locale);
  if (!theme) {
    return null;
  }

  return (
    <header style={{ backgroundColor: theme.colorMenuBackground }} className="sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link href={`/${locale}/${tenant.slug}`} style={{ color: theme.colorFooterText }} className="flex items-center gap-2 text-base font-extrabold shrink-0">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={tenant.name}
              className="h-8 w-8 rounded-lg object-cover"
            />
          )}
          <span>{theme.siteTitle || tenant.name}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          {menu.map(item => (
            <Link
              key={item.id}
              href={menuItemHref(item, locale, tenant.slug)}
              style={{ color: theme.colorFooterText }}
              className="text-sm font-semibold opacity-90 hover:opacity-100"
              target={item.linkType === 'external' ? '_blank' : undefined}
              rel={item.linkType === 'external' ? 'noopener noreferrer' : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <details className="md:hidden relative">
          <summary style={{ color: theme.colorFooterText }} className="list-none cursor-pointer text-sm font-bold">Menu</summary>
          <nav className="absolute right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 py-2 min-w-[180px]">
            {menu.map(item => (
              <Link
                key={item.id}
                href={menuItemHref(item, locale, tenant.slug)}
                className="block px-4 py-2 text-sm font-semibold text-[#16212B] hover:bg-slate-50"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
