---
name: lango-sms-context
description: Use this skill whenever the user asks to continue, rebuild, audit, plan, design, or implement the Lango English Center SaaS Platform (SMS, LMS, CRM, ERP). Make sure to use this skill whenever the user mentions Lango, school management, Next.js frontend for Lango, NestJS backend, or wants to check the Lango architecture/blueprint.
---

# Lango English Center SaaS Context

Use this skill whenever the user asks to continue, rebuild, audit, plan, design, or implement the **Lango English Center SaaS Platform**. This skill acts as the project memory for future sessions and agents, preserving the conversation context, target product, architecture, design rules, and development progress.

---

## User Context

The user is **Oussama Zaki**, also using the identity **Zakio**. He is a software engineer and founder building this project. His goal is to use AI to accelerate code creation while maintaining full understanding of the logic.

When assisting him:
- Move fast, but explain architecture and logic clearly.
- Treat AI as an accelerator, not a replacement for engineering judgment.
- Produce implementation that he can inspect, understand, and continue manually.
- Prioritize high-end design, strict type safety, and clean architecture.

---

## Product Target

The project is **Lango English Center SaaS Platform**.
It is a comprehensive School Management System (SMS) with modular add-ons (LMS, WhatsApp CRM, ERP). Initially built as a single-tenant MVP for a specific client in Casablanca, Morocco, but architected from Day 1 to be a **Multi-Tenant SaaS**.

Target behavior:
- Handle 7 different user portals (Super Admin, School Admin, Teacher, Student, Parent, Public, Auth).
- Multi-tenancy strictly enforced at the database level (`tenant_id`) and via API Middleware.
- RESTful resource-oriented API design.
- Asynchronous task processing (PDF generation, WhatsApp automation) via Redis + BullMQ.
- Localized for MENA (EN, FR, AR/Darija with strict RTL support).

---

## Repositories & Important Paths

Main workspace:
`D:\Users\zakio\Desktop\Lango english center project fully`

Core directories:
- **`pre-dev/`**: Contains the source-of-truth documents (PRD, SRS, C4 Diagrams, UI/UX specs, API specifications).
- **`apps/api/`**: NestJS backend modular monolith.
- **`apps/web/`** (or `lango-app/`): Next.js App Router frontend.
- **`design/`**: HTML/CSS UI prototypes and reference `.png` mockups.
- **`graphify-out/`**: Contains the AST Knowledge Graph `GRAPH_REPORT.md` and `graph.html`.
- **`.gemini/antigravity/brain/.../artifacts/lango_full_audit.md`**: The exhaustive pre-dev audit.

---

## Current Development State & Progress

Always read `pre-dev/BLUEPRINT.md` and `pre-dev/PROGRESS.md` to know the current state.
**Pre-dev Phases 0-4 are Complete.**
**Current Phase:** Phase 1 (Environment & Scaffolding) -> Phase 2 (Core Auth & Tenants).

- Docker infrastructure (Postgres 16, Redis, Traefik) `docker-compose.yml` is prepared.
- NestJS backend is initialized with Drizzle ORM connected to PostgreSQL.
- The first Drizzle migrations (`tenants` and `users`) are generated.
- Next.js frontend has a basic structural layout (AdminShell, landing page) using shadcn/ui.

---

## Mandatory Development Principles (Dynamic-First)

Follow these principles rigorously:

1. **Epioso Dynamic-First Architecture**: 
   - NEVER hardcode text, image URLs, or arrays directly into JSX/TSX layouts.
   - Build UI components as "Dumb Components" that only receive props.
   - Data must come from an API, database, or at least a central JSON file (`/data/*.json`) to mimic a Headless CMS until the backend is fully wired.
   - Smart wrappers (Next.js Server Components) fetch the data and pass it to UI elements.
2. **NestJS Modular Monolith**: Enforce strict module boundaries.
3. **Database**: Use Drizzle ORM. Always generate up/down migrations. No implicit cross-module queries bypassing services.
4. **Next.js App Router**: Server Components by default. Client components only for interactive islands.
5. **Tailwind v4 CSS-First**: Use `cn()` for classes. 

---

## UI Direction & Design Taste

Design philosophy: "Nível Apple" (Apple-level) — radical simplicity, high-density dashboarding, zero cognitive load.

- **Stack**: Tailwind CSS v4, shadcn/ui, Lucide Icons, Inter font.
- Focus on premium layout structures, clear typography, and subtle interactions (Framer Motion for micro-animations).
- Match the `design/*.png` and `.html` prototypes pixel-for-pixel.

**Design Taste Reference Skills to Follow:**
- `emil-design-eng`
- `brandkit`
- `gpt-taste`
- `image-to-code`
- `imagegen-frontend-web`
- `imagegen-frontend-mobile`
- `minimalist-ui`
- `industrial-brutalist-ui`
- `redesign-existing-projects`
- `high-end-visual-design`
- `stitch-design-taste`
- `design-taste-frontend`
- `design-taste-frontend-v1`
- `full-output-enforcement`
- `impeccable`

---

## Security Model

- **Authentication**: JWT via HttpOnly secure cookies for Web. Bearer tokens for Mobile/Desktop.
- **RBAC**: Dynamic role matrix (SuperAdmin, Admin, Teacher, Student, Parent, Support).
- **Tenant Isolation**: Every backend entity must strictly validate against `@Tenant()` scope.
- **Validation**: Use `class-validator` DTOs on every endpoint. No direct entity exposure.

---

## AGY Workflow & Code Graph

When executing massive structural changes or investigating dependencies:
- Check the AST Knowledge Graph inside `graphify-out/GRAPH_REPORT.md` to see module linkages, God nodes, and dependencies.
- You can navigate the graph visually via `graphify-out/graph.html`.

For delegating work, use the Orchestrator + Executor Pattern (AGY Builder).
1. Plan the implementation.
2. Delegate the specific scoped task to an agent/agy.
3. Validate the implementation against `pre-dev/03-architecture-validation-checklist.md`.
