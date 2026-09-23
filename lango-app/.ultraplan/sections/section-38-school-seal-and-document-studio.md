# Section 38: Official Moroccan School Document Studio (Seal, Signature & MEN Stamp)

## 1. Overview & Business Value
Enables Moroccan schools to configure their legal identification (N° d'autorisation du Ministère de l'Éducation Nationale, ICE, DRE/AREF) and upload their official stamp (*Cachet d'établissement*) and director's signature. Automatically stamps and renders official signatures on all generated student certificates, report cards, and administrative documents.

## 2. Target Files & Architecture
- **Schema & Persistence**:
  - Add fields in `tenantSettings` / `tenants` or document configurations:
    - `menAuthorizationNumber`: varchar(100) (N° d'autorisation MEN)
    - `regionalAcademy`: varchar(255) (Académie Régionale de l'Éducation et de la Formation - AREF)
    - `provincialDirection`: varchar(255) (Direction Provinciale)
    - `officialStampUrl`: text (URL de l'image transparente du cachet)
    - `directorSignatureUrl`: text (URL de l'image transparente de la signature)
- **Settings UI**:
  - `src/features/settings/ui/school-info-view.tsx` or `settings-general-view.tsx`:
    - Section "Identification Légale & Cachets Officiels (Maroc)".
    - Uploader for stamp image (PNG with transparency) and director signature.
    - Form fields for AREF, Direction Provinciale, and N° d'autorisation MEN.
- **Document Generators**:
  - `src/features/certificates/ui/issue-certificate-dialog.tsx`:
    - Incorporates school stamp + signature in generated certificate PDF preview.
    - Adds official Moroccan footer: *"Document officiel délivré sous l'autorisation N° [MEN] - Conforme à la loi 06-00 relative à l'enseignement privé au Maroc"*.
  - `src/features/students/services/report-card-service.ts`:
    - Embeds official stamp and signature at bottom of semester report cards.

## 3. Acceptance Criteria
1. Schools can upload and preview transparent stamp and signature PNGs.
2. Generated PDFs include official AREF and MEN authorization text and graphics.
3. Multi-tenant isolation is strictly maintained: no school can access another school's stamp or signature.
