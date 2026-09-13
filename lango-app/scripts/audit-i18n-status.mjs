import fs from 'fs';
import path from 'path';

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('.spec.')) {
      results.push(full);
    }
  }
  return results;
}

const files = walk('./src/features');
const unlocalized = [];
const localized = [];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf-8');
  if (content.includes('useTranslations') || content.includes('getTranslations')) {
    localized.push(f);
  } else {
    unlocalized.push(f);
  }
}

console.log(`Total feature views: ${files.length}`);
console.log(`Localized: ${localized.length}`);
console.log(`Unlocalized: ${unlocalized.length}`);

console.log('\nUnlocalized files grouped by feature:');
const byArea = {};
for (const f of unlocalized) {
  const rel = path.relative('./src/features', f);
  const area = rel.split(path.sep)[0];
  if (!byArea[area]) byArea[area] = [];
  byArea[area].push(path.basename(f));
}

for (const [area, areaFiles] of Object.entries(byArea)) {
  console.log(`\n=== ${area} (${areaFiles.length} files) ===`);
  areaFiles.slice(0, 10).forEach(file => console.log(`  - ${file}`));
  if (areaFiles.length > 10) console.log(`  ... and ${areaFiles.length - 10} more`);
}
