# 🗺️ Roadmap & Target Objectives

## 1. Production Achievements (Currently Live)

SchoolOS is currently operating live in production on VPS `43.157.17.129` (`https://schoolos.epioso.com`). The following milestones are fully completed, tested, and active:

> **Last UltraPlan cycle**: 30/30 tasks complete. Latest migration: `0146+`. All items below confirmed deployed.

- ✅ **Full Multi-Tenancy Architecture**: Complete database row-level partitioning with strict static analysis gates.
- ✅ **Moroccan Regulatory Compliance**:
  - Official Moroccan **/20 grading engine** with Filière-specific subject coefficients.
  - Moroccan Labor & Tax engine: Statutory **CNSS (6 000 DH cap)**, AMO withholding, progressive **IR tax brackets**, and family dependent abatements.
  - **Massar System Integration**: Import/export compatibility with Ministry of National Education rosters and marksheets.
  - **GSM-7 SMS Direct Engine**: Moroccan carrier character normalization and credit simulation.
- ✅ **WhatsApp Multi-Session & Meta Anti-Ban Protection**:
  - Automatic per-school session isolation (`tenant_{tenantId}`) on the WAHA gateway.
  - Tiered daily quotas (Trial: 25, Basic: 50, Standard: 100, Premium: 250 msg/day).
  - 1 200 ms pacing delay between dispatches.
  - Automatic cut-off (HTTP 429) to prevent bulk spam and phone number bans.
- ✅ **Multi-Channel Reminders Hub**:
  - Filter by "Élèves à risque" (absences/impayés) vs "Tous les élèves".
  - 1-click preset templates (Absence injustifiée, Retard, Rappel scolarité, Convocation).
  - Personal smartphone test dispatch modal.
- ✅ **Document Studio & Official School Seal**:
  - Circular bilingual school stamp (Cachet Officiel) generator matching Ministry standards.
  - Attestation d'inscription, Certificat de scolarité, Bulletins scolaires.
  - MEN authorization columns and official stamp fields added (migration 0144).
- ✅ **Custom Domains & Automated TLS**:
  - Dynamic on-demand SSL certificate generation via Caddy reverse proxy.
- ✅ **Super Admin Multi-School Console**:
  - School tenant provisioning, subscription plan management, feature entitlement toggling.
- ✅ **Full Timetable Solver** _(shipped — UltraPlan Section confirmed)_:
  - Interactive timetable with room conflict detection, teacher availability constraints, and shift policies.
  - Real-time collision warnings. Replaces the previous static schedule grid.
- ✅ **Automated Year-End Promotions with Conseil de Classe** _(shipped — UltraPlan Section confirmed)_:
  - Automated mass promotion wizard with deliberation council logic.
  - Balanced class placement algorithm for new academic year assignments.
- ✅ **Alumni Student Life-Cycle** _(shipped)_:
  - Alumni portal route group `(alumni-portal)` with full alumni directory and enriched detail views.
- ✅ **School Gate / Guard Security Kiosk** _(shipped)_:
  - Dedicated `guard` feature with check-in models, services, and UI.
- ✅ **Live Classrooms Engine** _(shipped)_:
  - `live-classrooms` feature with providers, services, models, and UI. Real-time class delivery layer.
- ✅ **CRM for Prospects & Leads** _(shipped)_:
  - `crm` feature with data, services, UI and tests. Lead intake and conversion pipeline.
- ✅ **Library Management** _(shipped)_:
  - `library` feature with API, models, services, and UI layer.
- ✅ **School Public Website Builder** _(shipped)_:
  - `website` feature with models, services, UI and tests. `(school-site)` route group for public-facing school pages.

---

## 2. Active Backlog & Next Target Milestones

### Phase 1: High-Priority Operational Enhancements
1. **CMI Moroccan Gateway Live Merchant Credentials Wizard**:
   - Self-service portal interface for schools to upload their Centre Monétique Interbancaire (CMI) production merchant certificates (`cert.pem`, `key.pem`) for live online card processing. Currently in staging configuration only.
2. **Automated Massar Roster Synchronization Cron**:
   - Background sync job to check and import newly enrolled students from Massar without manual CSV re-upload. The import tool exists; the scheduled automation does not yet.
3. **Inventory & Library Full Operational Rollout**:
   - `inventory` and `library` modules have their models and services scaffolded. Dashboard pages and reporting views need completion and production enablement.

### Phase 2: Engagement & Mobile Experience
1. **Parent & Student Mobile PWA with Web Push Notifications**:
   - Instant push notifications for attendance alerts, exam results, and fee notices directly to iOS/Android home-screen web apps.
2. **Automated WhatsApp Attendance Broadcast Triggers**:
   - Configurable trigger: when homeroom teacher marks a student absent in morning registration, automatically queue a WhatsApp reminder to the primary guardian after 30 minutes.
3. **Advanced Financial Analytics & Treasury Forecasting**:
   - Multi-term cash collection projections based on fee assignment maturity dates.
4. **Leadership Analytics Dashboard**:
   - `leadership` feature is scaffolded with models and services. Needs KPI tiles, cohort-level performance trends, and executive summary exports.
