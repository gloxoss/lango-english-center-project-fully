# <TASK-ID> — <Task Name> — Executor Report

## 1. Handoff Metadata

- Executor:
- Date:
- Target branch:
- Target/base SHA:
- Implementation branch:
- Implementation SHA(s):
- Hub item:
- Done folder:

## 2. Scope

### Pages audited
| # | Route/Page | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | | | | PASS/FIXED/BLOCKED |

### Explicitly out of scope
- ...

### Frozen dependencies not modified
- ...

## 3. Workflow Understanding

Describe the real workflow from entry to completion:

1. ...
2. ...
3. ...

State the source of truth for important statuses, totals, dates, permissions, or configuration.

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| F-01 | High/Med/Low | | | | Fixed / Blocked / Logged |

Do not hide findings that were discovered but left unresolved.

## 5. Fixes Implemented

### F-01 — <title>
- Root cause:
- Fix:
- Why this is domain-correct:
- Files changed:
- Regression risk:

## 6. Security / Isolation / Permission Audit

- Tenant isolation:
- Branch isolation:
- Page guard:
- API capability/role guard:
- Add-on/entitlement:
- IDOR/object ownership:
- Request validation:
- Sensitive-data exposure:
- Audit logging:

Include concrete runtime or test evidence, not only "looks correct".

## 7. Data / DB / Migration Impact

- Tables read:
- Tables written:
- Historical data changed:
- Migration added: none / filename
- Migration journal status:
- Fresh DB/replay proof if applicable:

## 8. Tests

### Focused tests
```text
command -> X/X PASS
```

### Runtime reconciliation
```text
role / route / action -> expected result -> actual result
```

### Static gates
```text
check:types      PASS/FAIL
check:isolation  PASS/FAIL
check:i18n       PASS/FAIL
check:ui         PASS/FAIL
eslint touched   PASS/FAIL
```

### Broader suite
- Run? YES/NO
- Result:
- Any failures:
- Reproduced on target branch? YES/NO/N/A

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| screenshots/01-...png | | FR | Desktop | |

Required coverage:
- every audited page: final desktop FR;
- changed visual/i18n pages: mobile 390 + Arabic RTL;
- before/after for visible defects when practical.

## 10. Files Changed

```text
...
```

## 11. Unresolved / Follow-up Items

- None

or

- <exact issue, why not fixed, owner/decision needed>

## 12. Frozen-Module / Cross-Module Impact

State whether the task touched or could affect any frozen module. If yes, explain why and provide regression evidence.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES/NO
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES/NO
CODE PUSHED: YES/NO
IMPLEMENTATION SHA: ...
OPEN CLAIMS: 0 / ...
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
