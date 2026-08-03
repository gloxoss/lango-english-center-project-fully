# SERVER & DATABASE SETUP AGENT BRIEFING

You are tasked with deploying and configuring the production database server and hosting environment for **SchoolOS / Lango Multi-Tenant School Management System**.

---

## 1. PROJECT ARCHITECTURE & STACK OVERVIEW
- **Frontend/Backend App**: Next.js 15 App Router (`src/app`), TypeScript, Tailwind CSS, shadcn/ui primitives.
- **Reference Architecture**: Replicated from ESchool SaaS 1.6.0.
- **Multi-Tenancy**: Scoped by `school_id` across all 48 relational database tables.
- **Port**: `3000` (Next.js Application Server)
- **DB Engine**: MySQL 8.0 / MariaDB (or PostgreSQL)

---

## 2. DATABASE SCHEMA REQUIREMENTS
The full production database DDL schema is provided in 2 locations:
1. `insperations/eschool_saas_full_schema.sql`
2. `insperations/ESCHOOL_SAAS_DATABASE_SCHEMA.md`

### Core Table Groups:
1. **Multi-Tenancy & School Management**: `schools`, `session_years`, `semesters`, `mediums`, `sections`, `streams`, `shifts`, `classes`, `class_sections`.
2. **User Base & Staff**: `users`, `staffs`, `class_teachers`, `subject_teachers`.
3. **Student Base**: `students`, `student_subjects`, `promote_students`, `guardians`, `admission_requests`, `transfers`.
4. **Academics & Attendance**: `subjects`, `elective_subject_groups`, `class_subjects`, `attendances`, `timetables`.
5. **Finance & Billing**: `fees_types`, `fees`, `fees_paids`, `invoices`, `payment_transactions`.

---

## 3. DEPLOYMENT INSTRUCTIONS

### Option A: Using Docker & Docker Compose (Recommended)
1. Navigate to the project root:
   ```bash
   cd lango-app
   ```
2. Start the application and database containers:
   ```bash
   docker-compose up -d --build
   ```
3. Verify containers are healthy:
   ```bash
   docker ps
   ```
4. Access the application on `http://localhost:3000` or server IP.

### Option B: Native Server Setup (Nginx + PM2 + MySQL)
1. **Import Database Schema**:
   ```bash
   mysql -u root -p -e "CREATE DATABASE schoolos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p schoolos < ../insperations/eschool_saas_full_schema.sql
   ```
2. **Build and Run App**:
   ```bash
   npm ci --legacy-peer-deps
   npm run build
   pm2 start npm --name "schoolos-app" -- start
   ```

---

## 4. ENVIRONMENT VARIABLES (`.env.production`)
```env
NODE_ENV=production
PORT=3000
DATABASE_URL="mysql://schoolos_user:schoolos_password@localhost:3306/schoolos"
NEXTAUTH_SECRET="your-32-character-secret-key"
NEXTAUTH_URL="https://your-domain.com"
```
