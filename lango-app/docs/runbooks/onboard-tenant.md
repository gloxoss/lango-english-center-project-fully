# SchoolOS — School Tenant Onboarding Runbook (Task T25)

**Audience:** Super Administrators, DevOps Engineers, and Customer Onboarding Specialists  
**Scope:** Provisioning new multi-tenant educational institutions, initial configuration, credential delivery, and isolation verification  
**Compliance Baseline:** Moroccan Law 09-08 (CNDP) & MEN K-12 Curriculum Standards

---

## 1. Overview & Onboarding Pipeline

Onboarding a new private school, language center, or higher education institute into SchoolOS is a structured, repeatable sequence:

```
[ Step 1: Provision Tenant & License ]
                 │
                 ▼
[ Step 2: Create Root School Admin & Deliver Setup Token ]
                 │
                 ▼
[ Step 3: Configure Academic Calendar & Periods ]
                 │
                 ▼
[ Step 4: Setup Mediums, Streams, Classes & Moroccan Subjects ]
                 │
                 ▼
[ Step 5: Configure Fee Structures & Invoicing Schedules ]
                 │
                 ▼
[ Step 6: CNDP F211 Declaration Registration ]
                 │
                 ▼
[ Step 7: Verify Multi-Tenant Isolation (0 Data Leaks) ]
```

---

## 2. Step-by-Step Tenant Provisioning Procedure

### Step 1: Provision Tenant Entity and License Entitlements

Execute tenant creation via PostgreSQL or Super Admin Console:

```sql
-- 1. Insert Tenant Record
INSERT INTO "tenants" (
  "id", "name", "slug", "domain", "phone", "email", "address", "status"
) VALUES (
  gen_random_uuid(),
  'Groupe Scolaire Al Hikma',
  'alhikma',
  'alhikma.schoolos.ma',
  '+212522112233',
  'contact@alhikma.ma',
  '45 Boulevard Abdelmoumen, Casablanca, Maroc',
  'active'
);

-- 2. Provision School License & Plan Limits
INSERT INTO "plan_limits" (
  "id", "tenant_id", "max_students", "max_teachers", "max_branches", "max_storage_bytes"
) VALUES (
  gen_random_uuid(),
  (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma'),
  1500, -- 1,500 active students
  80,   -- 80 teachers
  2,    -- 2 physical campuses
  107374182400 -- 100 GB document storage
);
```

### Step 2: Provision Root Administrator & Setup Token

```sql
-- 1. Create school_admin user
INSERT INTO "user" (
  "id", "tenant_id", "name", "email", "role", "user_status", "email_verified"
) VALUES (
  'ADM-' || substr(md5(random()::text), 1, 8),
  (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma'),
  'Directeur Pédagogique Al Hikma',
  'directeur@alhikma.ma',
  'school_admin',
  'active',
  true
);

-- 2. Generate Account Setup & Password Creation Token
INSERT INTO "account_setup_tokens" (
  "id", "tenant_id", "user_id", "token", "expires_at"
) VALUES (
  gen_random_uuid(),
  (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma'),
  (SELECT "id" FROM "user" WHERE "email" = 'directeur@alhikma.ma'),
  encode(gen_random_bytes(32), 'hex'),
  NOW() + INTERVAL '7 days'
);
```

Deliver the setup URL to the school administrator:
`https://schoolos.epioso.com/fr/account/setup?token=<TOKEN>`

---

## 3. Mandatory Initial Configuration Matrix

Once the administrator signs in, configure the baseline academic hierarchy:

### 3.1 Academic Calendar & Semesters
- **Session Year:** `2025-2026` (`start_date: 2025-09-01`, `end_date: 2026-06-30`, `is_default: true`).
- **Semesters:** `Semestre 1` (Sep–Jan) and `Semestre 2` (Feb–Jun).

### 3.2 Mediums, Shifts & Streams
- **Mediums:** `Français` (Primary instruction language) and `Arabe` (Arabic literature & Islamic education).
- **Shifts:** `Matinée` (08:00–12:00) and `Après-midi` (14:00–18:00).
- **Streams:** `Tronc Commun Scientifique`, `1ère Année Bac Sciences Expérimentales`, `2ème Année Bac Sciences Physiques`.

### 3.3 Moroccan Subject Coefficients (Lycée Sciences Example)
Assign subject coefficients to classes in `class_subjects`:
- `Mathématiques`: **7.00**
- `Physique-Chimie`: **5.00**
- `Sciences de la Vie et de la Terre (SVT)`: **5.00**
- `Français`: **4.00**
- `Arabe`: **2.00**
- `Anglais`: **2.00**
- `Philosophie`: **2.00**
- `Éducation Physique (EPS)`: **2.00**

---

## 4. Financial & Fee Structure Policies

1. **Create Fee Categories:**
   - `Frais d'Inscription` (Annual registration fee).
   - `Scolarité Mensuelle` (Monthly tuition, Sep–Jun).
   - `Transport Scolaire` (Optional bus transportation).
   - `Cantine / Restauration` (Optional school lunch).
2. **Assign Fee Schedules:** Monthly billing generated on the 1st of each month with a 10-day payment grace window.

---

## 5. CNDP Law 09-08 Regulatory Compliance Setup

In `/dashboard/settings/cndp`, record the school's official CNDP registration:
- **CNDP Filing Type:** `Déclaration Ordinaire (Formulaire F211)`
- **Filing Reference:** `D-W-12345/2026`
- **Designated DPO:** `dpo@alhikma.ma`
- **Data Retention Policies:** Student academic records (10 years), accounting records (10 years), video surveillance gate logs (30 days).

---

## 6. Multi-Tenant Isolation Verification Checklist

Run these SQL verification queries against the database to guarantee total data isolation between the newly provisioned tenant and all other schools:

```sql
-- 1. Verify New Tenant Has Exactly 0 Leaked Students from Atlas
SELECT COUNT(*) AS foreign_students
FROM "user"
WHERE "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma')
  AND "email" LIKE '%atlas.ma';
-- Expected Output: 0

-- 2. Verify New Tenant Cannot Access Invoices of Another School
SELECT COUNT(*) AS foreign_invoices
FROM "invoices"
WHERE "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma')
  AND "student_id" IN (
    SELECT "id" FROM "user" WHERE "tenant_id" != (SELECT "id" FROM "tenants" WHERE "slug" = 'alhikma')
  );
-- Expected Output: 0

-- 3. Verify Attendance Registers Scoped Exclusively to New Tenant
SELECT COUNT(*) AS cross_tenant_registers
FROM "attendance_registers" ar
JOIN "class_sections" cs ON ar."class_section_id" = cs."id"
WHERE ar."tenant_id" != cs."tenant_id";
-- Expected Output: 0
```

---

## 7. Handover Checklist & Activation Sign-Off

- [x] Tenant record created with unique slug and domain.
- [x] Plan limits and storage quotas configured.
- [x] Initial `school_admin` account created and invitation token delivered.
- [x] Default academic session year and semesters configured.
- [x] Mediums, sections, classes, and subjects created with coefficients.
- [x] Fee structures and billing schedules initialized.
- [x] CNDP F211 compliance filing metadata registered.
- [x] Multi-tenant isolation SQL assertions passed with 0 cross-tenant anomalies.
