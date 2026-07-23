/**
 * Lango English Center System — Stitch Batch UI Generator
 * Generates all screens, downloads HTML + screenshots
 * Run: node generate-all.js
 */

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const PROJECT_ID = '14555436995814094423';
const API_KEY = process.env.STITCH_API_KEY;

if (!API_KEY) {
  throw new Error('Missing STITCH_API_KEY environment variable.');
}
const OUTPUT_DIR = path.join(__dirname);

const DESIGN_SYSTEM = `Design: Inter font, primary blue #2563EB, white content area #FFFFFF, zinc-50 sidebar #F9FAFB, slate-900 headings #0F172A, slate-600 body text #475569, zinc-200 borders 1px, 8px card radius, no shadows, green #22C55E success, amber #F59E0B warning, red #EF4444 error. Apple-style functional minimalism, clean professional SaaS. Desktop view 1440px wide.`;

const screens = [
  // ─── AUTH ───
  {
    id: 'auth-login',
    folder: 'auth',
    prompt: `Login page for Lango English Center System (school management SaaS). Split layout: left 55% brand panel with Lango logo, school name large, tagline "Manage your center, effortlessly", subtle geometric background pattern, 500+ students social proof badge. Right 45% login form: logo mark, "Welcome back" H2, email input, password input with show/hide toggle, "Forgot password?" right-aligned link, full-width "Sign In" blue button, divider "or continue with", Google SSO outlined button, support footer. ${DESIGN_SYSTEM}`,
  },

  // ─── SUPER ADMIN ───
  {
    id: 'saas-dashboard',
    folder: 'super-admin',
    prompt: `Super Admin platform dashboard for Lango SaaS. Fixed 220px left sidebar (dark zinc-800 background) with sections: Platform (Dashboard active, Tenants, Plans, Features), System (Gateways, Settings, Logs). "Super Admin" logo at top. 56px top header with notification bell, avatar. Main content: 4 KPI cards (Total Tenants 12, Active Tenants 10, Platform MRR 48000 MAD, System Alerts 2), MRR trend area chart left 60% and tenant growth bar chart right 40%, recent tenants table (last 5: school name, plan badge Free/Pro/Enterprise, status Active/Suspended green/red, created date), system health cards for API/Database/WhatsApp with green status dots. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'saas-tenants',
    folder: 'super-admin',
    prompt: `Tenant management screen for Super Admin of Lango SaaS. Same dark sidebar as platform dashboard. Page header "Tenants" H1 + "Add Tenant" blue button. Filter bar: search input, Plan dropdown (Free/Pro/Enterprise), Status dropdown (Active/Suspended/Trial), date range. DataTable: school name with logo icon, domain (lango.ma, brightfuture.ma), Plan badge colored (Free=zinc, Pro=blue, Enterprise=purple), Status badge (Active=green, Suspended=red, Trial=amber), Students count, Actions dropdown. Pagination "Showing 1-20 of 47 tenants". ${DESIGN_SYSTEM}`,
  },

  // ─── ADMIN DASHBOARD ───
  {
    id: 'admin-dashboard',
    folder: 'admin',
    prompt: `School admin dashboard for Lango English Center. Fixed 220px left sidebar with nav groups: Dashboard (active, highlighted blue), Students (Directory, Admissions, Attendance), Academics (Classes, Timetable, Exams), Finance (Fees, Income/Expenses, Invoices), CRM (Leads Pipeline, Proposals), Staff & HR, WhatsApp (Inbox, Campaigns), LMS (Courses, Live Classes), Settings. Lango logo at sidebar top. 56px top header: global search "Search students, classes..." (Cmd+K), notification bell with red badge 3, user avatar "Ahmed Benali - Director" dropdown. Main content: greeting "Good morning, Ahmed" H1 + "Thursday, April 3, 2026". 4 KPI cards: Active Students 247 (+12 this month), Today Attendance 87% (trending up), Pending Invoices 12,400 MAD (8 overdue), New Leads 8 (from CRM). Revenue area chart last 6 months in blue-600 left 60%. Attendance donut chart (present 87% green vs absent 13% red) right 40%. Two columns below: Recent Enrollments list (Fatima Zahra - A1 Monday, Youssef El Idrissi - B2 Evening, Aya Benali - A2 Weekend, student avatars, dates 2 days ago) + Upcoming Classes today (09:00 A1-Monday-Morning Teacher Sara, 14:00 B1-Wednesday-Afternoon Teacher Karim, 18:00 C1-Evening-Advanced Teacher Nadia). 2 amber notice banners at bottom. ${DESIGN_SYSTEM}`,
  },

  // ─── STUDENTS ───
  {
    id: 'student-directory',
    folder: 'admin',
    prompt: `Student directory page for Lango school admin. Same sidebar as admin dashboard. Page header "Students" H1 + "Add Student" blue button + "Import CSV" outlined button. Filter bar: search "Search by name or ID...", Class dropdown, Status dropdown (Active/Inactive/Graduated), Level dropdown (A1/A2/B1/B2/C1). DataTable with columns: checkbox, Student (avatar + name + ID#1024), Class/Level badge (A1=blue, B2=amber), Parent Contact (phone), Balance (MAD, red if overdue like -1200 MAD), Status badge (Active=green, Inactive=zinc), Enrolled Date, Actions (View, Edit, Archive). Sample students: Fatima Zahra Benmoussa A1 +212661234567 0 MAD Active, Youssef El Idrissi B2 +212637891234 -600 MAD Active, Aya Benali A2 +212655443322 0 MAD Active, Omar Chraibi C1 +212677112233 -1200 MAD Active. Floating bulk actions bar when rows selected. Pagination 20 of 247. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'student-profile',
    folder: 'admin',
    prompt: `Student 360 profile page for Lango admin. Same sidebar. Top hero section: large 80px avatar, name "Fatima Zahra Benmoussa" H1, ID badge "#1024", Level badge "A1" blue, Status badge "Active" green, Edit Profile button, Generate ID Card button, Convert to Alumni destructive red button. Below hero: 6 horizontal tabs (Overview active, Personal Info, Enrollments, Attendance, Fees Ledger, Timeline). Overview tab: 4 stat cards (Attendance 92%, Current Balance 0 MAD, Enrolled Courses 1, GPA 16.5/20). Right sidebar 280px: Guardian "Hassan Benmoussa - Father" phone +212661234567 WhatsApp button. Attendance tab preview: monthly calendar heatmap with green/red/amber day squares. Fees Ledger tab: invoice rows with paid/overdue badges. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'student-enrollment-wizard',
    folder: 'admin',
    prompt: `New student enrollment wizard for Lango receptionist. Centered narrow layout max-w-2xl, no sidebar (full focus). Top step indicator: 4 steps with progress line: 1 "Personal Info" (active blue), 2 "Guardian", 3 "Class Enrollment", 4 "Invoice & Confirm". Step 1 form card: First name, Last name, Date of Birth date picker, Gender radio (Male/Female), Phone +212 prefix, Email, Nationality (Moroccan default), Photo upload drag-and-drop zone with camera icon. White card, border, generous padding. Previous/Next navigation at bottom with step counter "Step 1 of 4". ${DESIGN_SYSTEM}`,
  },

  // ─── ACADEMICS ───
  {
    id: 'class-timetable',
    folder: 'admin',
    prompt: `Class and timetable management for Lango admin. Same sidebar. Two-column layout: Left 320px panel with list of class batches (A1-Monday-Morning 18/20 students Sara teacher blue chip, A2-Wednesday-Eve 15/20 Karim amber chip, B1-Friday-Morning 20/20 Nadia green chip, B2-Thursday-Evening 12/20 Omar chip, C1-Advanced-Weekend 8/15 Ahmed chip) + Add Class button. Right panel: weekly timetable grid, Monday-Sunday columns, 8am-9pm time rows at 1-hour slots. Class blocks colored by level: A1=blue, A2=teal, B1=green, B2=amber, C1=purple. Each block shows class name, teacher, room. Week navigator header. Color legend. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'daily-attendance',
    folder: 'admin',
    prompt: `Daily attendance taking screen for Lango teacher. Minimal, high-speed UI. Header: Class selector dropdown "A1-Monday-Morning", Date picker "April 3 2026", progress "18 of 22 marked", Submit Attendance blue button right. Main list: one row per student, 32px avatar, full name, then 3 segmented toggle buttons [P] [A] [L]. Rows color: green background when P selected, red when A, amber when L. Students: Fatima Zahra (P green), Youssef El Idrissi (A red), Aya Benali (P green), Omar Chraibi (L amber), Sara Filali (P green), Hassan Moukrim (P green), Zineb Alami (unmarked). "All Present" quick button top right. Thin blue progress bar showing 82% complete. Floating bottom bar "4 students unmarked" + Submit button. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'marks-entry',
    folder: 'admin',
    prompt: `Exam marks entry grid for Lango teacher. Spreadsheet-style. Subheader: Exam dropdown "Term 1 Final", Class dropdown "B1-Friday-Morning", Subject dropdown "Speaking & Oral". Main grid table: students as rows (Fatima 85, Youssef 72, Aya 91, Omar 68, Sara 88), columns: Student Name (fixed left), Written /100, Oral /40, Participation /20, Total /160 (auto blue-50 background), Grade Letter badge (A green, B blue, C amber, D/F red). Column headers with max scores. Bottom row class averages. "Save Draft" ghost button + "Publish Results" primary button top right. "Auto-saved 2 min ago" status. ${DESIGN_SYSTEM}`,
  },

  // ─── FINANCE ───
  {
    id: 'fee-collection',
    folder: 'finance',
    prompt: `Fee collection counter screen for Lango receptionist. Two-panel layout. Left 360px: "Find Student" title, large autofocused search input "Search name or ID...", live results list (avatars + name + outstanding balance in red). Recent payments list below with timestamps. Right panel (student loaded): student mini-header Fatima Zahra avatar, A1 class badge, total outstanding "1,200 MAD" large red number. Invoice list: Term 1 Fee 1,200 MAD due Jan 1 outstanding 1,200 MAD Pay button, Registration Fee 200 MAD paid green checkmark. Payment form: Amount input (1200 pre-filled), Payment method toggle [Cash] [Stripe] [CMI], Reference note input, "Process Payment" blue CTA. After payment: green success state, receipt preview with amount date method receipt number, Print button. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'finance-overview',
    folder: 'finance',
    prompt: `Finance overview and income/expense tracking for Lango admin. Same sidebar. Top: 3 KPI cards (Total Income 87,400 MAD, Total Expenses 52,100 MAD, Net Profit 35,300 MAD green). Period selector row: This Month button active, Last Month, This Term, This Year, custom date range. Three tabs: Income (active), Expenses, P&L Report. Income tab: stacked bar chart showing Fee Payments, Course Sales, Other Income by month. DataTable below: date, description, category badge, source (student name), amount, receipt icon. Realistic data: April 3 Term 1 Fees Fatima Zahra 1200 MAD, April 2 Course Sale LMS Youssef 800 MAD. Export PDF + Export Excel buttons. ${DESIGN_SYSTEM}`,
  },

  // ─── CRM ───
  {
    id: 'crm-kanban',
    folder: 'crm',
    prompt: `CRM leads Kanban pipeline for Lango receptionist. Same admin sidebar. Page header "Leads Pipeline" H1, date filter, "Add Lead" blue button, search input. Full-width horizontally scrollable Kanban board with 5 columns: New (8 leads), Contacted (5), Trial Scheduled (3), Enrolled (12), Lost (2). Each column 280px with colored header and scrollable card stack. Lead cards (draggable): colored initials avatar (FB=blue, WhatsApp=green, Walk-in=zinc), lead name bold (Mohammed Alaoui, Salma Berrada, Khalid Tazi), course interest tag "B1 Level" "A2 Morning", days in stage (amber border if 3+ days "4 days - follow up"), source icon. Sample cards in each column with realistic Moroccan names. Drop shadows on dragging state. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'lead-profile',
    folder: 'crm',
    prompt: `Lead profile and activity log for Lango CRM. Two-column layout inside admin shell. Left 380px: large initials avatar "MA", name "Mohammed Alaoui" H2, phone +212661234567 click-to-call, email mohammed@gmail.com, Source badge "Facebook" blue, Course Interest "B1 Level" badge. Stage tracker: horizontal steps New > Contacted > Trial Scheduled > Enrolled > Lost (currently at Contacted). Action buttons: Call (green), Send WhatsApp (green), Schedule Trial (blue), Convert to Student (primary blue prominent). Tags: "Price Sensitive" "Parent Inquiry" chips. Right: Activity timeline (newest first): WhatsApp sent "Hello Mohammed..." 2h ago, Call logged 5min duration Interested 1 day ago, Stage changed New to Contacted 1 day ago, Lead created via Facebook 2 days ago. Add Note textarea at top. Log Call button. ${DESIGN_SYSTEM}`,
  },

  // ─── LMS ───
  {
    id: 'course-builder',
    folder: 'lms',
    prompt: `Course curriculum builder for Lango LMS instructor. Three-panel layout. Top bar: course title "English B1 Complete Course" editable, "Preview as Student" link, "Publish Course" blue button, "Saved" status. Left panel 280px: hierarchical tree - Chapter 1 Introduction (expanded): Lesson 1.1 Welcome Video (play icon), Lesson 1.2 Course Overview (file icon), Quiz 1.1 Entry Test (clipboard icon). Chapter 2 Present Tenses (collapsed). Chapter 3 collapsed. Add Section button bottom. Drag handles on items. Center: video lesson editor - upload zone "Drop video here or click to upload", thumbnail picker, title "Welcome to B1 English", description textarea, drip release toggle "Available immediately". Right 240px: lesson settings - duration 12:34, Free Preview toggle ON, Prerequisites none, Completion "Watch 90%". ${DESIGN_SYSTEM}`,
  },
  {
    id: 'video-player',
    folder: 'lms',
    prompt: `Video lesson player for Lango student portal. Dark theme (#0F172A background). Left 280px dark sidebar: course title "English B1 Complete Course" white, thin blue progress bar 35% complete. Lesson tree: Chapter 1 (expanded) - Lesson 1.1 (green checkmark completed), Lesson 1.2 (green checkmark), Quiz 1.1 (green), Chapter 2 (expanded) - Lesson 2.1 (active blue highlight "Present Simple"), Lesson 2.2 (locked gray). Chapter 3 locked. Center main: full-width video player with dark controls (play button, progress scrubber 4:20/12:34, volume, 1x speed dropdown, fullscreen). Below: "Present Simple Tense" H2, description text. Resources: PDF Grammar Notes (download icon), Practice Exercises.pdf. "Mark Complete & Next Lesson" blue button prominent. No top header, clean focus. ${DESIGN_SYSTEM} but dark background #0F172A for the shell.`,
  },
  {
    id: 'lms-storefront',
    folder: 'lms',
    prompt: `Public course catalog storefront for Lango. Sticky nav: Lango logo, nav links (Home, Courses, About, Contact), Login text link, "Enroll Now" blue CTA button, cart icon with badge. Hero banner: featured course card large (IELTS Preparation, 2,400 MAD, Enroll CTA). Course grid 3 columns below: filter sidebar left 240px (Level checkboxes A1/A2/B1/B2/C1, Schedule Morning/Evening/Weekend, Format Online/In-person). Course cards: illustration/icon, Level badge color-coded, "A1 Foundation English" title, "Mon/Wed/Fri Mornings" schedule, "1,200 MAD / term" price, "Enroll Now" button. 6 course cards visible. Realistic content. ${DESIGN_SYSTEM}`,
  },

  // ─── WHATSAPP ───
  {
    id: 'wa-inbox',
    folder: 'whatsapp',
    prompt: `WhatsApp shared inbox for Lango reception team. Three-pane layout full height. Left 320px thread list: search bar, filter tabs All/My Chats/Unassigned/Resolved. Thread items: contact avatar, name (Mohammed Alaoui, Salma Berrada, Sara Parent), last message preview truncated, timestamp (2h, 1d), unread badge blue number, assigned agent avatar small. Middle pane active chat: top bar contact name "Mohammed Alaoui" phone, status Online green dot, "Assign to" dropdown, "Resolve" button. WhatsApp-style message bubbles: received zinc-100 left, sent blue-100 right, timestamps. "Thinking about enrolling in B1..." conversation. Bottom input: text area, emoji, attachment, template selector, Send button. Right 300px CRM panel: contact avatar, "Mohammed Alaoui" name, "Lead - Contacted" badge, phone email, tags "Price Sensitive" chips, Notes textarea, "Open Lead Profile" button. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'wa-campaigns',
    folder: 'whatsapp',
    prompt: `WhatsApp broadcast campaign creator for Lango. 3-step wizard layout. Step 1 active "Select Template": search templates input, template cards (Welcome Message - Utility, Term Fee Reminder - Utility, New Course Launch - Marketing, Trial Invitation - Marketing), each card shows template name, category badge, preview text truncated, "Use" button. Right side: phone mockup showing selected template preview "Hello {{1}}, your invoice for...". Step 2 "Choose Audience" (upcoming): tag multi-select (A1 Students 45, B2 Students 32, All Active 247, Leads Interested 18), CSV upload zone alternative. "142 contacts selected, estimated 28 WA credits". Step 3 "Schedule": Send Now vs Schedule date picker. Step indicator top with numbers and connecting line. ${DESIGN_SYSTEM}`,
  },

  // ─── TEACHER PORTAL ───
  {
    id: 'teacher-dashboard',
    folder: 'teacher',
    prompt: `Teacher portal dashboard for Lango instructor Sara. Simpler sidebar: Dashboard (active), My Classes, Attendance, Grades, Lesson Plans, Calendar. Header: teacher avatar "Sara El Fassi", "Teacher" role badge. Main content: "Good morning, Sara" H1 + date. Today's schedule: 3 class cards horizontal - 09:00 A1-Monday-Morning 22 students room 1 "Start Session" button, 14:00 A2-Wednesday-Afternoon 18 students room 2, 18:00 B1-Evening 20 students online. Pending tasks column: Grade homework B1 group (due tomorrow), Submit lesson plan week 15 (due Friday), Attendance A2 missing (overdue red). Quick actions: 3 large icon-button cards "Take Attendance" (most prominent blue), "Add Grade", "Create Lesson Plan". Announcements: 2 notice items from director. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'class-session',
    folder: 'teacher',
    prompt: `Class attendance session for Lango teacher. Clean focused UI no sidebar. Header: "A1-Monday-Morning" class title, "April 3, 2026" date, "09:00-10:30" time, progress "18 of 22 marked", "End Session" button right. Main attendance list: one row per student: 32px circular avatar, full name, then segmented control with 3 buttons [P Present] [A Absent] [L Late]. Completed rows: Fatima Zahra (P green full row tint), Youssef (A red tint), Aya Benali (P green), Omar Chraibi (L amber tint), Sara Filali (P green), Hassan Moukrim (P green), Zineb Alami (L amber), 4 more students unmarked (neutral). "All Present" button top right. Thin progress bar 82% blue. Session notes textarea at bottom "Class session notes...". Sticky "Save & Submit Attendance" blue button bottom. ${DESIGN_SYSTEM}`,
  },

  // ─── STUDENT PORTAL ───
  {
    id: 'student-dashboard',
    folder: 'student',
    prompt: `Student portal dashboard for Lango. Top navigation bar (not sidebar): Lango logo, nav links My Courses, Calendar, Invoices, Profile. Greeting banner: "Hi, Fatima! Level: A1" with level progress indicator. 3 KPI cards: Next Class (Tomorrow 09:00 A1-Monday-Morning), Attendance Rate (92% this month green), Outstanding Balance (0 MAD green checkmark). Enrolled courses section: 2 course cards with progress bars - "A1 Foundation English" 65% complete blue progress, "Beginner Grammar Workbook" 40% complete. Upcoming homework list: Grammar Exercise 5 due Friday, Listening Practice due next Monday. Announcements: "End of term exams April 20-25" notice amber. Clean, friendly aesthetic slightly warmer than admin portal. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'student-invoices',
    folder: 'student',
    prompt: `Student invoices and billing page for Lango student Fatima. Same student top nav. Outstanding balance banner (green since 0 MAD): "All Paid! No outstanding invoices" green check. Invoice table: Invoice #1024, Term 1 2026 Fee, Jan 1 2026, 1,200 MAD, Paid 1,200 MAD, Status Paid green badge, Download Receipt icon. Invoice #1025, Registration Fee, Jan 1 2026, 200 MAD, Paid 200 MAD, Paid green. Invoice #1026, Term 2 2026 Fee, Apr 1 2026, 1,200 MAD, Paid 0 MAD, Overdue red badge, "Pay Now" blue CTA button prominent. Payment history mini chart below. Total paid this year: 1,400 MAD. ${DESIGN_SYSTEM}`,
  },

  // ─── PUBLIC WEBSITE ───
  {
    id: 'public-landing',
    folder: 'public',
    prompt: `Public landing/marketing page for Lango English Center in Casablanca, Morocco. Sticky header: Lango logo, nav links (Courses, About, Contact, Blog), "Student Login" text link, "Book a Free Trial" blue CTA button. Hero section: large bold H1 "Learn English with Confidence" slate-900, subtitle "Join 500+ students at Casablanca's premier English center. Flexible schedules, expert teachers, certified results." Two CTAs: "View Our Courses" blue primary + "Contact Us" outlined. Subtle geometric pattern background or classroom illustration. Stats row: 500+ Students, 10 Expert Teachers, 5 Levels A1-C1, 98% Success Rate. Features 3-column: Expert Native Teachers, Flexible Morning/Evening Schedules, Internationally Certified. Levels section: horizontal cards A1 Beginner through C1 Expert with brief descriptions. 3 student testimonials with Moroccan names and photos. Final CTA banner blue gradient "Start your English journey today" + Book Trial button. Footer: address Casa, phone, social icons. ${DESIGN_SYSTEM} but more marketing/landing page feel, warmer and more inviting.`,
  },
  {
    id: 'public-courses',
    folder: 'public',
    prompt: `Public course catalog page for Lango English Center website. Same sticky header. Page hero "Our English Courses" H1, subtitle, level filter pills (All active, A1, A2, B1, B2, C1) blue pills. Left filter sidebar 240px: Level checkboxes, Schedule (Morning/Evening/Weekend), Format (In-person/Online), Price range slider. Right course grid 3 columns: Course cards with colored level badge, course image/illustration, "A1 Foundation English" title H3, schedule "Mon Wed Fri 09:00-10:30", duration "3 months per term", "1,200 MAD / term" price, "Enroll Now" blue button. 6 course cards: A1 Foundation, A2 Elementary, B1 Intermediate, B2 Upper-Intermediate, C1 Advanced, IELTS Preparation. Clean marketing aesthetic. ${DESIGN_SYSTEM}`,
  },

  // ─── SETTINGS ───
  {
    id: 'admin-settings',
    folder: 'settings',
    prompt: `Admin settings page for Lango school admin. Same sidebar. Two-column layout: left 240px settings nav menu with categories (School Profile active, Roles & Permissions, Notifications, Integrations, Custom Fields, Audit Logs) each with icon and active blue left border. Right: School Profile settings panel - school name input "Lango English Center", upload logo zone, address "Boulevard Mohammed V, Casablanca", phone, email, timezone "Africa/Casablanca", current academic year "2025-2026", currency "MAD (Moroccan Dirham)". Save Changes button. Clean form layout with section dividers. ${DESIGN_SYSTEM}`,
  },
  {
    id: 'rbac-permissions',
    folder: 'settings',
    prompt: `Roles & Permissions management for Lango admin. Same sidebar + settings nav. Page: "Roles & Permissions" title. Left: Role list - Director (full access), Receptionist, Teacher, Student, Parent, HR Manager, Accountant, custom roles. "Add Role" button. Right: Permission matrix for selected role "Receptionist" - rows = permissions (View Students, Add Students, Delete Students, View Invoices, Process Payments, View Reports, Access CRM, Send WhatsApp), columns = resources. Checkbox grid. Role description editable. Save button. Clean table with zebra rows. ${DESIGN_SYSTEM}`,
  },
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        file.close();
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

function generateScreen(screen) {
  console.log(`\n⏳ Generating: ${screen.id}...`);
  const payload = JSON.stringify({
    projectId: PROJECT_ID,
    prompt: screen.prompt,
  });

  const tmpFile = `C:/tmp/stitch_${screen.id.replace(/-/g, '_')}.json`;
  fs.writeFileSync(tmpFile, payload, 'utf8');

  const cmd = `npx @_davideast/stitch-mcp tool generate_screen_from_text --data-file "${tmpFile}" --output json`;
  const result = spawnSync(cmd, {
    shell: true,
    env: { ...process.env, STITCH_API_KEY: API_KEY },
    timeout: 300000,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  try { fs.unlinkSync(tmpFile); } catch (_) {}

  if (result.status !== 0) {
    console.error(`❌ Failed ${screen.id}: ${result.stderr?.substring(0, 200)}`);
    return null;
  }

  try {
    return JSON.parse(result.stdout);
  } catch (e) {
    console.error(`❌ Parse error for ${screen.id}: ${result.stdout?.substring(0, 200)}`);
    return null;
  }
}

async function run() {
  console.log('🚀 Lango Stitch Batch Generator');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log(`🎨 Project: ${PROJECT_ID}`);
  console.log(`📱 Screens to generate: ${screens.length}\n`);

  const results = [];

  for (const screen of screens) {
    const folderPath = path.join(OUTPUT_DIR, screen.folder);
    fs.mkdirSync(folderPath, { recursive: true });

    const htmlPath = path.join(folderPath, `${screen.id}.html`);
    const pngPath = path.join(folderPath, `${screen.id}.png`);

    // Skip if already generated
    if (fs.existsSync(htmlPath) && fs.existsSync(pngPath)) {
      console.log(`⏭️  Skipping ${screen.id} (already exists)`);
      results.push({ id: screen.id, status: 'skipped' });
      continue;
    }

    const data = generateScreen(screen);
    if (!data) {
      results.push({ id: screen.id, status: 'failed' });
      continue;
    }

    // Extract screen data from outputComponents
    let screenData = null;
    let htmlUrl = null;
    let screenshotUrl = null;

    const components = data.outputComponents || [];
    for (const comp of components) {
      if (comp.design?.screens?.[0]) {
        screenData = comp.design.screens[0];
        htmlUrl = screenData.htmlCode?.downloadUrl;
        screenshotUrl = screenData.screenshot?.downloadUrl;
        break;
      }
    }

    if (!htmlUrl || !screenshotUrl) {
      console.error(`❌ No download URLs for ${screen.id}`);
      results.push({ id: screen.id, status: 'no-urls' });
      continue;
    }

    console.log(`  📥 Downloading HTML...`);
    try {
      await downloadFile(htmlUrl, htmlPath);
      console.log(`  ✅ HTML saved (${(fs.statSync(htmlPath).size / 1024).toFixed(1)}KB)`);
    } catch (e) {
      console.error(`  ❌ HTML download failed: ${e.message}`);
    }

    console.log(`  📸 Downloading screenshot...`);
    try {
      await downloadFile(screenshotUrl, pngPath);
      console.log(`  ✅ Screenshot saved (${(fs.statSync(pngPath).size / 1024).toFixed(1)}KB)`);
    } catch (e) {
      console.error(`  ❌ Screenshot download failed: ${e.message}`);
    }

    // Save metadata
    const meta = {
      id: screen.id,
      folder: screen.folder,
      screenId: screenData?.id,
      screenName: screenData?.name,
      generatedAt: new Date().toISOString(),
      htmlPath: htmlPath.replace(/\\/g, '/'),
      pngPath: pngPath.replace(/\\/g, '/'),
    };
    fs.writeFileSync(path.join(folderPath, `${screen.id}.meta.json`), JSON.stringify(meta, null, 2));

    results.push({ id: screen.id, status: 'success', ...meta });
    console.log(`  ✨ ${screen.id} complete!\n`);

    // Small delay to be respectful to the API
    await new Promise(r => setTimeout(r, 2000));
  }

  // Summary report
  const summary = {
    total: results.length,
    success: results.filter(r => r.status === 'success').length,
    skipped: results.filter(r => r.status === 'skipped').length,
    failed: results.filter(r => r.status === 'failed' || r.status === 'no-urls').length,
    screens: results,
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'generation-report.json'), JSON.stringify(summary, null, 2));

  console.log('\n─────────────────────────────────');
  console.log('📊 Generation Summary:');
  console.log(`  ✅ Success:  ${summary.success}`);
  console.log(`  ⏭️  Skipped:  ${summary.skipped}`);
  console.log(`  ❌ Failed:   ${summary.failed}`);
  console.log(`  📁 Report:   ${path.join(OUTPUT_DIR, 'generation-report.json')}`);
}

run().catch(console.error);
