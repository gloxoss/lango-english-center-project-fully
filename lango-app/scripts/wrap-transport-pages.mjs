import fs from 'fs';

const targets = [
  'src/app/[locale]/(dashboard)/dashboard/transport/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/allocations/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/boarding/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/drivers/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/guardian/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/incidents/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/policies/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/reports/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/routes/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/stops/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/student/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/trips/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/transport/vehicles/page.tsx'
];

targets.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('<main')) return;

  content = content.replace(/return\s+(<[A-Za-z0-9_]+[^>]*\/>);/s, (match, tag) => {
    return `const isRtl = locale === 'ar';\n  return (\n    <main dir={isRtl ? 'rtl' : 'ltr'} lang={locale}>\n      ${tag}\n    </main>\n  );`;
  });

  fs.writeFileSync(f, content);
  console.log('Wrapped:', f);
});
