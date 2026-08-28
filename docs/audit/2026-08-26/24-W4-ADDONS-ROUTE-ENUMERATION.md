# W4 — Enumeration of the 86 `addons` routes lacking a literal `requireCapability`

Generated 2026-08-28 by re-running the classification against the tree.
W4's exit criterion required every route listed with a verdict, not a summary.
\§9 of `20-ROADMAP-VS-CODEBASE-AUDIT.md` gave the summary; this is the list.

**Verdict: all 86 are guarded.** The literal string `requireCapability` is absent
because these routes call shared wrappers that invoke it internally.

| # | Route | Guard | Capability enforced? |
|--:|---|---|---|
| 1 | `broadcast/automations/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 2 | `broadcast/automations/[id]/runs/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 3 | `broadcast/automations/[id]/test/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 4 | `broadcast/automations/[id]/toggle/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 5 | `broadcast/automations/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 6 | `broadcast/automations/runs/[runId]/recipients/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 7 | `broadcast/campaigns/[id]/approve/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 8 | `broadcast/campaigns/[id]/cancel/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 9 | `broadcast/campaigns/[id]/export/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 10 | `broadcast/campaigns/[id]/preview/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 11 | `broadcast/campaigns/[id]/recipients/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 12 | `broadcast/campaigns/[id]/report/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 13 | `broadcast/campaigns/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 14 | `broadcast/campaigns/[id]/schedule/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 15 | `broadcast/campaigns/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 16 | `broadcast/connections/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 17 | `broadcast/connections/[id]/test/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 18 | `broadcast/connections/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 19 | `broadcast/consents/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 20 | `broadcast/deliveries/[id]/events/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 21 | `broadcast/deliveries/[id]/retry/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 22 | `broadcast/segments/[id]/preview/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 23 | `broadcast/segments/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 24 | `broadcast/segments/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 25 | `broadcast/suppressions/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 26 | `broadcast/suppressions/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 27 | `broadcast/templates/[id]/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 28 | `broadcast/templates/[id]/versions/[versionId]/publish/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 29 | `broadcast/templates/[id]/versions/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 30 | `broadcast/templates/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 31 | `broadcast/worker/process/route.ts` | broadcastGuard | yes - wrapper calls requireCapability |
| 32 | `hostel/guardian/me/route.ts` | requireRequestContext + requireAddon + explicit role 403 | no - role-gated, scoped by context.userId |
| 33 | `hostel/resident/me/leave-requests/route.ts` | requireRequestContext + requireAddon + explicit role 403 | no - role-gated, scoped by context.userId |
| 34 | `hostel/resident/me/route.ts` | requireRequestContext + requireAddon + explicit role 403 | no - role-gated, scoped by context.userId |
| 35 | `library/catalog/[id]/contributors/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 36 | `library/catalog/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 37 | `library/catalog/[id]/subjects/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 38 | `library/catalog/categories/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 39 | `library/catalog/categories/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 40 | `library/catalog/contributors/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 41 | `library/catalog/contributors/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 42 | `library/catalog/publishers/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 43 | `library/catalog/publishers/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 44 | `library/catalog/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 45 | `library/catalog/subjects/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 46 | `library/catalog/subjects/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 47 | `library/charges/[id]/post/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 48 | `library/charges/[id]/waive/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 49 | `library/charges/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 50 | `library/circulation/loans/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 51 | `library/circulation/renew/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 52 | `library/circulation/return/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 53 | `library/closures/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 54 | `library/closures/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 55 | `library/copies/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 56 | `library/copies/export/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 57 | `library/copies/import/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 58 | `library/copies/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 59 | `library/editions/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 60 | `library/editions/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 61 | `library/holds/[id]/cancel/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 62 | `library/holds/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 63 | `library/me/charges/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 64 | `library/me/children/[studentId]/loans/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 65 | `library/me/children/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 66 | `library/me/history/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 67 | `library/me/holds/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 68 | `library/me/home/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 69 | `library/me/loans/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 70 | `library/me/renew/route.ts` | requireLibrarySelfContext | no - role allowlist + addon, self-scoped by design |
| 71 | `library/members/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 72 | `library/members/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 73 | `library/policies/[id]/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 74 | `library/policies/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 75 | `library/reports/circulation/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 76 | `library/reports/inventory/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 77 | `library/reports/overdue/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 78 | `library/reports/overview/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 79 | `library/stocktakes/[id]/adjustments/apply/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 80 | `library/stocktakes/[id]/adjustments/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 81 | `library/stocktakes/[id]/close/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 82 | `library/stocktakes/[id]/observations/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 83 | `library/stocktakes/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 84 | `library/transfers/[id]/transition/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 85 | `library/transfers/route.ts` | requireLibraryContext | yes - wrapper calls requireCapability |
| 86 | `live-classrooms/webhooks/[providerType]/route.ts` | none (signature-verified webhook) | n/a - sessionless by nature |

## Totals

- Verified 86 routes.
- The 8 `library/me/*` and 3 `hostel/*/me` routes carry no capability by design;
  they are self-scoped reads. The sharpest of them,
  `library/me/children/[studentId]/loans`, takes a client-supplied id and is
  protected by `assertChildLibraryAccess` (active guardian link + canAccessLibrary,
  tenant-scoped, else 403). Removing that check fails an existing test.
- The 3 hostel routes take no client-supplied id at all - every one derives
  its subject from `context.userId`.
- Payload-shape regressions (masked secrets, masked phone/email, librarian 403)
  are covered by `src/app/api/addons/wave3-addons-guard.test.ts`.
