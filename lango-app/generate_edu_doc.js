const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'edu.docs', 'phase-1-stabilization.html');

if (!fs.existsSync(path.dirname(targetFile))) {
    fs.mkdirSync(path.dirname(targetFile), { recursive: true });
}

const content = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Phase 1: Stabilization & Tech Debt Eradication · Edu Docs</title>

<!-- KaTeX — math rendering -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"
  onload="renderMathInElement(document.body,{
    delimiters:[
      {left:'$$',right:'$$',display:true},
      {left:'$',right:'$',display:false}
    ],
    throwOnError:false
  })"></script>

<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:16px;scroll-behavior:smooth}
:root{
  --paper:#f8f7f3;--surface:#ffffff;--ink:#1c1b18;--ink2:#3d3c38;
  --muted:#72716c;--accent:#1d4ed8;--accent-light:#eff6ff;
  --accent-mid:#3b82f6;--accent-border:#bfdbfe;--rule:#e2e1dc;
  --rule2:#d1cfc7;--code-bg:#f1f0ec;--sidebar-w:240px;
  --topbar-h:48px;--content-max:800px;
  --font-body:'Inter',system-ui,sans-serif;
  --font-mono:'JetBrains Mono',monospace;
}
body{
  font-family:var(--font-body);background:var(--paper);color:var(--ink);
  line-height:1.75;
  background-image:radial-gradient(circle,#c4c3bc 1px,transparent 1px);
  background-size:24px 24px;min-height:100vh;
}
.topbar{
  position:fixed;top:0;left:0;right:0;height:var(--topbar-h);
  background:var(--surface);border-bottom:1.5px solid var(--rule2);
  display:flex;align-items:center;justify-content:space-between;
  padding:0 28px;z-index:200;
}
.topbar-left{display:flex;align-items:center;gap:14px}
.topbar-pill{
  font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;
  color:#fff;background:var(--accent);padding:3px 10px;border-radius:3px;
}
.topbar-title{font-size:.82rem;font-weight:600;color:var(--ink)}
.topbar-right{font-size:.72rem;color:var(--muted);letter-spacing:.06em;text-transform:uppercase}
.layout{display:flex;padding-top:var(--topbar-h);min-height:100vh}
.sb{
  width:var(--sidebar-w);flex-shrink:0;position:sticky;top:var(--topbar-h);
  height:calc(100vh - var(--topbar-h));overflow-y:auto;
  background:var(--surface);border-right:1.5px solid var(--rule2);padding:24px 0;
}
.sb-label{
  font-size:.6rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted);padding:0 20px 6px;margin-top:16px;display:block;
}
.sb-link{
  display:block;font-size:.77rem;color:var(--muted);text-decoration:none;
  padding:5px 20px;border-left:2px solid transparent;
  transition:color .12s,border-color .12s,background .12s;line-height:1.35;
}
.main{flex:1;padding:48px 64px 100px;max-width:calc(var(--content-max) + 128px)}
.doc-header{margin-bottom:52px}
.doc-eyebrow{
  font-size:.67rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);display:flex;align-items:center;gap:8px;margin-bottom:14px;
}
.doc-eyebrow::before{content:'';display:block;width:18px;height:2px;background:var(--accent)}
.doc-title{font-size:2.3rem;font-weight:700;line-height:1.15;letter-spacing:-.02em;color:var(--ink);margin-bottom:10px}
.doc-subtitle{font-size:.95rem;color:var(--muted);font-weight:400;line-height:1.6;max-width:580px}
.doc-meta{display:flex;gap:24px;margin-top:20px;padding-top:20px;border-top:1.5px solid var(--rule2);flex-wrap:wrap}
.doc-meta-item{display:flex;flex-direction:column;gap:2px}
.doc-meta-label{font-size:.6rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.doc-meta-value{font-size:.8rem;font-weight:500;color:var(--ink2)}
.part-header{margin:52px 0 32px;padding:14px 20px;background:var(--ink);color:#fff;border-radius:4px}
.part-label{font-size:.6rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#9ca3af;margin-bottom:3px}
.part-title{font-size:1.05rem;font-weight:700}
.sec{margin-bottom:44px;scroll-margin-top:68px}
.sec-head{display:flex;align-items:baseline;gap:10px;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--rule2)}
.sec-num{
  font-size:.65rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
  color:#fff;background:var(--accent);padding:2px 8px;border-radius:2px;
  flex-shrink:0;font-family:var(--font-mono);
}
.sec-title{font-size:1.05rem;font-weight:700;color:var(--ink);letter-spacing:-.01em}
.sub-head{
  font-size:.68rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--accent);margin:22px 0 8px;display:flex;align-items:center;gap:8px;
}
.sub-head::after{content:'';flex:1;height:1px;background:var(--accent-border)}
p{margin-bottom:12px;font-size:.92rem;color:var(--ink2)}
strong{color:var(--ink);font-weight:600}
ul,ol{padding-left:20px;margin-bottom:12px}
li{font-size:.92rem;color:var(--ink2);margin-bottom:4px;line-height:1.6}
.cblock{
  background:var(--code-bg);border:1px solid var(--rule2);border-radius:4px;
  padding:16px 18px;margin:14px 0;font-family:var(--font-mono);font-size:.78rem;
  line-height:1.65;color:var(--ink);white-space:pre;overflow-x:auto;
}
.note-box{
  background:#fffbeb;border:1px solid #fde68a;border-left:3px solid #f59e0b;
  border-radius:0 4px 4px 0;padding:12px 18px;margin:14px 0;font-size:.86rem;color:#78350f;
}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:14px 0}
.card{background:var(--surface);border:1px solid var(--rule2);border-radius:4px;padding:16px}
.card-title{font-size:.65rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
</style>
</head>
<body>

<header class="topbar">
  <div class="topbar-left">
    <span class="topbar-pill">EDU DOC</span>
    <span class="topbar-title">Phase 1: Stabilization & Tech Debt Eradication</span>
  </div>
  <div class="topbar-left" style="gap:16px">
    <span class="topbar-right">Epioso Engineering</span>
  </div>
</header>

<div class="layout">
  <!-- Sidebar -->
  <nav class="sb" id="sb">
    <span class="sb-label">Part A — Context & Strategy</span>
    <a class="sb-link" href="#s-1">A.1 The Lango Architecture Transition</a>
    <a class="sb-link" href="#s-2">A.2 Drizzle ORM Schema Alignment</a>
    
    <div class="sb-divider"></div>
    
    <span class="sb-label">Part B — Technical Stabilization</span>
    <a class="sb-link" href="#s-3">B.1 TypeScript Strictness & NoEmit</a>
    <a class="sb-link" href="#s-4">B.2 Eliminating the finance.ts Mismatches</a>
    <a class="sb-link" href="#s-5">B.3 The GradingGridClientWrapper Fix</a>

    <div class="sb-divider"></div>

    <span class="sb-label">Part C — Next.js UX Engineering</span>
    <a class="sb-link" href="#s-6">C.1 Eliminating Dead UI Paths</a>
    <a class="sb-link" href="#s-7">C.2 Component Architecture: Modals & Data</a>
    <a class="sb-link" href="#s-8">C.3 Advanced PDF Generation on the Client</a>

    <div class="sb-divider"></div>

    <span class="sb-label">Part D — The Path Forward</span>
    <a class="sb-link" href="#s-9">D.1 Lessons Learned</a>
  </nav>

  <main class="main">

    <!-- Header -->
    <div class="doc-header">
      <div class="doc-eyebrow">Lango Open-Source Pivot</div>
      <h1 class="doc-title">Phase 1: Stabilization & Technical Debt Eradication</h1>
      <p class="doc-subtitle">A deep-dive educational teardown of the architectural shifts, TypeScript resolutions, and user experience fixes implemented to stabilize the Lango Application.</p>
      <div class="doc-meta">
        <div class="doc-meta-item"><span class="doc-meta-label">Date</span><span class="doc-meta-value">${new Date().toISOString().split('T')[0]}</span></div>
        <div class="doc-meta-item"><span class="doc-meta-label">Tags</span><span class="doc-meta-value">Next.js, TypeScript, Drizzle ORM, Client-Side PDFs</span></div>
      </div>
    </div>

    <!-- PART A -->
    <div class="part-header">
      <div class="part-label">Part A</div>
      <div class="part-title">Context & Strategy</div>
    </div>

    <section class="sec" id="s-1">
      <div class="sec-head">
        <span class="sec-num">A.1</span>
        <span class="sec-title">The Lango Architecture Transition</span>
      </div>
      <p>Before diving into the code, it is absolutely essential to understand the historical context of the codebase. The Lango project was initially heavily coupled to an "ixartz SaaS boilerplate" and elements of the Frappe schema. The fundamental problem was that it tried to merge two dramatically different paradigms: a generic B2B SaaS structure with a highly specialized Student Management / Learning Management System (LMS).</p>
      
      <p>This "Frankenstein Pivot" resulted in significant architectural friction. A SaaS boilerplate typically assumes entities like <code>Users</code>, <code>Teams</code>, <code>Subscriptions</code>, and <code>Plans</code>. An LMS, however, revolves around <code>Students</code>, <code>Courses</code>, <code>Enrollments</code>, <code>Guardians</code>, <code>Assessments</code>, and <code>Invoices</code>. When the database schema evolved to properly reflect the LMS reality (e.g., introducing the <code>courses</code> table and replacing abstract <code>studentGroups</code>), the application layer—specifically the TypeScript interfaces and Next.js Server Actions—was left in a shattered state, referencing properties and relations that no longer existed.</p>

      <p>The goal of Phase 1 was not to build new features, but to establish a foundation of absolute truth. We needed to guarantee that the application layer perfectly mirrored the data layer. In modern web development, an application is only as reliable as its types. If TypeScript thinks a property exists, but the database drops it, the application will compile but inevitably crash at runtime. This phase was about aligning the compiler, the ORM, and the UI.</p>
      
      <div class="note-box"><strong>Note:</strong> Technical debt is not just "bad code." In this context, the technical debt was architectural misalignment. The UI was making promises that the database could not keep. Eradicating this debt means making the UI honest.</div>
    </section>

    <section class="sec" id="s-2">
      <div class="sec-head">
        <span class="sec-num">A.2</span>
        <span class="sec-title">Drizzle ORM Schema Alignment</span>
      </div>
      <p>Drizzle ORM is uniquely powerful because it provides zero-compromise type safety from the SQL schema all the way to the frontend client. However, this power becomes a strict taskmaster when the schema changes underneath the application. In our case, the <code>src/models/Schema.ts</code> file underwent massive refactoring to represent the new Course-based model.</p>
      
      <p>For example, the old model relied on a concept called <code>studentGroupId</code> for tracking where a student belonged. The new model introduced <code>courses</code> and <code>programs</code>. Because Drizzle generates its types directly from the schema definitions (e.g., <code>typeof enrollments.$inferSelect</code>), any server action attempting to insert a <code>studentGroupId</code> into the <code>enrollments</code> table would immediately trigger a TypeScript error.</p>

      <p>This is where we must deeply understand the role of the ORM in a Next.js App Router environment. The ORM is not just a query builder; it is the boundary between the untyped chaos of SQL and the highly typed strictness of TypeScript. By ensuring that our <code>Schema.ts</code> was the sole source of truth, we were able to use the TypeScript compiler to hunt down every single file in the project that was still living in the past.</p>

      <div class="cblock">
// Old Problematic Code (Mental Model)
const enrollStudent = async (studentId: string, studentGroupId: string) => {
  // This fails because 'studentGroupId' is no longer in the schema!
  await db.insert(enrollments).values({
    studentId,
    studentGroupId, 
    status: 'active'
  });
};

// New Aligned Code (Mental Model)
const enrollStudent = async (studentId: string, courseId: string) => {
  // This succeeds because the schema dictates 'courseId'
  await db.insert(enrollments).values({
    studentId,
    courseId, 
    status: 'active',
    enrollmentDate: new Date()
  });
};
      </div>
    </section>

    <!-- PART B -->
    <div class="part-header">
      <div class="part-label">Part B</div>
      <div class="part-title">Technical Stabilization</div>
    </div>

    <section class="sec" id="s-3">
      <div class="sec-head">
        <span class="sec-num">B.1</span>
        <span class="sec-title">TypeScript Strictness & NoEmit</span>
      </div>
      <div class="sub-head">The Mental Model</div>
      <p>In a large Next.js project, it is very common to rely on the development server (<code>next dev</code>) to catch errors. However, Next.js can sometimes silently swallow type errors in Server Actions or deeply nested components until they are actually executed or built. To guarantee stabilization, we relied exclusively on <code>npx tsc --noEmit</code>.</p>
      
      <p>The <code>--noEmit</code> flag instructs the TypeScript compiler to perform a full type-check of the entire project without actually emitting any JavaScript files. This is the ultimate "truth serum" for a codebase. If <code>tsc --noEmit</code> passes, it means that every interface, every function parameter, every database query, and every React component prop is perfectly aligned according to the type definitions.</p>

      <div class="sub-head">Practical Application</div>
      <p>During Phase 1, we established a strict "Validation Gate." No code was considered "done" until <code>npx tsc --noEmit</code> returned zero errors. This process uncovered hundreds of hidden errors that were remnants of the boilerplate era.</p>
    </section>

    <section class="sec" id="s-4">
      <div class="sec-head">
        <span class="sec-num">B.2</span>
        <span class="sec-title">Eliminating the finance.ts Mismatches</span>
      </div>
      <p>One of the most complex areas of the application was the financial module, specifically the <code>src/actions/finance.ts</code> file. The schema had evolved, but the finance actions were completely disconnected from the new reality.</p>

      <p>We encountered severe <code>TS2339: Property does not exist on type</code> errors. For instance, the code was attempting to query <code>fee.frequency</code>, <code>fee.programId</code>, and <code>invoice.paidAt</code>. None of these columns existed in the updated Drizzle schema. The schema used <code>paymentDate</code> instead of <code>paidAt</code>, and fees were linked to <code>courseId</code> rather than <code>programId</code>.</p>
      
      <p>Furthermore, we encountered issues with Type Casting. PostgreSQL <code>numeric</code> and <code>decimal</code> columns are often returned by database drivers as string representations to preserve precision (since JavaScript numbers are floating-point and can lose precision). The UI, however, expected numbers for calculation. We had to carefully introduce explicit casting.</p>

      <div class="cblock">
// Deep Dive into the Finance Fix

// Original broken code:
const invoice = await db.query.invoices.findFirst({ ... });
const amount = invoice.amount; // Type: string (from Postgres numeric)
const total = amount + 50; // Bug! String concatenation: "100.0050"

// Stabilized code with explicit casting:
const invoice = await db.query.invoices.findFirst({ ... });
// We must explicitly cast to Number, acknowledging the precision tradeoff 
// in this specific UI context, or use a BigDecimal library if precision is critical.
const amount = Number(invoice.amount); 
const total = amount + 50; // Correct: 150
      </div>

      <p>We systematically went through every function in <code>finance.ts</code>, cross-referencing the property names with the actual exported \`schema\` variables from \`src/models/Schema.ts\`. This mechanical but crucial work is what bridges the gap between a prototype and a production-ready application.</p>
    </section>

    <section class="sec" id="s-5">
      <div class="sec-head">
        <span class="sec-num">B.3</span>
        <span class="sec-title">The GradingGridClientWrapper Fix</span>
      </div>
      <p>Another major roadblock was the <code>GradingGridClientWrapper.tsx</code> component. The error here was <code>TS18048: 'assessment' is possibly 'undefined'</code> and issues with <code>maxScore</code> parsing.</p>

      <p>This is a classic example of "optimistic rendering" failure. The component assumed that an assessment would always be passed to it, and that the assessment would always have a cleanly formatted <code>maxScore</code>. When the data fetching layer returned a slightly different shape (or null), the component crashed.</p>

      <p>We solved this by implementing defensive programming via **Optional Chaining** and explicit default fallbacks. Optional chaining (<code>?.</code>) allows us to safely access deeply nested properties without throwing a <code>TypeError: Cannot read properties of undefined</code> if an intermediate property is missing.</p>

      <div class="cblock">
// Deep Dive: Defensive Rendering

// The dangerous approach (Assumes perfection):
const maxScore = parseInt(assessment.maxScore);
// If assessment is undefined -&gt; CRASH
// If maxScore is null -&gt; NaN -&gt; CRASH in calculations

// The defensive approach (Stabilized):
// 1. Check if assessment exists
// 2. Ensure maxScore exists, fallback to '0' string before parsing
// 3. Parse safely to a number
const safeMaxScore = parseInt(assessment?.maxScore || '0', 10);
      </div>
    </section>


    <!-- PART C -->
    <div class="part-header">
      <div class="part-label">Part C</div>
      <div class="part-title">Next.js UX Engineering</div>
    </div>

    <section class="sec" id="s-6">
      <div class="sec-head">
        <span class="sec-num">C.1</span>
        <span class="sec-title">Eliminating Dead UI Paths</span>
      </div>
      <p>Technical debt isn't just about code that doesn't compile; it's also about a user interface that lies to the user. A "Dead UI Path" is a button, link, or tab that looks clickable and functional but actually does nothing, or worse, triggers a generic <code>alert('Not implemented')</code> or a silent console error.</p>

      <p>In the Student Profile view, several key actions were dead: <strong>Edit Profile</strong>, <strong>Enroll in Course</strong>, and the <strong>Certificate Download</strong> buttons. A core tenet of Phase 1 was "Honest UI." If a button exists, it must execute a complete vertical slice of functionality (Client Component -&gt; Server Action -&gt; Database -&gt; UI Revalidation). If the functionality cannot be built, the button must be removed.</p>

      <p>We chose to build the functionality.</p>
    </section>

    <section class="sec" id="s-7">
      <div class="sec-head">
        <span class="sec-num">C.2</span>
        <span class="sec-title">Component Architecture: Modals & Data</span>
      </div>
      <p>To wire the "Edit Profile" and "Enroll in Course" buttons, we needed to bridge the gap between Next.js React Server Components (RSC) and Client Components.</p>

      <p>The student profile page (<code>page.tsx</code>) is a Server Component. This is excellent for data fetching because it connects directly to the database without exposing an API endpoint. However, a Server Component cannot have interactivity (like <code>onClick</code> handlers or modal state). Therefore, we passed the fetched data down to a Client Component, <code>StudentProfileActionsClient.tsx</code>, which acts as the interactive shell.</p>

      <p>Inside <code>StudentProfileActionsClient.tsx</code>, we manage the state for our new modals: <code>EditStudentModal.tsx</code> and <code>StudentEnrollmentModal.tsx</code>. When a user submits these modals, the client component invokes a <strong>Server Action</strong>. The Server Action executes on the server, interacts with Drizzle ORM to mutate the database, and then calls <code>revalidatePath</code> to tell Next.js to flush the router cache and instantly update the UI.</p>

      <div class="cblock">
// Mental Model: Server Component to Client Component Handoff

// 1. page.tsx (Server Component) - Fetches data securely
const student = await getStudent(tenantId, id);
const allCourses = await listCourses(tenantId);

return (
  &lt;StudentProfileActionsClient 
    student={student} 
    courses={allCourses} 
  /&gt;
);

// 2. StudentProfileActionsClient.tsx (Client Component) - Handles State
"use client";
export function StudentProfileActionsClient({ student, courses }) {
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  
  return (
    &lt;&gt;
      &lt;button onClick={() =&gt; setIsEnrollModalOpen(true)}&gt;Enroll&lt;/button&gt;
      &lt;StudentEnrollmentModal 
        isOpen={isEnrollModalOpen} 
        courses={courses} // Passed down from server
        // ...
      /&gt;
    &lt;/&gt;
  );
}
      </div>

      <p>This architecture represents the modern Next.js App Router paradigm: heavily leverage the server for initial data hydration, use lightweight client components strictly for interactivity, and mutate data via Server Actions. We also removed the hardcoded placeholders in the Academics and Finance tabs, replacing them with the actual <code>enrollmentsList</code> and <code>invoicesList</code> arrays fetched in parallel via <code>Promise.all</code> at the top of the page.</p>
    </section>

    <section class="sec" id="s-8">
      <div class="sec-head">
        <span class="sec-num">C.3</span>
        <span class="sec-title">Advanced PDF Generation on the Client</span>
      </div>
      <p>Task 1.5 required us to fix the Certificate Download capability. The original code had a beautiful UI with a dead "Download" button. We needed a solution to generate PDFs of student certificates.</p>

      <p><strong>The Tradeoff: Server vs. Client Generation</strong></p>
      <p>We could have generated the PDF on the server using a headless browser (like Puppeteer) or a library like <code>pdfkit</code>. However, this is computationally expensive, requires specific server environments (fonts, binaries), and introduces significant latency. For an MVP stabilization phase, client-side generation is dramatically faster and easier to deploy.</p>

      <p><strong>The Implementation: html2canvas & jsPDF</strong></p>
      <p>We utilized a powerful combination: <code>html2canvas</code> and <code>jspdf</code>. The mental model is fascinating: we use JavaScript to create a hidden HTML <code>&lt;div&gt;</code> in the browser's Document Object Model (DOM). We apply inline CSS to style this div exactly like a printed certificate (using precise pixel measurements, borders, and typography). We then inject the dynamic data (Student Name, Course Name, Issue Date).</p>

      <p>Before the user can even blink, <code>html2canvas</code> takes a "screenshot" of this hidden, off-screen DOM element and converts it into a Base64 image data URL. Finally, <code>jspdf</code> creates a blank PDF document, pastes the image onto the canvas, and triggers a file download in the user's browser. Once the download begins, we immediately destroy the hidden div to prevent memory leaks.</p>

      <div class="cblock">
// Mental Model: Virtual DOM Rendering for PDFs

const handleDownload = async (record) => {
  // 1. Create a hidden element
  const certDiv = document.createElement("div");
  certDiv.style.position = "absolute";
  certDiv.style.left = "-9999px"; // Move off-screen
  certDiv.style.width = "800px";
  certDiv.style.height = "600px";
  
  // 2. Inject dynamic HTML
  certDiv.innerHTML = \`
    &lt;h1&gt;Certificate of Completion&lt;/h1&gt;
    &lt;h2&gt;\${record.courseName}&lt;/h2&gt;
  \`;
  document.body.appendChild(certDiv); // Must be in DOM to render

  // 3. Snapshot and Convert
  const canvas = await html2canvas(certDiv, { scale: 2 }); // High DPI
  const imgData = canvas.toDataURL("image/png");
  
  // 4. Generate PDF
  const pdf = new jsPDF({ orientation: "landscape", format: [800, 600] });
  pdf.addImage(imgData, "PNG", 0, 0, 800, 600);
  pdf.save(\`Certificate.pdf\`);

  // 5. Cleanup
  document.body.removeChild(certDiv);
};
      </div>
      <p>This implementation eliminates the dead button, provides immediate, tangible value to the user, and keeps the server architecture incredibly lightweight.</p>
    </section>

    <!-- PART D -->
    <div class="part-header">
      <div class="part-label">Part D</div>
      <div class="part-title">The Path Forward</div>
    </div>

    <section class="sec" id="s-9">
      <div class="sec-head">
        <span class="sec-num">D.1</span>
        <span class="sec-title">Lessons Learned</span>
      </div>
      <p>The completion of Phase 1 establishes a monumental baseline for the Lango project. By enforcing strict TypeScript compilation, we have proven that the data models and the application layer are in perfect harmony. By wiring the student profile modals and generating real client-side PDFs, we have proven that the UI is honest and capable.</p>
      
      <p>As we move into Phase 2 (Master Data Management), we carry these lessons forward:</p>
      <ul>
        <li><strong>Types are the contract.</strong> Never ignore a TS error; it is a warning from the future.</li>
        <li><strong>Server Actions require careful prop drilling.</strong> Server components fetch, client components interact.</li>
        <li><strong>Dead UI is UX debt.</strong> Only build what works, and make what works visible.</li>
      </ul>
      <p>The foundation is solid. The technical debt has been eradicated. The build is clean. Onward to Phase 2.</p>
    </section>

  </main>
</div>

</body>
</html>
`;

fs.writeFileSync(targetFile, content, 'utf8');
console.log(`Educational document successfully generated at ${targetFile}`);
