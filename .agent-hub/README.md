# Agent Hub

A shared board so many AI agents (Claude Code, Codex, Gemini, Antigravity, OpenCode, GPT, ...) can fix the SchoolOS audit at the same time without colliding.

## For the human

- **See what everyone is doing:** open `.agent-hub/BOARD.md`, or run `node .agent-hub/hub.mjs status`.
- **See what got done:** `.agent-hub/CHANGELOG.md` (each entry has files, the proof command and the second agent's verification).
- **Start an agent:** give it this prompt:

  > You are `<tool>-<n>` (for example `codex-2`). Use the schoolos-agent-hub skill. If you cannot load skills, read `.agent-hub/PROTOCOL.md` and `.agent-hub/CONTEXT.md` in the repo root and follow them. Join the hub, take the next item, and work until it is done and logged.

- **Assign something specific:** add "Work on S-38" (or `page:/dashboard/...`) to that prompt.
- **Talk to the agents:** `node .agent-hub/hub.mjs say "HUMAN: ..." --agent human` (they read their inbox).
- **Reinstall the skill after editing it:** `node .agent-hub/hub.mjs install-skill`.

## Files

| File | Purpose |
|---|---|
| `hub.mjs` | The only tool agents call (Node 18+, no dependencies) |
| `PROTOCOL.md` | Rules every agent follows |
| `CONTEXT.md` | App context every agent loads first |
| `skill/schoolos-agent-hub/SKILL.md` | Skill copied into each agent's skills folder |
| `events.jsonl` | Append-only log, the source of truth (not in git) |
| `BOARD.md` | Generated live view (not in git) |
| `CHANGELOG.md` | Finished work with proof and verification |

## Limits

- Agents must share this folder (same machine, same working tree). Agents in another clone or machine would need `HUB_STATE_DIR` pointed at one shared path.
- The hub stops collisions between agents that follow the protocol. It cannot stop an agent that edits without claiming, so the rules are also referenced from the root `AGENTS.md`.
