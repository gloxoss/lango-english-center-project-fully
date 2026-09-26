# 🏫 SchoolOS — Complete Agent Knowledge & Context Pack

> **Agent Onboarding & System Handoff Documentation**  
> **Version:** 2.4.0 (Production Live)  
> **Target Production VPS:** `43.157.17.129` (`https://schoolos.epioso.com`)  
> **Scope:** Multi-Tenant Moroccan School Management & SaaS Platform Architecture

---

## 🎯 Purpose of this Pack

This folder is a **self-contained, standalone context and architectural dossier** designed to give any AI agent, developer, or collaborator 100% complete understanding of the **SchoolOS** platform without requiring direct access to the full source code repository.

It consolidates all architectural invariants, module functionality and statuses, database schemas, UI design systems, security gates, operational playbooks, and relational graph maps into a structured, easily navigable bundle.

---

## 🧭 Navigation Index

| Document | Description |
| :--- | :--- |
| **[`01_ARCHITECTURE_AND_INVARIANTS.md`](./01_ARCHITECTURE_AND_INVARIANTS.md)** | Core multi-tenant isolation, Moroccan legal compliance (Law 09-08, /20 grading, CNSS/AMO/IR payroll, GSM-7), hosting & RAM invariants. |
| **[`02_SUBSYSTEMS_AND_MODULES_STATUS.md`](./02_SUBSYSTEMS_AND_MODULES_STATUS.md)** | Complete audit of all **40 subsystems and feature modules**: functionality, pages, APIs, database tables, operational health, and ratchet baselines. |
| **[`03_DATABASE_AND_RELATIONAL_SCHEMA.md`](./03_DATABASE_AND_RELATIONAL_SCHEMA.md)** | Drizzle ORM schema, 420+ tables, foreign key relations, tenant partitioning, indexes, and migration history. |
| **[`04_CODEBASE_STRUCTURE_AND_FILE_MAP.md`](./04_CODEBASE_STRUCTURE_AND_FILE_MAP.md)** | Complete directory hierarchy (`src/app`, `src/features`, `src/libs`), state management, server/client boundaries, and key utility libraries. |
| **[`05_UI_UX_DESIGN_SYSTEM_AND_TOKENS.md`](./05_UI_UX_DESIGN_SYSTEM_AND_TOKENS.md)** | Tailwind design tokens, Moroccan palette (`#2487B8`, `#059669`), typography, UI components, RTL Arabic support, and UI reality rules. |
| **[`06_SCALABILITY_AND_PERFORMANCE.md`](./06_SCALABILITY_AND_PERFORMANCE.md)** | Performance tuning, VPS memory constraints (1935MB RAM), connection pooling, anti-spam caching, and security enforcement. |
| **[`07_PROJECT_SKILLS_AND_OPERATIONAL_PLAYBOOKS.md`](./07_PROJECT_SKILLS_AND_OPERATIONAL_PLAYBOOKS.md)** | Rules (`AGENTS.md`), developer skills, quality gate commands (`check:types`, `check:ui`, `check:isolation`), and VPS deployment playbook. |
| **[`08_ROADMAP_AND_TARGET_OBJECTIVES.md`](./08_ROADMAP_AND_TARGET_OBJECTIVES.md)** | Production achievements, current status, active backlog, and future roadmap. |
| **[`graph/schoolos-architecture-diagrams.md`](./graph/schoolos-architecture-diagrams.md)** | Complete Mermaid diagrams: Architecture, Tenancy Pipeline, WhatsApp Multi-Session, Grading Engine, Payroll Engine. |
| **[`graph/schoolos-system-graph.json`](./graph/schoolos-system-graph.json)** | Machine-readable knowledge graph with 2,087+ nodes and 1,214+ architectural edges. |
| **[`graph/interactive-graph-viewer.html`](./graph/interactive-graph-viewer.html)** | Self-contained interactive HTML graph visualizer with live search and community clustering. |

---

## ⚡ Quick Ground Truth Facts

- **Framework**: Next.js 15 (App Router, Standalone Docker build, Node.js 22 LTS).
- **Language**: TypeScript 5.7 (Strict Mode, 0 errors).
- **ORM & Database**: Drizzle ORM + PostgreSQL 16 (Tenant-partitioned by `tenant_id`).
- **Schema**: `src/models/Schema.ts` — ~200 KB / ~8 400 lines. **147 applied migrations**.
- **Feature Modules**: **40 bounded-context modules** under `src/features/`.
- **App Route Groups**: `(auth)`, `(dashboard)`, `(alumni-portal)`, `(marketing)`, `(school-site)`.
- **API Namespaces**: 44 top-level route namespaces under `src/app/api/`.
- **Styling**: Tailwind CSS v4 + Curated Moroccan Design System tokens.
- **Languages / i18n**: Arabic (`ar`, RTL native), French (`fr`, LTR default), English (`en`).
- **Hosting**: Ubuntu VPS (`43.157.17.129`), Caddy Reverse Proxy, Docker Compose, 1,935 MB RAM.
- **Production URL**: `https://schoolos.epioso.com`
- **Last UltraPlan**: 30/30 tasks complete, deployed 2026-09-22.
