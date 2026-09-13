const fs = require('fs');
const path = require('path');

const pages = JSON.parse(fs.readFileSync('scripts/comprehensive-audit-344.json', 'utf8'));

function getPageDetails(filePath, route) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const compMatch = code.match(/export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
    const importMatch = code.match(/import\s+\{?\s*([A-Za-z0-9_]+)\s*\}?\s+from\s+['"][^'"]*ui[^'"]*['"]/);
    
    let clean = route
      .replace('/[locale]', '')
      .replace('/(dashboard)', '')
      .replace('/(auth)', '')
      .replace('/(public)', '')
      .replace('/(marketing)', '')
      .replace('/(alumni-portal)', '');
    if (!clean) clean = '/';
    
    return {
      cleanRoute: clean,
      component: compMatch ? compMatch[1] : (importMatch ? importMatch[1] : path.basename(filePath))
    };
  } catch (e) {
    return { cleanRoute: route, component: path.basename(filePath) };
  }
}

const enriched = pages.map(p => {
  const d = getPageDetails(p.filePath, p.route);
  return {
    ...p,
    cleanRoute: d.cleanRoute,
    component: d.component
  };
});

fs.writeFileSync('scripts/comprehensive-audit-344-enriched.json', JSON.stringify(enriched, null, 2));
console.log('Enriched 344 pages successfully.');
