#!/usr/bin/env node
// SchoolOS Agent Hub: file-based coordination for many agents (Claude, Codex, Gemini,
// Antigravity, OpenCode, ...) working in the same working tree at the same time.
//
// Source of truth: events.jsonl (append-only). BOARD.md is regenerated after every write.
// Writes are serialized with an atomic directory lock, so two agents can never claim
// the same item. No dependencies: plain Node >= 18.
//
// Usage: node .agent-hub/hub.mjs <command> [args]   (run from anywhere)
// Identity: --agent <id> or env AGENT_ID (e.g. codex-1, gemini-2, claude-3).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HUB = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const ROOT = path.resolve(HUB, '..');
// HUB_STATE_DIR lets tests (or a separate campaign) keep their own board.
const STATE_DIR = process.env.HUB_STATE_DIR ?? HUB;
fs.mkdirSync(STATE_DIR, { recursive: true });
const EVENTS = path.join(STATE_DIR, 'events.jsonl');
const BOARD = path.join(STATE_DIR, 'BOARD.md');
const CHANGELOG = path.join(STATE_DIR, 'CHANGELOG.md');
const LOCK = path.join(STATE_DIR, '.lock');
const AUDIT = path.join(ROOT, 'lango-app/docs/audit/page-audit');
const TTL_MIN = Number(process.env.HUB_TTL_MIN ?? 45);
const SEV = ['P0', 'P1', 'P2', 'P3'];

// ---------- args ----------
const argv = process.argv.slice(2);
const cmd = argv[0];
const opts = {}; const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; opts[k] = v; }
  else pos.push(a);
}
const agent = opts.agent ?? process.env.AGENT_ID;
// Throw instead of exiting so withLock's finally always releases the lock.
class HubError extends Error { constructor(msg, code) { super(msg); this.code = code; } }
const die = (msg, code = 1) => { throw new HubError(msg, code); };
const needAgent = () => { if (!agent) die('who are you? pass --agent <id> or set AGENT_ID (e.g. codex-1)'); };
const list = v => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : []);
const now = () => new Date().toISOString();

// ---------- lock (mkdir is atomic on every OS) ----------
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function withLock(fn) {
  for (let i = 0; i < 200; i++) {
    try { fs.mkdirSync(LOCK); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 15000) fs.rmSync(LOCK, { recursive: true, force: true }); } catch {}
      if (i === 199) die('hub is locked by another agent for too long; retry in a few seconds');
      sleep(50 + Math.random() * 100);
    }
  }
  try { return fn(); } finally { fs.rmSync(LOCK, { recursive: true, force: true }); }
}

