# UltraPlan Progress Tracker: SchoolOS Features & Refinements

**Pipeline:** `/ultraplan`  
**Generated:** 2026-09-22  
**Target:** Production VPS `43.157.17.129` (`https://schoolos.epioso.com`)

---

## 📊 High-Level Execution Dashboard

| # | Feature / Workstream | Target Files | Status | Priority |
|---|---|---|---|---|
| **S1** | **SMS Credits Balance Card & Audience Toggle** | `sms-reminders-view.tsx`, `api/communication/balance` | ✅ Completed | High |
| **S2** | **Room Auto-Reservation & Admission Linkage** | `room-registry.ts`, `admission-requests-client.tsx` | ✅ Completed | High |
| **S3** | **Entitlements: Module Ticket Modal & PDF License** | `entitlements-catalog-view.tsx`, `api/tenant/support` | ✅ Completed | High |
| **S4** | **Super-Admin Support Ticket Desk Interactivity** | `super-admin-support-view.tsx`, `api/super-admin/support` | ✅ Completed | Medium |
| **S5** | **Family Cumulative Balance & Student Doc Actions** | `parents/[id]/page.client.tsx`, `student-detail-view.tsx` | ✅ Completed | Medium |
| **S6** | **WhatsApp WAHA QR Code Pairing Modal** | `connections-view.tsx`, `whatsapp-waha-provider.ts` | ✅ Completed | Medium |
| **S7** | **Custom Domains & Automated On-Demand TLS** | `api/platform/caddy-ask`, `deploy/Caddyfile.template` | ✅ Completed | High |
| **S8** | **Massar National Format Sync Engine** | `massar-sync-service.ts`, `marksheet-grid-view.tsx` | ✅ Completed | High |
| **S9** | **Moroccan GSM-7 SMS Assistant & Gateway Wizard** | `libs/sms/gsm7.ts`, `sms-reminders-view.tsx` | ✅ Completed | Medium |
| **S10** | **School Seal, Director Signature & MEN Stamp Studio** | `organization-form-client.tsx`, `issue-service.ts` | ✅ Completed | Medium |

---

## 📝 Detailed Task Breakdown & Implementation Protocol

### Section 1: SMS Credits Balance & Filter Mode Refinement
- [x] **Task 1.1**: Created direct tenant-scoped SMS balance endpoint `GET /api/communication/balance` that queries active gateway credentials and returns remaining credits/quota without requiring full broadcast addon access.
- [x] **Task 1.2**: In `sms-reminders-view.tsx`, added dedicated "Passerelle & Crédits SMS" status card with live provider detection, quota indicator, and simulation mode alerts.
- [x] **Task 1.3**: Enhanced the segment toggle with clear descriptive subtitles: "Élèves nécessitant un rappel (Absences / Factures en retard)" vs "Tous les élèves inscrits de l'école ou de la classe".

### Section 2: Admission Interview Room Auto-Reservation in Timetable/Occupancy
- [x] **Task 2.1**: Updated `fetchScheduleByRoomLabel` in `src/features/academics/services/room-registry.ts` to query active `admissionInterviews` where `status = 'scheduled'`.
- [x] **Task 2.2**: Mapped scheduled admission interviews into `RoomScheduleEntry` so that any room booked for an interview automatically shows `🔴 [Occupée - Entretien: {Candidat}]` during that time slot in both the Room Directory and the Timetable views.
- [x] **Task 2.3**: In `admission-requests-client.tsx`, live room occupancy status and badges reflect real-time interview bookings without data drift.

### Section 3: Entitlements Interactive Actions (Support Request Modal + PDF License)
- [x] **Task 3.1**: In `entitlements-catalog-view.tsx`, un-disabled "Sur demande" and connected "Demander un nouveau module" to open a modal `Demande d'activation de module`.
- [x] **Task 3.2**: Wired the modal to `POST /api/tenant/support` creating a pre-filled ticket (`category: 'billing'`, `priority: 'medium'`, subject with module name) with toast confirmation.
- [x] **Task 3.3**: Implemented the official Moroccan License Certificate generator (`Attestation de Licence`) using `@pdfme` (Établissement, ICE, statut actif, liste des modules inclus, date de validité et cachet numérique SchoolOS) with instant PDF download.

