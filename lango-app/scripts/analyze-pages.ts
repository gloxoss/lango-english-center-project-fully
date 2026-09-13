import fs from 'node:fs';
import path from 'node:path';
import { fileFetchesData, findRecordConsts, routeIsLinked } from './check-ui-reality';

const APP = path.join(process.cwd(), 'src', 'app');
const SIDEBAR = path.join(process.cwd(), 'src', 'components', 'shared', 'sidebar.tsx');
const MANIFEST = path.join(process.cwd(), 'src', 'libs', 'api', 'portal-manifest.ts');

const navSources = [SIDEBAR, MANIFEST]
  .filter(f => fs.existsSync(f))
  .map(f => fs.readFileSync(f, 'utf8'))
  .join('\n');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') walk(full, out);
    } else if (entry.name === 'page.tsx') {
      out.push(full);
    }
  }
  return out;
}

function routeOf(pageFile: string): string {
  let r = path.relative(APP, pageFile).replace(/\\/g, '/').replace(/\/page\.tsx$/, '');
  r = r.split('/').filter(seg => !(seg.startsWith('(') && seg.endsWith(')'))).join('/');
  return r.replace(/^\[locale\]\//, '');
}

const allPages = walk(APP).map(p => {
  const relPath = path.relative(process.cwd(), p).replace(/\\/g, '/');
  const route = routeOf(p);
  const src = fs.readFileSync(p, 'utf8');
  const isDynamic = route.includes('[');
  const isDashboard = route.startsWith('dashboard');
  const linked = isDashboard ? (isDynamic || routeIsLinked(route, navSources)) : true;
  
  // Check if component file fetches or imports a view that fetches
  let hasRealData = false;
  if (fileFetchesData(src) || src.includes('prisma.') || src.includes('db.') || src.includes('requireServerPage') || src.includes('api(')) {
    hasRealData = true;
  }
  
  // Check imported files
  const importMatches = src.match(/from\s+['"]([^'"]+)['"]/g) || [];
  for (const m of importMatches) {
    const impPath = m.replace(/from\s+['"]/, '').replace(/['"]/, '');
    let resolved = '';
    if (impPath.startsWith('@/')) {
      resolved = path.join(process.cwd(), 'src', impPath.slice(2));
    } else if (impPath.startsWith('.')) {
      resolved = path.resolve(path.dirname(p), impPath);
    }
    for (const ext of ['.tsx', '.ts', '/index.tsx', '/index.ts', '']) {
      if (fs.existsSync(resolved + ext) && fs.statSync(resolved + ext).isFile()) {
        const impContent = fs.readFileSync(resolved + ext, 'utf8');
        if (fileFetchesData(impContent) || impContent.includes('prisma.') || impContent.includes('db.') || impContent.includes('api(') || impContent.includes('fetch(') || impContent.includes('useState') || impContent.includes('useEffect')) {
          hasRealData = true;
        }
        break;
      }
    }
  }

  // Determine Category / Domain
  let domain = 'Other';
  if (route.startsWith('dashboard/students') || route.startsWith('dashboard/guardians')) domain = 'Students & Admissions';
  else if (route.startsWith('dashboard/academics/assessment') || route.startsWith('dashboard/academics/grades') || route.startsWith('dashboard/academics/results')) domain = 'Grades & Assessments';
  else if (route.startsWith('dashboard/academics')) domain = 'Academics & Timetable';
  else if (route.startsWith('dashboard/teachers')) domain = 'Faculty & Staff';
  else if (route.startsWith('dashboard/attendance')) domain = 'Attendance & QR';
  else if (route.startsWith('dashboard/cards')) domain = 'Student Cards';
  else if (route.startsWith('dashboard/certificates')) domain = 'Certificates';
  else if (route.startsWith('dashboard/events')) domain = 'Events';
  else if (route.startsWith('dashboard/content')) domain = 'Pedagogical Content';
  else if (route.startsWith('dashboard/library') || route.startsWith('dashboard/portals/librarian')) domain = 'School Library';
  else if (route.startsWith('dashboard/finance') || route.startsWith('dashboard/accounting')) domain = 'Finance & Accounting';
  else if (route.startsWith('dashboard/inventory')) domain = 'Inventory';
  else if (route.startsWith('dashboard/communication') || route.startsWith('dashboard/broadcast')) domain = 'Communication & SMS';
  else if (route.startsWith('dashboard/documents')) domain = 'Documents Generator';
  else if (route.startsWith('dashboard/hr') || route.startsWith('dashboard/workforce')) domain = 'HR & Workforce';
  else if (route.startsWith('dashboard/guard') || route.startsWith('dashboard/portals/guard') || route.startsWith('dashboard/receptionist')) domain = 'Gate, Security & Front Desk';
  else if (route.startsWith('dashboard/hostel')) domain = 'Hostel';
  else if (route.startsWith('dashboard/transport')) domain = 'School Transport';
  else if (route.startsWith('dashboard/reports')) domain = 'Reports & Analytics';
  else if (route.startsWith('dashboard/teacher') || route.startsWith('dashboard/student') || route.startsWith('dashboard/parent') || route.startsWith('dashboard/accountant')) domain = 'Dedicated Role Portals';
  else if (route.startsWith('dashboard/super-admin')) domain = 'Super Admin';
  else if (route.startsWith('dashboard/settings')) domain = 'School Settings';
  else if (route.startsWith('dashboard')) domain = 'Dashboard Core';
  else if (route.startsWith('alumni')) domain = 'Alumni Portal';
  else if (route.startsWith('verify')) domain = 'Public Verification';
  else domain = 'Marketing & Public Site';

  return {
    file: relPath,
    route: '/' + route,
    domain,
    linked,
    isDynamic,
    hasRealData,
    status: (linked && hasRealData) ? 'DONE' : (!linked ? 'UNLINKED' : 'IN_PROGRESS')
  };
});

fs.writeFileSync(path.join(process.cwd(), 'scripts', 'pages-summary.json'), JSON.stringify(allPages, null, 2));

const byDomain: Record<string, any[]> = {};
for (const p of allPages) {
  if (!byDomain[p.domain]) byDomain[p.domain] = [];
  byDomain[p.domain]!.push(p);
}

console.log('--- PAGES BY DOMAIN ---');
for (const [dom, list] of Object.entries(byDomain)) {
  const done = list.filter(p => p.status === 'DONE').length;
  const unlinked = list.filter(p => p.status === 'UNLINKED').length;
  const inProg = list.filter(p => p.status === 'IN_PROGRESS').length;
  console.log(`${dom}: Total ${list.length} | Done: ${done} | Unlinked: ${unlinked} | In Progress: ${inProg}`);
}