// ---------- events + state ----------
const readEvents = () => (fs.existsSync(EVENTS) ? fs.readFileSync(EVENTS, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const append = ev => fs.appendFileSync(EVENTS, JSON.stringify({ ts: now(), agent, ...ev }) + '\n');

function state(events = readEvents()) {
  const agents = {}; const claims = {}; const done = {}; const msgs = [];
  for (const e of events) {
    const a = (agents[e.agent] ??= { id: e.agent, tool: '', lastSeen: e.ts, note: '' });
    a.lastSeen = e.ts;
    if (e.type === 'join') { a.tool = e.tool ?? a.tool; a.note = e.text ?? ''; }
    if (e.type === 'heartbeat' && e.text) a.note = e.text;
    if (e.type === 'leave') a.left = e.ts;
    if (e.type === 'join') delete a.left;
    if (e.type === 'claim') claims[e.item] = { item: e.item, agent: e.agent, since: e.ts, files: e.files ?? [], note: e.text ?? '' };
    if (e.type === 'files' && claims[e.item]?.agent === e.agent) claims[e.item].files = [...new Set([...claims[e.item].files, ...(e.files ?? [])])];
    if (e.type === 'release' || e.type === 'done') { if (claims[e.item]?.agent === e.agent || e.force) delete claims[e.item]; }
    if (e.type === 'leave') for (const k of Object.keys(claims)) if (claims[k].agent === e.agent) delete claims[k];
    if (e.type === 'done') done[e.item] = { item: e.item, agent: e.agent, ts: e.ts, text: e.text, files: e.files ?? [], verify: e.verify ?? '', verified: null };
    if (e.type === 'verify' && done[e.item]) done[e.item].verified = { agent: e.agent, ok: e.ok, ts: e.ts, text: e.text };
    if (e.type === 'reopen') delete done[e.item];
    if (e.type === 'msg') msgs.push(e);
  }
  const alive = id => agents[id] && !agents[id].left && (Date.now() - Date.parse(agents[id].lastSeen)) / 60000 < TTL_MIN;
  return { agents, claims, done, msgs, alive };
}

// ---------- audit backlog (findings -> pages) ----------
function backlog() {
  const dir = path.join(AUDIT, 'findings');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const id = f.replace(/\.md$/, '');
    return {
      item: id,
      title: t.match(/^# \S+ · (.+)$/m)?.[1] ?? '',
      sev: t.match(/\*\*Severity: (P\d)\*\*/)?.[1] ?? 'P3',
      code: t.match(/\*\*Code check[^*]*\*\* ([A-Z ]+?):/)?.[1] ?? 'NOT RE-CHECKED',
      pages: [...t.matchAll(/^- \[`([^`]+)`\]/gm)].map(m => m[1]),
      file: path.relative(ROOT, path.join(dir, f)).replace(/\\/g, '/'),
    };
  });
}
const itemKind = it => (it.startsWith('page:') ? 'page' : it.startsWith('task:') ? 'task' : 'finding');
function pagesOf(it, bl) {
  if (itemKind(it) === 'page') return [it.slice(5)];
  return bl.find(b => b.item === it)?.pages ?? [];
}
const norm = p => p.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
const overlap = (a, b) => { a = norm(a); b = norm(b); return a === b || a.startsWith(b + '/') || b.startsWith(a + '/'); };

function conflicts(item, files, st, bl) {
  const out = [];
  const myPages = pagesOf(item, bl);
  for (const c of Object.values(st.claims)) {
    if (c.agent === agent || !st.alive(c.agent)) continue;
    if (c.item === item) out.push(`${item} is claimed by ${c.agent} since ${c.since}`);
    const theirPages = pagesOf(c.item, bl);
    const shared = myPages.filter(p => theirPages.includes(p));
    if (c.item !== item && shared.length) out.push(`page(s) ${shared.join(', ')} are inside ${c.item}, claimed by ${c.agent}`);
    const f = files.filter(x => c.files.some(y => overlap(x, y)));
    if (f.length) out.push(`file(s) ${f.join(', ')} are being edited by ${c.agent} (${c.item})`);
  }
  return out;
}

// ---------- board ----------
const ago = ts => { const m = Math.round((Date.now() - Date.parse(ts)) / 60000); return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
function renderBoard(st = state()) {
  const bl = backlog();
  const L = ['# Agent Hub board', '', `_Generated ${now()} by \`node .agent-hub/hub.mjs\`. Do not edit by hand: it is rebuilt after every command. Claims expire after ${TTL_MIN} min without a heartbeat._`, ''];
  const live = Object.values(st.agents).filter(a => st.alive(a.id));
  L.push(`## Active agents (${live.length})`, '');
  if (live.length) { L.push('| Agent | Tool | Last seen | Working on | Note |', '|---|---|---|---|---|'); for (const a of live) L.push(`| ${a.id} | ${a.tool} | ${ago(a.lastSeen)} | ${Object.values(st.claims).filter(c => c.agent === a.id).map(c => c.item).join(', ') || '—'} | ${a.note.replace(/\|/g, '/')} |`); }
  else L.push('Nobody is active.');
  L.push('', '## Claims', '');
  const cl = Object.values(st.claims);
  if (cl.length) { L.push('| Item | Agent | Since | Files locked | Status |', '|---|---|---|---|---|'); for (const c of cl) L.push(`| ${c.item} | ${c.agent} | ${ago(c.since)} | ${c.files.join('<br>') || '—'} | ${st.alive(c.agent) ? 'active' : '**STALE, can be taken**'} |`); }
  else L.push('No open claims.');
  const doneN = Object.keys(st.done).length; const verN = Object.values(st.done).filter(d => d.verified?.ok).length;
  L.push('', `## Audit backlog: ${bl.length} findings · ${doneN} done · ${verN} verified by a second agent`, '');
  const free = bl.filter(b => !st.claims[b.item] && !st.done[b.item]).sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || (a.code === 'STILL OPEN' ? -1 : 0) - (b.code === 'STILL OPEN' ? -1 : 0));
  L.push('### Free to take (highest first)', '', '| Item | Sev | Code check | Title | Pages |', '|---|---|---|---|---|');
  for (const b of free.slice(0, 40)) L.push(`| [${b.item}](../${b.file}) | ${b.sev} | ${b.code} | ${b.title.replace(/\|/g, '/')} | ${b.pages.length} |`);
  if (free.length > 40) L.push(`| … | | | ${free.length - 40} more: \`node .agent-hub/hub.mjs next\` | |`);
  L.push('', '### Done, waiting for verification by another agent', '');
  const unver = Object.values(st.done).filter(d => !d.verified);
  unver.length ? unver.forEach(d => L.push(`- **${d.item}** by ${d.agent} (${ago(d.ts)}): ${d.text} · verify: \`${d.verify}\``)) : L.push('None.');
  const failed = Object.values(st.done).filter(d => d.verified && !d.verified.ok);
  if (failed.length) { L.push('', '### Verification FAILED (reopen and fix)', ''); failed.forEach(d => L.push(`- **${d.item}** by ${d.agent}, rejected by ${d.verified.agent}: ${d.verified.text}`)); }
  L.push('', '## Recent messages', '');
  const m = st.msgs.slice(-15).reverse();
  m.length ? m.forEach(x => L.push(`- ${ago(x.ts)} **${x.agent}** → ${x.to ?? 'all'}: ${x.text}`)) : L.push('None.');
  fs.writeFileSync(BOARD, L.join('\n') + '\n');
}

// ---------- commands ----------
const write = fn => withLock(() => { const r = fn(state()); renderBoard(); return r; });

const commands = {
  join() {
    needAgent();
    write(() => append({ type: 'join', tool: opts.tool ?? 'unknown', text: opts.note ?? '' }));
    console.log(`joined as ${agent}. Next: read .agent-hub/CONTEXT.md and .agent-hub/PROTOCOL.md, then run: node .agent-hub/hub.mjs status`);
  },
  status() {
    const st = state(); renderBoard(st);
    const live = Object.values(st.agents).filter(a => st.alive(a.id));
    console.log(`Active agents: ${live.map(a => `${a.id}(${a.tool})`).join(', ') || 'none'}`);
    const cl = Object.values(st.claims);
    console.log(`Claims: ${cl.length ? '' : 'none'}`); cl.forEach(c => console.log(`  ${c.item.padEnd(40)} ${c.agent}${st.alive(c.agent) ? '' : ' (STALE)'}  files: ${c.files.join(', ') || '-'}`));
    if (agent) { const inbox = st.msgs.filter(x => (x.to === agent || !x.to) && x.agent !== agent).slice(-5); if (inbox.length) { console.log('Latest messages for you:'); inbox.forEach(x => console.log(`  ${x.ts.slice(11, 16)} ${x.agent}: ${x.text}`)); } }
    console.log('Full view: .agent-hub/BOARD.md');
  },
  next() {
    const st = state(); const bl = backlog();
    const free = bl.filter(b => !st.claims[b.item] && !st.done[b.item] && !conflicts(b.item, [], st, bl).length)
      .sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || (b.code === 'STILL OPEN') - (a.code === 'STILL OPEN'));
    const toVerify = Object.values(st.done).filter(d => !d.verified && d.agent !== agent);
    if (toVerify.length) console.log(`Verification needed (do these first if you can): ${toVerify.map(d => d.item).join(', ')}`);
    const n = Number(opts.n ?? 5);
    if (!free.length) return console.log('No free audit findings. Ask on the board or take a task:<slug>.');
    free.slice(0, n).forEach(b => console.log(`${b.item.padEnd(6)} ${b.sev} ${b.code.padEnd(14)} ${b.title}  (${b.file})`));
    console.log(`\nClaim one: node .agent-hub/hub.mjs claim ${free[0].item} --agent ${agent ?? '<id>'} --files <paths you will edit>`);
  },
  claim() {
    needAgent(); const item = pos[0]; if (!item) die('claim what? e.g. S-38, page:/dashboard/hr/self-service, task:fix-seed-dates');
    const files = list(opts.files);
    write(st => {
      const bl = backlog();
      if (itemKind(item) === 'finding' && !bl.some(b => b.item === item)) die(`unknown finding ${item} (see lango-app/docs/audit/page-audit/findings)`);
      if (st.done[item] && !opts.reopen) die(`${item} is already done by ${st.done[item].agent}. Use --reopen if it must be redone (say why with --note).`);
      const c = conflicts(item, files, st, bl);
      const stale = st.claims[item] && !st.alive(st.claims[item].agent);
      if (c.length) die(`cannot claim ${item}:\n  - ${c.join('\n  - ')}\nPick another item (node .agent-hub/hub.mjs next) or message the owner (say --to <agent>).`, 3);
      if (st.done[item] && opts.reopen) append({ type: 'reopen', item, text: opts.note ?? '' });
      append({ type: 'claim', item, files, text: opts.note ?? (stale ? `took over stale claim of ${st.claims[item].agent}` : '') });
    });
    console.log(`claimed ${item}${files.length ? ` with files ${files.join(', ')}` : ''}. Heartbeat at least every ${Math.floor(TTL_MIN / 2)} min.`);
  },
  files() {
    needAgent(); const item = pos[0]; const files = list(opts.add ?? pos.slice(1).join(','));
    if (!item || !files.length) die('usage: files <item> --add path1,path2');
    write(st => {
      if (st.claims[item]?.agent !== agent) die(`you do not hold ${item}`);
      const c = conflicts(item, files, st, backlog()).filter(x => x.startsWith('file'));
      if (c.length) die(`file conflict:\n  - ${c.join('\n  - ')}`, 3);
      append({ type: 'files', item, files });
    });
    console.log(`locked ${files.join(', ')} under ${item}`);
  },
  heartbeat() { needAgent(); write(() => append({ type: 'heartbeat', text: opts.note ?? pos.join(' ') })); console.log('ok'); },
  release() {
    needAgent(); const item = pos[0];
    write(st => { if (st.claims[item]?.agent !== agent && !opts.force) die(`you do not hold ${item}`); append({ type: 'release', item, text: opts.note ?? '', force: !!opts.force }); });
    console.log(`released ${item}`);
  },
  done() {
    needAgent(); const item = pos[0];
    const summary = opts.summary; const verify = opts.verify; const files = list(opts.files);
    if (!item || !summary || !verify || !files.length) die('done needs: <item> --summary "what changed" --files a,b --verify "command you ran -> result"');
    write(st => {
      if (st.claims[item]?.agent !== agent) die(`you do not hold ${item}; claim it first`);
      append({ type: 'done', item, text: summary, files, verify });
    });
    const entry = `\n## ${now().slice(0, 16).replace('T', ' ')} · ${agent} · ${item}\n\n${summary}\n\n- Files: ${files.map(f => '`' + f + '`').join(', ')}\n- Verified with: \`${verify}\`\n- Status: done, waiting for a second agent to verify\n`;
    withLock(() => { if (!fs.existsSync(CHANGELOG)) fs.writeFileSync(CHANGELOG, '# Agent Hub changelog\n\nOne entry per finished item. Written by `hub.mjs done`; verification results are appended by `hub.mjs verify`.\n'); fs.appendFileSync(CHANGELOG, entry); });
    console.log(`${item} marked done and logged in .agent-hub/CHANGELOG.md. Another agent must verify it.`);
  },
  verify() {
    needAgent(); const item = pos[0]; const ok = opts.ok === true || opts.ok === 'true'; const fail = !!opts.fail;
    if (!item || ok === fail || !opts.note) die('usage: verify <item> --ok|--fail --note "what you checked"');
    write(st => {
      if (!st.done[item]) die(`${item} is not marked done`);
      if (st.done[item].agent === agent) die('you cannot verify your own work; another agent must');
      append({ type: 'verify', item, ok, text: opts.note });
    });
    withLock(() => fs.appendFileSync(CHANGELOG, `- ${now().slice(0, 16).replace('T', ' ')} ${ok ? 'VERIFIED' : 'REJECTED'} by ${agent}: ${opts.note} (${item})\n`));
    console.log(`${item} ${ok ? 'verified' : 'rejected; the owner or anyone can claim it with --reopen'}`);
  },
  say() {
    needAgent(); const text = opts.text ?? pos.join(' '); if (!text) die('say what? node .agent-hub/hub.mjs say "text" [--to agent-id]');
    write(() => append({ type: 'msg', to: opts.to, text }));
    console.log('sent');
  },
  inbox() {
    needAgent(); const st = state();
    const since = opts.all ? 0 : Date.now() - 24 * 3600 * 1000;
    const m = st.msgs.filter(x => (x.to === agent || !x.to) && x.agent !== agent && Date.parse(x.ts) > since);
    m.length ? m.forEach(x => console.log(`${x.ts.slice(0, 16)} ${x.agent}${x.to ? ' (to you)' : ''}: ${x.text}`)) : console.log('no messages');
  },
  log() { readEvents().slice(-Number(opts.n ?? 30)).forEach(e => console.log(`${e.ts.slice(0, 16)} ${e.agent.padEnd(12)} ${e.type.padEnd(9)} ${e.item ?? ''} ${e.text ?? ''}`)); },
  leave() { needAgent(); write(() => append({ type: 'leave', text: opts.note ?? '' })); console.log('left; your claims were released'); },
  'install-skill'() {
    const src = path.join(HUB, 'skill', 'schoolos-agent-hub');
    const home = os.homedir();
    const targets = [['.claude/skills', 'Claude Code'], ['.codex/skills', 'Codex'], ['.agents/skills', 'shared ~/.agents skills folder'], ['.gemini/skills', 'Gemini CLI'], ['.config/opencode/skills', 'OpenCode']];
    for (const [rel, name] of targets) {
      const base = path.join(home, rel);
      if (!fs.existsSync(base) && !opts.create) { console.log(`skip ${name}: ${base} does not exist (use --create to make it)`); continue; }
      const dst = path.join(base, 'schoolos-agent-hub');
      fs.mkdirSync(dst, { recursive: true });
      for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
      console.log(`installed for ${name}: ${dst}`);
    }
  },
  help() {
    console.log(`SchoolOS Agent Hub (${HUB})
  join --agent ID --tool codex|claude|gemini|antigravity|opencode|gpt [--note "focus"]
  status                      who is active, claims, your messages (rewrites BOARD.md)
  next [--n 5]                best free findings for you + items waiting for verification
  claim ITEM --files a,b      ITEM = S-38 | page:/dashboard/... | task:slug   (exit 3 = conflict)
  files ITEM --add a,b        lock more files under a claim you hold
  heartbeat [--note "..."]    keep your claims alive (TTL ${TTL_MIN} min)
  done ITEM --summary "..." --files a,b --verify "cmd -> result"
  verify ITEM --ok|--fail --note "..."    (must be a different agent)
  release ITEM [--note]  |  say "text" [--to ID]  |  inbox  |  log [--n 30]  |  leave
  install-skill [--create]    copy the skill into each agent's skills folder`);
  },
};

try { (commands[cmd] ?? commands.help)(); }
catch (e) { if (!(e instanceof HubError)) throw e; console.error(`hub: ${e.message}`); process.exit(e.code); }
