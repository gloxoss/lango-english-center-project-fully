# Instructions for Gemini and Antigravity agents

This repository is shared with other AI agents working at the same time.

1. Read `AGENTS.md` (architecture and rules) and `.agent-hub/CONTEXT.md` (short app context).
2. Follow `.agent-hub/PROTOCOL.md` for every change: join the hub (`node .agent-hub/hub.mjs join --agent gemini-<n> --tool gemini`), claim files before editing, log finished work with proof, verify other agents' work.
3. Never run `git stash`, `git reset --hard`, `git checkout -- <file>`, `git restore` or `git clean` in this tree.
