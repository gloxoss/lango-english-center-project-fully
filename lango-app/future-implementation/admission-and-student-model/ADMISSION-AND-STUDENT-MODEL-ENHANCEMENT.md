# Admission Flow & Student Model — Future Enhancement

**Status: not started, deliberately deferred.** This one is different from
the other `future-implementation/` items — it's not a new addon, it's
**closing gaps in core, already-shipped functionality** (the admission
wizard and the real student record it creates). Read `AGENT-HANDOFF.md`
first for overall project state.

## Why this exists

A field-by-field comparison (2026-08-01) against a reference product's
"Create Admission" form found our actual admission flow captures a much
smaller field set than it should, and one real bug (a document-upload
step that doesn't upload anything). Full findings below, verified by
reading the actual wizard component (`student-admission-view.tsx`) and
the actual approval transaction (`PUT /api/students/admissions`) — not
assumed.

**Explicit instruction driving this doc's shape**: not every field in the
reference product should be copied. Several are specific to a different
country's school-administration conventions and don't belong in a
Moroccan/international language-center context — called out explicitly
below with reasoning, not silently dropped.

## Real bugs to fix regardless of which new fields are added

These aren't "nice to have" — they're gaps in what already ships:

1. **The "Documents & consentements" wizard step is decorative.** It
   lists 6 required/optional documents (student photo, birth certificate,
   previous school certificate, guardian ID ×2, bulletins) but contains
   zero upload code — confirmed via direct grep, no `FormData`, no call
   to anything. Nothing a user attaches there is saved. The real upload
   endpoint this should call already exists
   (`src/app/api/students/documents/route.ts`, built for already-enrolled
   students) — this is a wiring gap, not a missing capability.
2. **No student login is created at admission.** The approval transaction
   creates a real `user` row with `role: 'student'` but no account
   credentials — an approved, enrolled student currently has no way to
   sign in until someone does that separately, through some other path.
3. **Guardian info is flat duplicate text, not a real link.** `applicants`
   and `user` both carry `guardianName`/`guardianPhone`/`guardianEmail`
   as plain columns, never connected to the real `guardians` /
   `guardianStudents` tables that already support richer data
   (occupation, address) and already power the working parent-linking UI
   elsewhere in the app (`parents-guardians-view.tsx`). A guardian
   entered at admission is invisible to that system entirely.

## Fields to add (and why each one genuinely earns its place)

| Field | Why |
|---|---|
| **Gender** | Column already exists on `user`, simply never captured. No reason not to. |
| **Academic Year** | `academicYears` table already exists — linking admission to a cohort is standard and useful for reporting (how many students admitted per year). |
| **Profile Picture** | `user.photoUrl` already exists; once the document-upload bug above is fixed, wiring the "student photo" document type straight to this column is nearly free. |
| **Nationality** | More relevant than the reference form's own fields for an "international" school context (see `subscription-licensing/`'s stated ambition) — SchoolOS likely serves both Moroccan and expat families; nationality is a normal, non-sensitive administrative field school systems legitimately track, unlike the excluded fields below. |
| **Mother Tongue** | Genuinely more useful *here* than in a generic school ERP — this is a language center. Knowing whether a student's first language is Arabic, French, Tamazight, or something else directly informs English-instruction placement. Worth adding specifically because of what this school does, not just because the reference form has it. |
| **City** | Reasonable, low-risk, useful for basic contact/administrative purposes. |
| **Blood group** | Optional only, not required — legitimate emergency-contact value (school trips, medical incidents), but it's health data, so: opt-in, never mandatory, and stored with the same care as any other sensitive field under this project's stated CNDP-compliance commitment. |
| **Real guardian linking** | Route admission-time guardian entry through the existing `guardians`/`guardianStudents` tables (create-or-link-existing, matching the pattern already built and working in `parents-guardians-view.tsx`) instead of flat duplicate columns. |
| **Student + guardian login creation at approval** | Generate credentials (or better: an invite-link / set-your-own-password flow rather than an admin typing a password on someone else's behalf) at the moment a student is approved, so they can actually access the system immediately. |

## Fields explicitly excluded — and why (this is the "shouldn't be added" part)

| Field | Why it's excluded |
|---|---|
| **Caste** | Specific to Indian school-administration and government reporting/quota requirements. Has no meaning or legitimate use in a Moroccan or general-international context — including it would be actively wrong, not just unnecessary. |
| **Category** (as a reservation/quota classification, paired with Caste in the reference) | Same reasoning as Caste — this pairing exists in the reference product specifically for Indian regulatory reporting. Not applicable here. |
| **Religion** | Legitimate schools do sometimes need this (e.g. dietary/observance accommodation), but it's a sensitive personal-data category, and this project has already committed to CNDP-law data-protection discipline elsewhere (see the CNDP compliance module). Don't add a sensitive-data field as a default/mandatory part of a general admission form without a specific, justified use case driving it — if a real need shows up later, add it deliberately then, with proper handling, not as a copy-paste from a reference form. |
| **"State"** | The reference product's form reflects Indian (or US) administrative geography. Morocco doesn't have "states" — it has regions/provinces/prefectures. Copying this field as-is would be meaningless to a Moroccan user filling out the form. If regional data is ever genuinely needed, model it as "Region" using Morocco's actual administrative divisions, not a direct copy of an inapplicable field. |
| **Transport Details / Hostel Details on the admission form** | Before building either: confirm these are actually relevant to this school's business model at all. SchoolOS is a language center — check whether it operates any bus routes or dormitories before speccing an admission-form section for services that may not exist. (Transport and Hostel are already tracked as possible future addons in `src/addons/registry.ts` if genuinely wanted — but that's a separate decision from whether the *admission form* needs a section for them.) |
| **Roll Number** (separate from the auto-generated matricule) | The reference form's "Roll" is typically a per-class-per-year sequential number, distinct from a permanent registration ID. Our `matricule` already serves as a real, permanent, unique student identifier. Adding a second, class-scoped number is only worth the complexity if there's a specific reporting requirement that needs it — don't add a second ID system speculatively. |

