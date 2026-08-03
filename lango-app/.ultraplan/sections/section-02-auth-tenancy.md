# Section 02: Drizzle Database Schema, Models & Better-Auth Tenancy

## Overview
Defines the complete Drizzle ORM schema (`src/models/Schema.ts`) matching `pre-dev/05-database-schema.md` and `PRODUCT-TRUTH.md`: `tenants`, `user`, `session`, `academic_years`, `programs`, `courses`, `student_groups`, `enrollments`, `attendance`, `fee_structures`, `invoices`, `payments`, `expenses`, `timetable_slots`, `grading_scales`, `assessment_plans`, `assessment_results`, `message_templates`, `reminder_batches`, `reminder_messages`, `cndp_declarations`. Integrates Better-Auth for role-based tenancy middleware and authentication handlers.

## Risk: `yellow` — Multi-tenant schema security

## Tasks

<task type="auto" id="02-01">
  <name>Define Complete Drizzle Database Schema</name>
  <files>src/models/Schema.ts</files>
  <action>
    Write comprehensive Drizzle PostgreSQL schema for all SchoolOS tables with foreign key relations and indexes on tenantId.
  </action>
  <verify>Run `npx drizzle-kit check` to validate schema syntax</verify>
  <done>Complete SchoolOS Drizzle schema defined</done>
</task>

<task type="auto" id="02-02">
  <name>Configure Database Connection Client</name>
  <files>src/libs/db/index.ts</files>
  <action>
    Initialize database connection using Drizzle ORM and node-postgres (`pg`) or PGLite for local dev.
  </action>
  <verify>Database client connects successfully</verify>
  <done>Database connection client established</done>
</task>

<task type="auto" id="02-03">
  <name>Configure Better-Auth Client & Server Handlers</name>
  <files>src/libs/auth/index.ts, src/app/api/auth/[...all]/route.ts</files>
  <action>
    Set up Better-Auth instance configured with Drizzle adapter, multi-tenancy headers, and 4 V1 roles (Director, Teacher, Accountant, Super Admin).
  </action>
  <verify>Auth route handler responds to GET/POST requests</verify>
  <done>Better-Auth server & API endpoints active</done>
</task>

<task type="auto" id="02-04">
  <name>Create Tenant Auth Middleware & Role Guard</name>
  <files>src/middleware.ts, src/features/auth/server/auth-guard.ts</files>
  <action>
    Implement Next.js middleware for locale routing (`next-intl`) and role-based tenant access control.
  </action>
  <verify>Protected routes redirect unauthorized users to login</verify>
  <done>Middleware & Role guards operational</done>
</task>

<task type="auto" id="02-05">
  <name>Create Seed Script for SchoolOS Roles & Sample Data</name>
  <files>src/scripts/seed-schoolos.ts</files>
  <action>
    Create seed script inserting sample tenant school, academic year, sample programs, teachers, and initial admin accounts.
  </action>
  <verify>Run seed script cleanly without errors</verify>
  <done>Seed script generated</done>
</task>