### Section 4: Super-Admin Support Ticket Desk Interactivity
- [x] **Task 4.1**: Connected the interactive ticket drawer in `super-admin-support-view.tsx` to view full conversation history of school tickets.
- [x] **Task 4.2**: Added action to update ticket status (`open -> in_progress -> resolved`) and assign support agent.
- [x] **Task 4.3**: Added reply form posting to `/api/super-admin/support` so super-admins can send messages directly back to school directors.

### Section 5: Family Cumulative Balance & Student Document Actions
- [x] **Task 5.1**: On `parents/[id]/page.client.tsx`, updated `/api/students/parents/[id]/payments` to compute family total invoiced, total paid, and outstanding balance; rendered a prominent "Solde Familial Global Cumulé" card with a 1-click button "Régler le solde familial (Caisse)".
- [x] **Task 5.2**: In `student-detail-view.tsx`, verified document replacement and deletion update both state and database cleanly with feedback.

### Section 6: WhatsApp WAHA QR Code Pairing Kiosk Modal
- [x] **Task 6.1**: In `connections-view.tsx`, added "QR Code" button for WAHA connections.
- [x] **Task 6.2**: Verified modal that polls `/api/addons/broadcast/waha/qr` to render live base64 QR code image, with instructions for WhatsApp Web scanning and auto-closing on successful pairing.

### Section 7: Custom Domains & Automated On-Demand TLS
- [x] **Task 7.1**: Implemented `GET /api/platform/caddy-ask` endpoint verifying domain approval in `tenantDomains` with strict IP rate limiting and platform whitelist.
- [x] **Task 7.2**: Created `deploy/Caddyfile.template` with automated `on_demand_tls` reverse proxy configuration for port 3000.
- [x] **Task 7.3**: Verified in `school-admin-domains-view.tsx` & `super-admin-domains-view.tsx` live DNS verification button and registrar instructions (.ma, Maroc Telecom, Nindohost).

### Section 8: Massar National Format Sync Engine
- [x] **Task 8.1**: Created `src/features/academics/services/massar-sync-service.ts` for student roster and marksheet generation matching the official Moroccan Ministry schema.
- [x] **Task 8.2**: Implemented `POST /api/academics/massar/import/marks` parsing Massar Excel notes with validation on the /20 Moroccan grading scale.
- [x] **Task 8.3**: Wired "Export Massar" and "Importer Notes Massar" action buttons in `marksheet-grid-view.tsx` and student directory (`students-list-client.tsx`).

### Section 9: Moroccan GSM-7 SMS Assistant & Gateway Wizard
- [x] **Task 9.1**: Created `src/libs/sms/gsm7.ts` implementing `isGsm7String`, `countSmsSegments`, and `sanitizeToGsm7` to protect schools from multi-segment billing traps with 100% unit test coverage.
- [x] **Task 9.2**: Integrated real-time segment counter, Unicode warning, and 1-click "Nettoyer pour GSM-7 économique" button in SMS notification composer (`sms-reminders-view.tsx`).
- [x] **Task 9.3**: Added interactive Moroccan mobile test modal (`06...` / `07...` / `+212`) with live carrier feedback in `sms-reminders-view.tsx` and `connections-view.tsx`.

### Section 10: Official Moroccan School Document Studio (Seal, Signature & MEN Stamp)
- [x] **Task 10.1**: Added database migration `0144_school_official_seal_and_men_fields.sql` and `Schema.ts` columns for `menAuthorizationNumber`, `regionalAcademy`, `provincialDirection`, `officialStampUrl`, and `directorSignatureUrl`.
- [x] **Task 10.2**: Updated school settings form (`organization-form-client.tsx` and `organization-page.tsx`) with dedicated Moroccan compliance section and live image preview.
- [x] **Task 10.3**: Dynamically embedded stamp, signature, and Moroccan legal footer (Loi 06-00) in certificate generation (`issue-service.ts` & `issue-certificate-dialog.tsx`).

---

## 🛡️ Verification Gates
1. `npm run check:types`: TypeScript strict compilation (0 errors).
2. `npm run check:isolation`: Multi-tenant isolation invariant (100% tenant-scoped queries).
3. `npm run check:i18n`: Translations check (0 missing keys).
4. `npm run check:ui`: UI reality ratchet holding.
