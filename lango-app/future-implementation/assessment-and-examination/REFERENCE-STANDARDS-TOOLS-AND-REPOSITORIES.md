# Assessment and Examination References

Verified: 2026-08-01. Re-check versions, licenses, advisories, standards errata and compatibility before adoption.

## Primary interoperability standard: 1EdTech QTI 3

- Overview: https://www.imsglobal.org/spec/qti/v3p0/oview/
- Standards portal: https://standards.1edtech.org/
- Purpose: portable assessment items, tests and results; QTI 3 also strengthens accessibility and supports custom interactions and adaptive testing.
- Recommendation: make Lango's internal model clean and versioned first, then provide bounded QTI import/export. Do not make raw QTI XML the operational database schema.
- V1 interoperability profile should publish exactly which question types and response-processing rules Lango supports.

## Best product/domain reference: Moodle Quiz and Question Bank

- Repository: https://github.com/moodle/moodle
- Documentation: https://docs.moodle.org/
- License: GPL-3.0.
- Study: question-bank contexts/categories/versioning, quiz slots/random questions, attempts, question behaviours, manual grading, review options and statistics.
- Use as behavioral inspiration only. Do not copy GPL implementation into Lango without legal review.

## Advanced generated-assessment reference: PrairieLearn

- Repository: https://github.com/PrairieLearn/PrairieLearn
- Documentation: https://prairielearn.readthedocs.io/
- Study: question generators, randomized variants, assessment zones, external grading, workspaces and high-scale university assessment.
- Verify the current repository/component licenses before reuse. Treat it as later-stage inspiration; its course-as-code model is not Lango's primary school workflow.

## Interactive-content reference: H5P

- Organization: https://github.com/h5p
- PHP library: https://github.com/h5p/h5p-php-library
- License: the core PHP library is GPL-3.0; individual content repositories vary and must be checked separately.
- Study: accessible interactive question types, reusable content packages and xAPI-style interaction reporting.
- Recommendation: do not embed H5P in v1. Consider a separately deployed/LTI-style integration later after license, security, content-package and maintenance review.

## Secure-client option: Safe Exam Browser

- Server: https://github.com/SafeExamBrowser/seb-server
- Official overview: https://www.safeexambrowser.org/about_overview_en.html
- License: SEB Server is MPL-2.0; client licensing/components must be verified independently.
- Use: optional locked-down client configuration and monitoring for high-stakes exams.
- Caveat: defense-in-depth only. It does not replace question randomization, server timing, authorization, human procedures or incident review.

## Useful permissive UI libraries

- KaTeX: https://github.com/KaTeX/KaTeX (MIT) for fast math rendering.
- MathLive: https://github.com/arnog/mathlive (MIT; verify packages) for accessible math input.
- Lexical: https://github.com/facebook/lexical (MIT) or TipTap core: https://github.com/ueberdosis/tiptap (MIT for core; extensions/services vary) for controlled rich-text authoring.
- TanStack Table: https://github.com/TanStack/table (MIT) for large marksheet grids, if consistent with the existing UI stack.

Do not permit arbitrary HTML/script from any editor. Store a restricted structured document or sanitized HTML and run server-side validation.

## Scheduling inspiration

- UniTime: https://github.com/UniTime/unitime
- License: Apache-2.0.
- Study: examination timetabling constraints, rooms, student conflicts and solver concepts.
- Recommendation: Lango v1 should use deterministic validation plus manual scheduling. Adopt optimization/solver logic only when real school scale demonstrates the need.

## Standards roadmap

1. Internal versioned question/outcome contracts.
2. QTI 3 bounded import/export.
3. LTI 1.3 only for integrating a real remote assessment tool.
4. Caliper/xAPI-style analytics only after a governed event model exists.

## Selection recommendation

- Build the core exam/gradebook logic in Lango around its Moroccan/session/class-subject model.
- Use QTI 3 for future portability.
- Use Moodle as the deepest workflow reference, not a code dependency.
- Use KaTeX/MathLive and a constrained rich-text editor for authoring.
- Keep Safe Exam Browser optional.
- Avoid AI proctoring and automatic essay grading in the initial product.
- Keep every external engine behind an adapter and make its limitations visible.

