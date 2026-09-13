const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(file));
    } else {
      results.push(file);
    }
  });
  return results;
}

const pageFiles = getFiles('src/app').filter(f => f.endsWith('page.tsx'));

const accurate = pageFiles.map(filePath => {
  const norm = filePath.split(path.sep).join('/');
  let route = norm.replace(/^src\/app/, '').replace(/\/page\.tsx$/, '');
  if (route === '') route = '/';
  
  const routeParts = route.split('/').filter(Boolean);
  const pathParts = [];
  
  for (const part of routeParts) {
    if (part === '[locale]') {
      pathParts.push('fr');
    } else if (part === '[tenantSlug]') {
      pathParts.push('atlas-academy');
    } else if (part.startsWith('(') && part.endsWith(')')) {
      continue;
    } else {
      pathParts.push(part);
    }
  }
  
  let browserUrl = 'http://localhost:3111/' + pathParts.join('/');
  if (browserUrl === 'http://localhost:3111/') browserUrl = 'http://localhost:3111/fr';
  
  let cleanRoute = route
    .replace('/[locale]', '')
    .replace('/(dashboard)', '')
    .replace('/(auth)', '')
    .replace('/(public)', '')
    .replace('/(marketing)', '')
    .replace('/(alumni-portal)', '');
  if (!cleanRoute) cleanRoute = '/';

  const code = fs.readFileSync(filePath, 'utf8');
  const compMatch = code.match(/export\s+default\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/);
  const importMatch = code.match(/import\s+\{?\s*([A-Za-z0-9_]+)\s*\}?\s+from\s+['"][^'"]*ui[^'"]*['"]/);
  const component = compMatch ? compMatch[1] : (importMatch ? importMatch[1] : path.basename(filePath));

  // Determine Persona and Module
  let persona = 'School Administration';
  let domain = 'General Administration';

  if (norm.includes('super-admin')) {
    persona = 'Super Admin (Platform Owner)';
    domain = 'Super Admin & Multi-Tenancy';
  } else if (norm.includes('/dashboard/student/') || norm.endsWith('/dashboard/student/page.tsx')) {
    persona = 'Student (Élève)';
    domain = 'Student Portal';
  } else if (norm.includes('/dashboard/parent/') || norm.endsWith('/dashboard/parent/page.tsx')) {
    persona = 'Parent / Guardian';
    domain = 'Parent Portal & Family Hub';
  } else if (norm.includes('/dashboard/teacher/') || norm.endsWith('/dashboard/teacher/page.tsx')) {
    persona = 'Teacher / Faculty';
    domain = 'Teacher Portal & Classrooms';
  } else if (norm.includes('/dashboard/portals/guard') || norm.includes('/dashboard/guard')) {
    persona = 'Gate Security Officer / Guard';
    domain = 'Campus Physical Security & Gate';
  } else if (norm.includes('/dashboard/reception')) {
    persona = 'Front Desk Receptionist';
    domain = 'Front Desk & Visitor Management';
  } else if (norm.includes('librarian') || norm.includes('/dashboard/library')) {
    persona = 'Librarian / Media Specialist';
    domain = 'School Library & Media Center';
  } else if (norm.includes('accountant') || norm.includes('/dashboard/finance') || norm.includes('/dashboard/tuition')) {
    persona = 'Accountant / Financial Officer';
    domain = 'Finance, Tuition & General Ledger';
  } else if (norm.includes('workforce') || norm.includes('/dashboard/hr') || norm.includes('/dashboard/payroll')) {
    persona = 'HR & Payroll Director';
    domain = 'Human Resources & Payroll';
  } else if (norm.includes('/dashboard/transport')) {
    persona = 'Transport / Fleet Coordinator';
    domain = 'School Transport & Fleet Logistics';
  } else if (norm.includes('/dashboard/inventory')) {
    persona = 'Inventory / Storekeeper';
    domain = 'Inventory & Supply Logistics';
  } else if (norm.includes('/dashboard/hostel')) {
    persona = 'Hostel Warden (Internat)';
    domain = 'Boarding & Dormitory (Internat)';
  } else if (norm.includes('alumni')) {
    persona = 'Alumni Officer & Alumni';
    domain = 'Alumni Network & Community';
  } else if (norm.includes('/dashboard/attendance')) {
    persona = 'Prefect of Studies / Attendance Officer';
    domain = 'Attendance & QR Timekeeping';
  } else if (norm.includes('/dashboard/students') || norm.includes('/dashboard/admissions')) {
    persona = 'Admissions / Student Registrar';
    domain = 'Students & Admissions Records';
  } else if (norm.includes('/dashboard/cards') || norm.includes('/dashboard/student-cards')) {
    persona = 'Identity & Cards Officer';
    domain = 'Student & Staff ID Badges';
  } else if (norm.includes('/dashboard/certificates') || norm.includes('/dashboard/diplomas')) {
    persona = 'Academic Secretariat';
    domain = 'Certificates, Diplomas & Attestations';
  } else if (norm.includes('/dashboard/communication') || norm.includes('/dashboard/broadcast') || norm.includes('/dashboard/sms')) {
    persona = 'Communications Officer';
    domain = 'Communication, SMS & Broadcast';
  } else if (norm.includes('/dashboard/reports') || norm.includes('/dashboard/analytics')) {
    persona = 'School Director / Leadership';
    domain = 'Reports & Decision Analytics';
  } else if (norm.includes('/dashboard/settings')) {
    persona = 'System Administrator';
    domain = 'School Settings & System Governance';
  } else if (norm.includes('/dashboard/content')) {
    persona = 'Pedagogical Resource Coordinator';
    domain = 'Pedagogical Content Library';
  } else if (norm.includes('/dashboard/events') || norm.includes('/dashboard/calendar')) {
    persona = 'Events Coordinator';
    domain = 'School Events & Calendar';
  } else if (norm.includes('/dashboard/documents')) {
    persona = 'Administrative Secretary';
    domain = 'Official Document Generator';
  } else if (norm.includes('leadership')) {
    persona = 'Executive Director / Principal';
    domain = 'Executive Leadership & Approvals';
  } else if (norm.includes('/dashboard/homework')) {
    persona = 'Teacher / Academic Controller';
    domain = 'Grades, Exams & Homework';
  } else if (norm.includes('/dashboard/teachers')) {
    persona = 'Faculty & Staff Manager';
    domain = 'Faculty & Staff Management';
  } else if (norm.includes('/dashboard/academics') || norm.includes('/dashboard/timetable') || norm.includes('/dashboard/classes')) {
    persona = 'Academic Director';
    domain = 'Academics, Scheduling & Timetables';
  } else if (norm === 'src/app/[locale]/(dashboard)/dashboard/page.tsx') {
    persona = 'School Director / Principal';
    domain = 'Central Leadership Dashboard';
  } else if (norm.includes('/(auth)/') || norm.includes('/login') || norm.includes('/signup')) {
    persona = 'All Users (Public / Staff / Families)';
    domain = 'Authentication & Access';
  } else if (norm.includes('verify')) {
    persona = 'Public / Employer / Authority';
    domain = 'Public Document Verification';
  } else if (norm.includes('[tenantSlug]')) {
    persona = 'Public / Prospective Families';
    domain = 'Public School Website (CMS)';
  } else if (norm === 'src/app/page.tsx' || norm.includes('/(marketing)') || norm.includes('/(public)/') || cleanRoute === '/') {
    persona = 'Public / Prospective Client';
    domain = 'SchoolOS SaaS Landing & Home';
  }

  return {
    filePath: norm,
    route,
    cleanRoute,
    browserUrl,
    component,
    persona,
    domain,
    status: 'DONE'
  };
});

fs.writeFileSync('scripts/comprehensive-audit-344-accurate.json', JSON.stringify(accurate, null, 2));

const personaMap = {};
const domainMap = {};
accurate.forEach(a => {
  personaMap[a.persona] = (personaMap[a.persona] || 0) + 1;
  domainMap[a.domain] = (domainMap[a.domain] || 0) + 1;
});

console.log('--- BY USER PERSONA ---');
Object.entries(personaMap).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(k.padEnd(45), ':', v));

console.log('\n--- BY DOMAIN ---');
Object.entries(domainMap).sort((a,b) => b[1] - a[1]).forEach(([k,v]) => console.log(k.padEnd(45), ':', v));
console.log('\nGRAND TOTAL:', accurate.length);
