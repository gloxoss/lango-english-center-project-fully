import fs from 'fs';

const targets = [
  'src/app/[locale]/(dashboard)/dashboard/certificates/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/definitions/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/definitions/[id]/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/issue/employees/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/issue/students/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/issued/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/issued/[id]/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/jobs/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/requests/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/settings/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/templates/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/certificates/templates/[id]/edit/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/admit-cards/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/employees/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/issued/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/jobs/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/students/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/templates/page.tsx',
  'src/app/[locale]/(dashboard)/dashboard/cards/templates/[id]/edit/page.tsx'
];

targets.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');

  // Strip previously generated lines if present
  content = content.replace(/const loc = typeof locale[^\n]*\n\s*const isRtl = loc === 'ar';\n\s*return \(\n\s*<main dir=\{isRtl \? 'rtl' : 'ltr'\} lang=\{loc\}>\n\s*(<[A-Za-z0-9_]+[^>]*\/>)\n\s*<\/main>\n\s*\);/s, 'return $1;');

  const hasP = content.includes('const p = await params;');
  const locVar = hasP ? 'p.locale' : 'locale';

  content = content.replace(/return\s+(<[A-Za-z0-9_]+[^>]*\/>);/s, (match, tag) => {
    return `const isRtl = ${locVar} === 'ar';\n  return (\n    <main dir={isRtl ? 'rtl' : 'ltr'} lang={${locVar}}>\n      ${tag}\n    </main>\n  );`;
  });

  fs.writeFileSync(f, content);
  console.log('Fixed:', f);
});
