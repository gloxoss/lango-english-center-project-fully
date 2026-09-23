# Agent Hub protocol

Many agents (Claude, Codex, Gemini, Antigravity, OpenCode, GPT, ...) edit the same working tree at the same time. These rules keep them from overwriting each other. Every command below is `node .agent-hub/hub.mjs <command>`, run from the repo root. Set your id once: `export AGENT_ID=<tool>-<n>` (PowerShell: `$env:AGENT_ID="codex-1"`), or pass `--agent <id>` every time.

## 1. Start of session

1. Pick a unique id: `<tool>-<n>` (`codex-1`, `gemini-2`, `claude-3`). Check `status` that nobody active already uses it.
2. `join --tool <codex|claude|gemini|antigravity|opencode|gpt> --note "what you plan to focus on"`
3. Read `.agent-hub/CONTEXT.md` (app rules) if you have not this session.
4. `status` and `inbox`. Answer anything addressed to you.

## 2. Choose work

- `next` lists the best free findings. **Items waiting for verification come first**: checking another agent's work is worth more than starting new work.
- Item ids: a finding `S-38`; a single page `page:/dashboard/hr/self-service`; anything else `task:<short-slug>` (for example `task:port-3444`, `task:migration-0091`, `task:seed-dates`).
- The user may assign you an item directly. Still claim it.

## 3. Claim before you edit anything

```
claim S-38 --files lango-app/src/libs/api/permissions.ts,lango-app/src/features/hr/ui/employee-portal-view.tsx --note "grant payroll.self.read"
```

- List **every file or folder you expect to edit**. A folder locks everything under it, so prefer exact files.
- Exit code 3 means a conflict: another agent holds the item, a page inside it, or one of your files. **Do not work around it.** Pick another item, or `say --to <owner>` and wait.
- Need another file later? `files S-38 --add path` **before** touching it. If it is locked, ask the owner.
- Claiming a finding also locks its pages. A migration number, a port, a seed change: claim them as `task:` items.

## 4. While working

- `heartbeat --note "what you are doing"` at least every 20 minutes. Claims of an agent silent for 45 minutes become free for others.
- **Only edit files you hold.** Never reformat, revert, "clean up" or fix files outside your claim, even if they look wrong. Report it instead (`say "found X in file Y, not mine"`).
- **Git in a shared tree:**
  - Never run `git stash`, `git checkout -- <file>`, `git restore`, `git reset --hard`, `git clean` or `git switch`/`checkout <branch>`. Each of these destroys other agents' uncommitted work.
  - Commit only when the human asks. Then `git add` only the files you hold, one by one (never `git add -A` or `.`).
- Do not run repo-wide formatters or codemods (`prettier --write .`, `eslint --fix .`).
- Test data goes to `schoolos_audit` only. Your dev server uses your own port and `NEXT_DIST_DIR`.
- Out of scope bug found? Do not fix it. `say "S-xx side effect: ..."` so it can become a `task:`.

## 5. Finish with proof

1. Run the "Done when" check from the finding file, plus `npm run check:types`, `npm run check:isolation`, the related tests, and for UI a sweep of the page as the right role.
2. `done S-38 --summary "what changed, in one or two sentences" --files a,b --verify "exact command -> exact result"`
   - `done` refuses without summary, files and verify. It writes the entry to `.agent-hub/CHANGELOG.md` and releases your claim.
   - If a check failed, say so in `--verify`. Never mark done something you did not run.
3. The item is fully finished only after **another agent** runs `verify S-38 --ok --note "..."` (or `--fail`). You cannot verify your own work.

## 6. Verifying someone else's work

1. Read the entry in `CHANGELOG.md`, then `git diff -- <their files>`.
2. Re-run their verify command, and the finding's "Done when" check yourself.
3. `verify S-38 --ok --note "what you checked"`, or `--fail --note "what is still wrong"`. A failed item goes back to the board; anyone can `claim S-38 --reopen`.

## 6b. Audit folder bookkeeping (done automatically; never move files by hand)

The audit folder `lango-app/docs/audit/page-audit/` always shows what is left: open and partial findings sit in `findings/`, finished ones in `findings/done/`, and `STATUS.md` lists everything. The hub keeps it in sync:

| Step | Command | What the hub does to the audit folder |
|---|---|---|
| Fix logged | `done S-33 ...` | finding status becomes **REVIEW** (fixed, waiting for a second agent) |
| Verified OK | `verify S-33 --ok --note ...` | moves `findings/S-33.md` to `findings/done/`, stamps it **DONE** with fixer, verifier and proof, rewrites every link, updates page statuses and `STATUS.md` |
| Verification failed | `verify S-33 --fail --note ...` | finding stays or returns to `findings/` as **PARTIAL** with the rejection note; listed under "Needs attention" |
| Part of a finding done | `progress S-26 --partial --note "done: X / left: Y"` | status **PARTIAL** with your note (use `--open` to reset). DONE is only reachable through `verify` |
| Regression found | `claim S-33 --reopen --note "why"` | moves it back from `findings/done/` to `findings/` as **OPEN** |
| Page re-checked on screen | `swept page:/dashboard/x --ok --note "role + sweep -> result"` | page shows **CONFIRMED ON SCREEN** once all its findings are done (`--fail` removes the confirmation) |
| Anything looks out of date | `sync-audit` | rebuilds links, page Status/Progress lines, the README status column and `STATUS.md` |

- **Never edit** `STATUS.md`, the `<!-- status -->` block in a finding, or the Status/Progress lines of a page by hand. They are rebuilt from the folder layout and the hub log.
- After fixing a finding, re-sweep its pages as the right role and record it with `swept`. A finding in `findings/done/` means fixed and verified in code; `CONFIRMED ON SCREEN` means a person or agent also saw it work.

## 7. Talking to each other

- `say "text"` to everyone, `say "text" --to gemini-1` to one agent. Start with the item id: `"S-39: I also need summary/route.ts, can you release it after your change?"`
- Read `inbox` at start, after each `done`, and whenever a claim fails.
- Hand-off: `say --to <next agent> "S-53 half done: validation added, export not started; notes in ..."` then `release S-53`.
- Asking a human: write `say "HUMAN: <question>"`. The human reads BOARD.md.

## 8. End of session

`release` anything unfinished (with a note on where you stopped), then `leave`. Leaving releases everything you hold.

## Quick reference

```
join --tool T --note N | status | next | claim ITEM --files F | files ITEM --add F
heartbeat --note N | done ITEM --summary S --files F --verify V | verify ITEM --ok|--fail --note N
progress FINDING --partial|--open --note N | swept page:/route --ok|--fail --note N | sync-audit
claim ITEM --reopen --note N | say TEXT [--to ID] | inbox | log | release ITEM | leave
```
