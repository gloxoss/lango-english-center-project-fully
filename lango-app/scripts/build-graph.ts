import fs from 'node:fs';
import path from 'node:path';

interface GraphNode {
  id: string;
  type: 'Page' | 'ApiRoute' | 'DbTable' | 'FeatureModule' | 'Service' | 'Role' | 'Capability' | 'Namespace';
  label: string;
  module: string;
  file?: string;
  metadata?: Record<string, any>;
}

interface GraphEdge {
  from: string;
  to: string;
  type: 'renders' | 'calls' | 'queries' | 'guards' | 'permits' | 'belongs_to' | 'references';
  description?: string;
}

interface KnowledgeGraph {
  generatedAt: string;
  stats: {
    totalNodes: number;
    totalEdges: number;
    nodeCounts: Record<string, number>;
    subsystemCount: number;
  };
  subsystems: Record<string, {
    description: string;
    pages: string[];
    apiRoutes: string[];
    tables: string[];
    services: string[];
  }>;
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const rootDir = path.resolve(__dirname, '..');
const srcDir = path.join(rootDir, 'src');

console.log('🚀 Starting SchoolOS Graph Context Extraction...');

const nodes: GraphNode[] = [];
const edges: GraphEdge[] = [];
const nodeSet = new Set<string>();

function addNode(node: GraphNode) {
  if (!nodeSet.has(node.id)) {
    nodeSet.add(node.id);
    nodes.push(node);
  }
}

function addEdge(edge: GraphEdge) {
  edges.push(edge);
}

// 1. Scan Database Schema
console.log('📦 Parsing Database Tables & Models...');
const schemaPath = path.join(srcDir, 'models', 'Schema.ts');
if (fs.existsSync(schemaPath)) {
  const content = fs.readFileSync(schemaPath, 'utf8');
  const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([^'"]+)['"]/g;
  let match;
  while ((match = tableRegex.exec(content)) !== null) {
    const varName = match[1];
    const tableName = match[2];
    if (!tableName) continue;
    const tableBlockRegex = new RegExp(`export\\s+const\\s+${varName}\\s*=\\s*pgTable\\([\\s\\S]*?\\n\\);`, 'g');
    const blockMatch = tableBlockRegex.exec(content);
    const block = blockMatch ? blockMatch[0] : '';
    const hasTenant = block.includes('tenantId') || block.includes('tenant_id');

    addNode({
      id: `table:${tableName}`,
      type: 'DbTable',
      label: tableName,
      module: 'database',
      file: 'src/models/Schema.ts',
      metadata: { varName, hasTenantIsolation: hasTenant }
    });
  }
}

// Also scan feature-specific models
const featuresDir = path.join(srcDir, 'features');
if (fs.existsSync(featuresDir)) {
  const features = fs.readdirSync(featuresDir);
  for (const feat of features) {
    const featModelDir = path.join(featuresDir, feat, 'models');
    if (fs.existsSync(featModelDir)) {
      const modelFiles = fs.readdirSync(featModelDir).filter(f => f.endsWith('.ts'));
      for (const mf of modelFiles) {
        const fullP = path.join(featModelDir, mf);
        const mContent = fs.readFileSync(fullP, 'utf8');
        const mTableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*['"]([^'"]+)['"]/g;
        let mMatch;
        while ((mMatch = mTableRegex.exec(mContent)) !== null) {
          const varName = mMatch[1];
          const tableName = mMatch[2];
          if (!tableName) continue;
          addNode({
            id: `table:${tableName}`,
            type: 'DbTable',
            label: tableName,
            module: feat,
            file: path.relative(rootDir, fullP),
            metadata: { varName, feature: feat }
          });
          addEdge({
            from: `module:${feat}`,
            to: `table:${tableName}`,
            type: 'belongs_to',
            description: `Database table managed by ${feat} module`
          });
        }
      }
    }
  }
}

// 2. Scan Roles and Permissions
console.log('🛡️ Parsing Roles, Portals, and Capability Matrix...');
const permPath = path.join(srcDir, 'libs', 'api', 'permissions.ts');
if (fs.existsSync(permPath)) {
  const content = fs.readFileSync(permPath, 'utf8');
  // Extract DEFAULT_ROLE_PERMISSIONS
  const roles = ['super_admin', 'school_admin', 'teacher', 'student', 'parent', 'accountant', 'librarian', 'guard', 'receptionist'];
  for (const role of roles) {
    addNode({
      id: `role:${role}`,
      type: 'Role',
      label: role,
      module: 'auth',
      file: 'src/libs/api/permissions.ts'
    });
  }
}

// 3. Scan API Routes
console.log('🌐 Parsing API Routes and Security Handlers...');
function walkDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const p = path.join(dir, file);
    if (fs.statSync(p).isDirectory()) {
      walkDir(p, fileList);
    } else if (file === 'route.ts' || file === 'page.tsx') {
      fileList.push(p);
    }
  }
  return fileList;
}

const apiDir = path.join(srcDir, 'app', 'api');
const apiFiles = walkDir(apiDir);
for (const af of apiFiles) {
  if (path.basename(af) === 'route.ts') {
    const rel = path.relative(apiDir, path.dirname(af)).replace(/\\/g, '/');
    const routePath = `/api/${rel}`;
    const content = fs.readFileSync(af, 'utf8');
    const methods: string[] = [];
    if (/export\s+(async\s+)?function\s+GET\b/.test(content)) methods.push('GET');
    if (/export\s+(async\s+)?function\s+POST\b/.test(content)) methods.push('POST');
    if (/export\s+(async\s+)?function\s+PUT\b/.test(content)) methods.push('PUT');
    if (/export\s+(async\s+)?function\s+DELETE\b/.test(content)) methods.push('DELETE');
    if (/export\s+(async\s+)?function\s+PATCH\b/.test(content)) methods.push('PATCH');

    const capMatch = content.match(/requireCapability\s*\(\s*\w+\s*,\s*['"]([^'"]+)['"]/);
    const capability = capMatch ? capMatch[1] : null;
    const hasAudit = content.includes('recordAudit(');
    const hasTenant = content.includes('requireTenant(') || content.includes('requireRequestContext(');

    const primaryModule = rel.split('/')[0] || 'general';

    addNode({
      id: `api:${routePath}`,
      type: 'ApiRoute',
      label: `${methods.join('|')} ${routePath}`,
      module: primaryModule,
      file: path.relative(rootDir, af),
      metadata: { methods, capability, hasAudit, hasTenant }
    });

    if (capability) {
      addNode({
        id: `capability:${capability}`,
        type: 'Capability',
        label: capability,
        module: primaryModule
      });
      addEdge({
        from: `api:${routePath}`,
        to: `capability:${capability}`,
        type: 'guards',
        description: `Route requires capability ${capability}`
      });
    }
  }
}

// 4. Scan Pages & Views
console.log('📑 Parsing UI Pages, Portals, and Component Tree...');
const appPagesDir = path.join(srcDir, 'app');
const pageFiles = walkDir(appPagesDir);
for (const pf of pageFiles) {
  if (path.basename(pf) === 'page.tsx') {
    const rel = path.relative(appPagesDir, pf).replace(/\\/g, '/');
    const content = fs.readFileSync(pf, 'utf8');

    // Determine clean route path
    let routePath = '/' + rel.replace('/page.tsx', '').replace(/\[locale\]\//g, '').replace(/\(dashboard\)\//g, '');
    let moduleName = 'core';
    if (routePath.includes('dashboard/')) {
      const splitAfter = routePath.split('dashboard/')[1];
      const parts = splitAfter ? splitAfter.split('/') : [];
      moduleName = parts[0] || 'dashboard';
    } else if (routePath.includes('portal/')) {
      moduleName = 'portals';
    }

    // Extract imported client view
    const viewImportMatch = content.match(/from\s+['"]@\/features\/([^/'"]+)\/ui\/([^'"]+)['"]/);
    const viewComponent = viewImportMatch ? viewImportMatch[2] : null;

    addNode({
      id: `page:${routePath}`,
      type: 'Page',
      label: routePath,
      module: moduleName,
      file: path.relative(rootDir, pf),
      metadata: { viewComponent }
    });

    if (viewComponent && viewImportMatch && viewImportMatch[1]) {
      const feat = viewImportMatch[1];
      const viewId = `view:${feat}/${viewComponent}`;
      addNode({
        id: viewId,
        type: 'Service',
        label: viewComponent,
        module: feat,
        file: `src/features/${feat}/ui/${viewComponent}.tsx`
      });
      addEdge({
        from: `page:${routePath}`,
        to: viewId,
        type: 'renders',
        description: `Page renders ${viewComponent}`
      });
    }
  }
}

// 5. Scan Feature Modules & Services
if (fs.existsSync(featuresDir)) {
  const feats = fs.readdirSync(featuresDir);
  for (const feat of feats) {
    const featPath = path.join(featuresDir, feat);
    if (fs.statSync(featPath).isDirectory()) {
      addNode({
        id: `module:${feat}`,
        type: 'FeatureModule',
        label: feat,
        module: feat,
        file: `src/features/${feat}`
      });

      // Scan services
      const srvDir = path.join(featPath, 'services');
      if (fs.existsSync(srvDir)) {
        const srvFiles = fs.readdirSync(srvDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
        for (const sf of srvFiles) {
          const srvId = `service:${feat}/${sf.replace('.ts', '')}`;
          addNode({
            id: srvId,
            type: 'Service',
            label: sf.replace('.ts', ''),
            module: feat,
            file: path.relative(rootDir, path.join(srvDir, sf))
          });
          addEdge({
            from: `module:${feat}`,
            to: srvId,
            type: 'belongs_to'
          });
        }
      }
    }
  }
}

// Group into Subsystems
const subsystems: Record<string, { description: string; pages: string[]; apiRoutes: string[]; tables: string[]; services: string[] }> = {
  'academics': {
    description: 'Academic years, filières, classes, subjects, rooms registry, and timetable solver',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'assessment': {
    description: 'Exam terms, grading sessions, Moroccan /20 grade engine, coefficients, and marksheet grid',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'students': {
    description: 'Student admission, student directory, Excel bulk import, matricules generation, promotions, and transfers',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'parent': {
    description: 'Parent guardian portal, linked children, fee payment, attendance timeline, and excuse requests',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'finance': {
    description: 'Tuition fee structures, cashier invoicing, online CMI/Stripe payments, expense vouchers, and accounting journals',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'hr': {
    description: 'Employee profiles, designations, contracts, departments, and credential lifecycle',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'workforce': {
    description: 'Time-clock attendance kiosk, overtime, salary advances, Moroccan CNSS/AMO/IR payroll engine, maker-checker payslips',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'guard': {
    description: 'Campus gate security kiosk, QR badge scanner, visitor passes, student pickup authorization, and emergency lockouts',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'hostel': {
    description: 'Residential hostels, wings, room categories, bed occupancy board, roll-call attendance, and leave passes',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'broadcast': {
    description: 'SMS/WhatsApp messaging gateway, GSM-7 encoding, segmented audiences, and consent compliance',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'library': {
    description: 'Library book catalog, barcode tracking, member borrowing, fines, and return tracking',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'reception': {
    description: 'Front desk visitor registry, incoming telephone call logs, and postal dispatch',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'documents': {
    description: 'Document Studio, WYSIWYG certificate template designer, barcode verification, and student ID cards',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'transport': {
    description: 'School bus fleet, drivers, routes, stop waypoints, GPS tracking, and parent pickup self-service',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'inventory': {
    description: 'School supplies stock, suppliers, purchase orders, reorder point alerts, and inventory issue requests',
    pages: [], apiRoutes: [], tables: [], services: []
  },
  'super-admin': {
    description: 'Multi-tenant school management, domain bindings, feature entitlements, licensing, and system telemetry',
    pages: [], apiRoutes: [], tables: [], services: []
  }
};

for (const n of nodes) {
  const m = n.module.toLowerCase();
  for (const [subKey, sub] of Object.entries(subsystems)) {
    if (m.includes(subKey) || n.id.includes(subKey)) {
      if (n.type === 'Page') sub.pages.push(n.label);
      if (n.type === 'ApiRoute') sub.apiRoutes.push(n.label);
      if (n.type === 'DbTable') sub.tables.push(n.label);
      if (n.type === 'Service') sub.services.push(n.label);
      break;
    }
  }
}

// Compute statistics
const nodeCounts: Record<string, number> = {};
for (const n of nodes) {
  nodeCounts[n.type] = (nodeCounts[n.type] || 0) + 1;
}

const graph: KnowledgeGraph = {
  generatedAt: new Date().toISOString(),
  stats: {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    nodeCounts,
    subsystemCount: Object.keys(subsystems).length
  },
  subsystems,
  nodes,
  edges
};

const outputDir = path.join(rootDir, 'knowledge-graph');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const graphJsonPath = path.join(outputDir, 'schoolos-graph.json');
fs.writeFileSync(graphJsonPath, JSON.stringify(graph, null, 2), 'utf8');
console.log(`✅ Saved Knowledge Graph JSON to: ${graphJsonPath}`);
console.log(`📊 Extracted ${nodes.length} nodes and ${edges.length} edges across ${Object.keys(subsystems).length} subsystems!`);

// Generate FULL_APP_CONTEXT.md
console.log('📝 Generating Master App Context Ground Truth Markdown...');

let md = `# SchoolOS Ground Truth & System Knowledge Graph

**Generated:** ${new Date().toISOString()}  
**Scope:** Complete Moroccan School Management & Multi-Tenant Platform Architecture  
**Ground Truth Stats:**
- **Total Graph Nodes:** ${nodes.length}
- **Total Architectural Edges:** ${edges.length}
- **Database Tables:** ${nodeCounts['DbTable'] || 0}
- **API Endpoints:** ${nodeCounts['ApiRoute'] || 0}
- **Dashboard & Portal Pages:** ${nodeCounts['Page'] || 0}
- **Core Subsystems:** ${Object.keys(subsystems).length}

---

## 🏛️ 1. Architecture & Security Invariants

### 1.1 Multi-Tenant Isolation
- **Row-Level Tenancy**: All institutional data resides in a single PostgreSQL database partitioned by \`tenant_id\` (\`tenants.id\`).
- **Enforcement Pipeline**:
  \`\`\`
  requireRequestContext(req, [roles]) -> requireTenant(ctx) -> requireCapability(ctx, 'perm.sub') -> Zod .strict() -> tenant-scoped Drizzle query -> recordAudit() -> apiErrorResponse()
  \`\`\`
- **Database Safety Invariant**: Every query mutating or selecting tenant records **must include** \`eq(table.tenantId, ctx.tenantId)\`. Cross-tenant leaks are strictly audited via \`scripts/check-tenant-isolation.ts\`.

### 1.2 Moroccan Regulatory & Legal Compliance
- **Law 09-08 (CNDP Data Privacy)**: 
  - All audit trails recorded with user, tenant, timestamp, and redacting sensitive PII.
  - Strict guardian consent flags required before student data/photos can be processed or published.
- **Moroccan Grading Standards**:
  - Grades evaluated strictly on the official national **/20 grading scale**.
  - Coefficients (\`coefficient\`) attached to subjects per Filière/Branch.
  - Exam term lifecycle: \`draft -> open -> locked -> published\`.
- **Moroccan Payroll & Tax Engine**:
  - CNSS calculation with statutory ceiling.
  - AMO health insurance mandatory withholding.
  - Impôt sur le Revenu (IR) progressive bracket deduction with Moroccan family deductions.
  - Moroccan bank export format for salary transfers.
- **Telecom & SMS Compliance**:
  - GSM-7 7-bit character encoding optimization for Moroccan telcos (Maroc Telecom, Inwi, Orange).
  - Explicit STOP/opt-out consent handling.

### 1.3 Production Deployment & Hosting Invariants
- **Host**: Production VPS \`43.157.17.129\` (\`https://schoolos.epioso.com\`).
- **RAM Constraint**: Host has 1,935 MB RAM shared across 5 services.
- **Strict Rule**: **NEVER run \`npm run build\` or build Docker images on the host.** Images must be built locally via Docker Desktop for \`--platform linux/amd64\` and deployed using \`npm run deploy:vps\` or \`deploy-vps.bat\`.

---

## 🧩 2. Core Subsystems Ground Truth

`;

for (const [key, sub] of Object.entries(subsystems)) {
  md += `### 2.${Object.keys(subsystems).indexOf(key) + 1} ${key.toUpperCase()} Subsystem
**Description:** ${sub.description}  
- **Registered Pages (${sub.pages.length}):**  
${sub.pages.map(p => `  - \`${p}\``).join('\n') || '  - None directly mapped'}
- **API Routes (${sub.apiRoutes.length}):**  
${sub.apiRoutes.map(a => `  - \`${a}\``).join('\n') || '  - Handled via composite APIs'}
- **Core Database Tables (${sub.tables.length}):**  
${sub.tables.map(t => `  - \`${t}\``).join('\n') || '  - Utilizes shared schema tables'}
- **Key Services:** ${sub.services.map(s => `\`${s}\``).join(', ') || 'Built-in Drizzle repositories'}

---
`;
}

md += `
## 🔍 3. Role & Capability Matrix

| Role | Default Access | Portal Route | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| **super_admin** | Global Platform | \`/dashboard/super-admin\` | Multi-tenant school creation, domain routing, subscription management, license keys |
| **school_admin** | Full School Scope | \`/dashboard\` | Complete institutional management, settings, academic calendar, staff, and finance |
| **teacher** | Assigned Classes | \`/dashboard/portals/teacher\` | Timetable, class rosters, attendance marking, /20 grade entry, homework |
| **student** | Enrolled Student | \`/dashboard/portals/student\` | My timetable, attendance history, term report cards, live classrooms |
| **parent** | Linked Children | \`/dashboard/portals/parent\` | Child overview, tuition fee payment, daily attendance, excuse submission |
| **guard** | Gate Station | \`/dashboard/portals/guard\` | Badge scanner kiosk, student pickups, visitor passes, emergency lockouts |
| **accountant** | Finance & Cashier | \`/dashboard/finance\` | Fee structures, invoices, fee collection desk, expense vouchers, Moroccan accounting export |
| **librarian** | School Library | \`/dashboard/library\` | Catalog search, barcode issuing, borrowing tracking, overdue fee management |
| **receptionist** | Front Desk | \`/dashboard/reception\` | Visitor check-in, phone call logs, mail dispatch, admission inquiries |

---

## ⚡ 4. How Any Agent Can Query This Knowledge Graph

You can instantly query this knowledge graph from the command line using the query engine:

\`\`\`bash
# Query any keyword, module, or concept
npx tsx scripts/graph-query.ts "hostel"

# Query specific subsystem
npx tsx scripts/graph-query.ts "payroll"

# Find paths between two concepts
npx tsx scripts/graph-query.ts path "guard" "attendance"

# Summary overview
npx tsx scripts/graph-query.ts stats
\`\`\`
`;

const mdPath = path.join(outputDir, 'FULL_APP_CONTEXT.md');
fs.writeFileSync(mdPath, md, 'utf8');
console.log(`✅ Saved FULL_APP_CONTEXT.md to: ${mdPath}`);

// Also copy to root AGENTS.md for universal AI Agent ingestion
const agentsMdPath = path.join(rootDir, '..', 'AGENTS.md');
const agentRules = `# SchoolOS AI Agent Ground Truth & Operational Rules

> **MANDATORY FOR ALL AI AGENTS**: Read this document first. This repository is **SchoolOS**, a multi-tenant Moroccan school management platform. All logic, database tables, and API routes are strictly regulated by the rules below.

${md}
`;
fs.writeFileSync(agentsMdPath, agentRules, 'utf8');
console.log(`✅ Saved universal AGENTS.md to: ${agentsMdPath}`);

console.log('🎉 SchoolOS Graph Context Extraction Complete!');
