# Certificate references and inspirations

Research verified on **2026-08-01**. Re-check versions, licenses, security
advisories, and standards immediately before implementation. Open-source code
licenses do not automatically grant rights to included logos, sample identities,
fonts, signature images, or artwork.

## Primary rendering/designer reference — pdfme

- Repository: https://github.com/pdfme/pdfme
- Supported features: https://pdfme.com/docs/supported-features
- License: MIT
- Fit: active TypeScript/React project, JSON templates, browser/Node PDF
  generation, WYSIWYG designer, custom fonts, images/SVG, shapes, QR/barcodes,
  tables, and plugins.
- Intended use: shared SchoolOS `document-studio` foundation for certificate
  template authoring and PDF generation.
- SchoolOS must supply tenant persistence, field allowlists, evidence, approval,
  issuance lifecycle, public verification, jobs, RBAC, and audit.

## Primary interoperability reference — Open Badges 3.0

- Specification: https://openbadgespec.org/
- Maintainer: 1EdTech Consortium
- Purpose: portable, verifiable achievement credentials aligned with W3C
  Verifiable Credentials; describes issuer, achievement, earner, proofs,
  expiration, and verification.
- Intended use: metadata/domain inspiration now and optional standards-compliant
  digital achievement export/issuance later.
- Not every PDF certificate is an Open Badge. Employment letters and ordinary
  administrative attestations do not automatically fit the achievement model.
- Version 1 should use hosted SchoolOS verification without claiming Open Badges
  conformance or cryptographic signatures.

## Verification UX inspiration — Blockcerts

- Organization/repositories: https://github.com/blockchain-certificates
- Relevant projects: `cert-verifier-js`, `blockcerts-verifier`, `cert-schema`
- Common license: relevant verifier projects are MIT; verify each selected
  package individually before use.
- Intended use: inspiration for explicit verification steps/results, issuer
  checks, tamper/status explanations, and verifier UI.
- Recommendation: do not adopt blockchain issuance in version 1. Blockchain
  anchoring adds keys, fees/networks, recovery, privacy, and operational
  complexity that Lango does not currently need.

## Bulk generation/delivery inspiration — zedomel/certificate-generator

- Repository: https://github.com/zedomel/certificate-generator
- Model: HTML template placeholders + CSV data → PDFs → optional email delivery.
- Intended use: understand bulk placeholder mapping, one-output-per-recipient,
  and email job configuration.
- Not a production base: PHP/TCPDF command-line workflow without SchoolOS
  tenancy, approvals, immutable versions, evidence, verification, or lifecycle.
- License must be re-verified from the repository before any code reuse; use as
  workflow inspiration unless licensing is confirmed.

## Optional Open Badges context package

- Repository: https://github.com/digitalcredentials/open-badges-context
- License: MIT
- Purpose: packaged Open Badges v3 JSON-LD contexts for implementations.
- Use only if/when SchoolOS implements a real Open Badges 3.0 credential flow;
  it is unnecessary for version-1 hosted PDF verification.

## Reference hierarchy

1. SchoolOS academic/HR source data and certificate policy are the truth.
2. pdfme supplies the visual document engine.
3. Open Badges supplies optional future achievement-credential semantics.
4. Blockcerts inspires verification UX, not architecture for version 1.
5. Small certificate-generator repos inspire bulk workflow only.