## Page-by-page plan (implementation-ready)

### Step 1 — "Informations élève" (existing step, extend in place)

Add: Gender (select), Academic Year (select, from real `academicYears`),
Nationality (text or a curated country list), Mother Tongue (text or a
small curated list — Arabic/French/Tamazight/English/Other covers the
realistic range for this context), City (text), Blood Group (select,
clearly marked optional).

### Step 2 — "Tuteur & contacts" (existing step, change the underlying behavior, not just add fields)

Add a **"Guardian already exists?"** search-and-link control (search real
`guardians` by name/phone, same pattern as the working
`parents-guardians-view.tsx` link flow) as the primary path, with
"create new guardian" as the fallback — instead of always creating flat
duplicate text. This is the single most important change in this whole
plan: it fixes real data integrity, not just adds a field.

### Step 3 — "Documents & consentements" (existing step, fix the real bug)

Wire actual file inputs to the real upload endpoint
(`src/app/api/students/documents/route.ts`) for each listed document
type. On successful upload of the "Photo d'identité" document
specifically, also set `user.photoUrl` once the student record exists
(this can only happen after Step 4's submission creates the `applicants`
row — either upload immediately against the applicant and copy the
reference forward at approval time, or defer photo upload until after
approval; the former matches how documents already work for enrolled
students and is the more consistent choice).

### Step 4 — "Validation & envoi" (existing step, no field changes, but the summary should reflect everything added above)

### New: Approval-time behavior (`PUT /api/students/admissions`, not a page but where the payoff happens)

- Copy the new fields from `applicants` onto the created `user` row
  (gender, nationality, motherTongue, city, bloodGroup — small schema
  additions on `user`, matching the existing flat-field pattern already
  used there for other student attributes).
- Link the real guardian record (from Step 2's search-or-create) via
  `guardianStudents`, not flat text.
- **Generate real login access** — recommend an invite-link email/SMS
  (reusing the existing log-only SMS convention if email isn't wired,
  or once it exists per `lead-crm-and-broadcast-messaging/`) that lets
  the student/guardian set their own password, rather than an admin
  typing one on their behalf and having to relay it somehow.

## Small schema additions this implies

`user`: `gender` already exists (just needs to be set); add `nationality`
(varchar), `motherTongue` (varchar), `bloodGroup` (varchar, nullable,
never required). No new tables needed — this is field-level, not a new
domain, unlike the other `future-implementation/` items.
