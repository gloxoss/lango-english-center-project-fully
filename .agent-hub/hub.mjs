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
const AUDIT = process.env.HUB_AUDIT_DIR ?? path.join(ROOT, 'lango-app/docs/audit/page-audit');
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
  // findings/done/ holds findings already fixed and verified: known to the hub, never offered as free work.
  const base = path.join(AUDIT, 'findings');
  if (!fs.existsSync(base)) return [];
  const dirs = [[base, false], [path.join(base, 'done'), true]].filter(([d]) => fs.existsSync(d));
  return dirs.flatMap(([dir, archived]) => fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const t = fs.readFileSync(path.join(dir, f), 'utf8');
    const id = f.replace(/\.md$/, '');
    return {
      item: id,
      archived,
      title: t.match(/^# \S+ · (.+)$/m)?.[1] ?? '',
      sev: t.match(/\*\*Severity: (P\d)\*\*/)?.[1] ?? 'P3',
      code: t.match(/\*\*Code check[^*]*\*\* ([A-Z ]+?):/)?.[1] ?? 'NOT RE-CHECKED',
      pages: [...t.matchAll(/^- \[`([^`]+)`\]/gm)].map(m => m[1]),
      file: path.relative(ROOT, path.join(dir, f)).replace(/\\/g, '/'),
    };
  }));
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
  const free = bl.filter(b => !b.archived && !st.claims[b.item] && !st.done[b.item]).sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || (a.code === 'STILL OPEN' ? -1 : 0) - (b.code === 'STILL OPEN' ? -1 : 0));
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
// ---------- audit folder sync (findings/ vs findings/done/) ----------
// The folder location is the truth: a finding in findings/done/ is finished. Every other
// fact (links, page Status/Progress lines, README column, STATUS.md) is derived from it,
// so sync can be re-run at any time and never drifts.
const FDIR = path.join(AUDIT, 'findings');
const DDIR = path.join(FDIR, 'done');
const today = () => now().slice(0, 10);
const walkMd = d => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walkMd(path.join(d, e.name)) : e.name.endsWith('.md') ? [path.join(d, e.name)] : []) : []);
const STATUS_RE = /<!-- status -->\n> \*\*Status \(([^)]*)\): ([A-Z]+)\.\*\* ?(.*)\n<!-- \/status -->\n/;
function findingFile(id) { for (const d of [FDIR, DDIR]) { const p = path.join(d, `${id}.md`); if (fs.existsSync(p)) return p; } return null; }
function readFinding(id) {
  const p = findingFile(id); if (!p) return null;
  const t = fs.readFileSync(p, 'utf8'); const s = t.match(STATUS_RE);
  return { id, path: p, text: t, inDone: path.dirname(p) === DDIR, state: path.dirname(p) === DDIR ? 'DONE' : (s?.[2] === 'DONE' ? 'OPEN' : s?.[2] ?? 'OPEN'), note: s?.[3] ?? '', date: s?.[1] ?? '', sev: t.match(/\*\*Severity: (P\d)\*\*/)?.[1] ?? 'P3', title: t.match(/^# \S+ · (.+)$/m)?.[1] ?? '' };
}
function setStatus(id, stateWord, note) {
  const f = readFinding(id); if (!f) return;
  const block = `<!-- status -->\n> **Status (${today()}): ${stateWord}.** ${note}\n<!-- /status -->\n`;
  const t = STATUS_RE.test(f.text) ? f.text.replace(STATUS_RE, block) : f.text.replace(/^(# .+\n\n)/, `$1${block}\n`);
  fs.writeFileSync(f.path, t);
}
// Move a finding file between findings/ and findings/done/, fixing its own relative links.
function moveFinding(id, toDone) {
  const f = readFinding(id); if (!f || f.inDone === toDone) return false;
  fs.mkdirSync(DDIR, { recursive: true });
  const t = toDone ? f.text.replace(/\]\(\.\.\//g, '](../../') : f.text.replace(/\]\(\.\.\/\.\.\//g, '](../');
  fs.writeFileSync(path.join(toDone ? DDIR : FDIR, `${id}.md`), t); fs.rmSync(f.path);
  return true;
}
function syncAudit(st = state()) {
  if (!fs.existsSync(FDIR)) return null;
  const ids = [...fs.readdirSync(FDIR), ...(fs.existsSync(DDIR) ? fs.readdirSync(DDIR) : [])].filter(f => f.endsWith('.md')).map(f => f.replace(/\.md$/, ''));
  const F = Object.fromEntries(ids.map(id => [id, readFinding(id)]));
  const relink = t => t.replace(/findings\/(?:done\/)?((?:V|S)-\d+)\.md/g, (m, id) => (F[id] ? `findings/${F[id].inDone ? 'done/' : ''}${id}.md` : m));
  // Pages: links, Progress line, Status line (keeps screen-confirmation markers).
  const pageStatus = {};
  for (const file of walkMd(path.join(AUDIT, 'pages'))) {
    let t = relink(fs.readFileSync(file, 'utf8'));
    const section = t.split('## Findings on this page')[1]?.split('\n## ')[0] ?? '';
    const pids = [...new Set([...section.matchAll(/\[((?:V|S)-\d+)\]/g)].map(m => m[1]))].filter(i => F[i]);
    t = t.replace(/\n\*\*Progress \([^)]*\):\*\*[^\n]*\n/, '\n');
    const swept = t.match(/<!-- swept: (.*?) -->/)?.[1];
    if (pids.length) {
      const open = pids.filter(i => !F[i].inDone).sort((a, b) => SEV.indexOf(F[a].sev) - SEV.indexOf(F[b].sev));
      const statusWord = open.length ? `NEEDS FIX (${F[open[0]].sev})` : swept ? `CONFIRMED ON SCREEN (${swept.split(' | ')[0]})` : 'FIXED, pending re-sweep';
      t = t.replace(/\*\*Status: [^*]+\*\*/, `**Status: ${statusWord}**`);
      t = t.replace(/(\*\*Status: [^*]+\*\*[^\n]*\n)/, `$1\n**Progress (${today()}):** ${pids.map(i => `${i} ${F[i].state}`).join(' · ')}\n`);
    }
    pageStatus[path.resolve(file)] = t.match(/\*\*Status: ([^*]+)\*\*/)?.[1] ?? '?';
    fs.writeFileSync(file, t);
  }
  // Findings: refresh the per-page status next to each page link.
  for (const f of Object.values(F)) {
    const t = relink(fs.readFileSync(f.path, 'utf8')).replace(/^(- \[`[^`]+`\]\(([^)]+)\)) · .+$/gm, (m, head, href) => { const s = pageStatus[path.resolve(path.dirname(f.path), href)]; return s ? `${head} · ${s}` : m; });
    fs.writeFileSync(f.path, t);
  }
  // README: links and status column.
  const readme = path.join(AUDIT, 'README.md');
  if (fs.existsSync(readme)) {
    const R = relink(fs.readFileSync(readme, 'utf8')).replace(/^(\| \[((?:V|S)-\d+)\]\([^)]+\) \| P\d \| .+? \| [^|]+ \| )[^|]+( \|)$/gm, (m, head, id, tail) => `${head}${F[id]?.state ?? '?'}${tail}`);
    fs.writeFileSync(readme, R);
  }
  // STATUS.md: what is done and what is left, plus hub housekeeping.
  const rows = s => Object.values(F).filter(f => f.state === s).sort((a, b) => SEV.indexOf(a.sev) - SEV.indexOf(b.sev) || a.id.localeCompare(b.id, 'en', { numeric: true }))
    .map(f => `| [${f.id}](findings/${f.inDone ? 'done/' : ''}${f.id}.md) | ${f.sev} | ${f.title.replace(/\|/g, '/')} | ${(f.note || '—').replace(/\|/g, '/')} |`);
  const n = s => Object.values(F).filter(f => f.state === s).length;
  const confirmed = Object.values(pageStatus).filter(s => s.startsWith('CONFIRMED')).length;
  const fixedPending = Object.values(pageStatus).filter(s => s.startsWith('FIXED')).length;
  const stale = Object.values(st.claims).filter(c => !st.alive(c.agent));
  const unverified = Object.values(st.done).filter(d => !d.verified);
  const rejected = Object.values(st.done).filter(d => d.verified && !d.verified.ok);
  const extra = Object.values(st.done).filter(d => d.verified?.ok && !F[d.item] && !/^task:port-/.test(d.item));
  const L = ['# What is done and what is left', '',
    `_Rebuilt by \`node .agent-hub/hub.mjs sync-audit\` on ${now().slice(0, 16).replace('T', ' ')}. Do not edit by hand: move work forward with hub commands (verify, progress, swept, claim --reopen)._`, '',
    `**${n('DONE')} done · ${n('REVIEW')} in review · ${n('PARTIAL')} partial · ${n('OPEN')} open** (of ${Object.keys(F).length} findings). Pages: ${fixedPending} fixed and waiting for a re-sweep, ${confirmed} confirmed on screen.`, '',
    '- **Done** = the finding file is in [findings/done/](findings/done/): fixed, and checked by an agent other than the fixer.',
    '- **In review** = fixed and logged with `done`, waiting for another agent to `verify`. **Partial** = started; the note says what is done and what is left. **Open** = not started.', '',
    '## Open', '', '| ID | Sev | Problem | Note |', '|---|---|---|---|', ...rows('OPEN'), '',
    '## In review (fixed, waiting for a second agent)', '', '| ID | Sev | Problem | Fix |', '|---|---|---|---|', ...rows('REVIEW'), '',
    '## Partial', '', '| ID | Sev | Problem | Done / left |', '|---|---|---|---|', ...rows('PARTIAL'), '',
    '## Done', '', '| ID | Sev | Problem | Evidence |', '|---|---|---|---|', ...rows('DONE'), ''];
  if (extra.length) { L.push('## Other verified work (not an audit finding)', ''); extra.forEach(d => L.push(`- \`${d.item}\` by ${d.agent}, verified by ${d.verified.agent}: ${String(d.text).slice(0, 180)}`)); L.push(''); }
  L.push('## Needs attention', '');
  const att = [...stale.map(c => `- **Stale claim** \`${c.item}\` held by ${c.agent} (silent > ${TTL_MIN} min): anyone may take it.`),
    ...unverified.map(d => `- **Waiting for verification** \`${d.item}\` by ${d.agent}.`),
    ...rejected.map(d => `- **Rejected** \`${d.item}\` (by ${d.verified.agent}): ${String(d.verified.text).slice(0, 160)}`)];
  L.push(...(att.length ? att : ['Nothing.']), '');
  fs.writeFileSync(path.join(AUDIT, 'STATUS.md'), L.join('\n'));
  return { done: n('DONE'), review: n('REVIEW'), partial: n('PARTIAL'), open: n('OPEN') };
}

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
    const free = bl.filter(b => !b.archived && !st.claims[b.item] && !st.done[b.item] && !conflicts(b.item, [], st, bl).length)
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
      if (bl.find(b => b.item === item)?.archived && !opts.reopen) die(`${item} is in findings/done (fixed and verified). Use --reopen with --note if it regressed.`);
      const c = conflicts(item, files, st, bl);
      const stale = st.claims[item] && !st.alive(st.claims[item].agent);
      if (c.length) die(`cannot claim ${item}:\n  - ${c.join('\n  - ')}\nPick another item (node .agent-hub/hub.mjs next) or message the owner (say --to <agent>).`, 3);
      const archivedNow = !!readFinding(item)?.inDone;
      if (opts.reopen && (st.done[item] || archivedNow)) {
        if (!opts.note) die('--reopen needs --note "why it must be redone"');
        append({ type: 'reopen', item, text: opts.note });
        // A reopened finding leaves findings/done/ so the folder keeps showing what is left.
        if (archivedNow) { moveFinding(item, false); setStatus(item, 'OPEN', `Reopened by ${agent}: ${opts.note}`); }
      }
      append({ type: 'claim', item, files, text: opts.note ?? (stale ? `took over stale claim of ${st.claims[item].agent}` : '') });
      if (opts.reopen) syncAudit(state());
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
      // A finding waits in REVIEW until a different agent verifies it.
      if (readFinding(item) && !readFinding(item).inDone) { setStatus(item, 'REVIEW', `${agent}: ${summary.slice(0, 200)} Waiting for a second agent to verify.`); syncAudit(state()); }
    });
    const entry = `\n## ${now().slice(0, 16).replace('T', ' ')} · ${agent} · ${item}\n\n${summary}\n\n- Files: ${files.map(f => '`' + f + '`').join(', ')}\n- Verified with: \`${verify}\`\n- Status: done, waiting for a second agent to verify\n`;
    withLock(() => { if (!fs.existsSync(CHANGELOG)) fs.writeFileSync(CHANGELOG, '# Agent Hub changelog\n\nOne entry per finished item. Written by `hub.mjs done`; verification results are appended by `hub.mjs verify`.\n'); fs.appendFileSync(CHANGELOG, entry); });
    console.log(`${item} marked done and logged in .agent-hub/CHANGELOG.md. Another agent must verify it.`);
  },
  verify() {
    needAgent(); const item = pos[0]; const ok = opts.ok === true || opts.ok === 'true'; const fail = !!opts.fail;
    if (!item || ok === fail || !opts.note) die('usage: verify <item> --ok|--fail --note "what you checked"');
    let moved = false;
    write(st => {
      if (!st.done[item]) die(`${item} is not marked done`);
      if (st.done[item].agent === agent) die('you cannot verify your own work; another agent must');
      append({ type: 'verify', item, ok, text: opts.note });
      // A verified audit finding is archived to findings/done/; a rejected one goes back to findings/.
      if (readFinding(item)) {
        const fixer = st.done[item].agent;
        moved = moveFinding(item, ok);
        setStatus(item, ok ? 'DONE' : 'PARTIAL', ok ? `${fixer} fixed: ${String(st.done[item].text).slice(0, 200)} Verified by ${agent}: ${opts.note}` : `Rejected by ${agent}: ${opts.note}`);
        syncAudit(state());
      }
    });
    withLock(() => fs.appendFileSync(CHANGELOG, `- ${now().slice(0, 16).replace('T', ' ')} ${ok ? 'VERIFIED' : 'REJECTED'} by ${agent}: ${opts.note} (${item})\n`));
    console.log(`${item} ${ok ? 'verified' : 'rejected; the owner or anyone can claim it with --reopen'}${readFinding(item) ? (ok ? `; finding ${moved ? 'moved to' : 'is in'} findings/done/, pages and STATUS.md updated` : '; finding is back in findings/ as PARTIAL, STATUS.md updated') : ''}`);
  },
  progress() {
    // Record partial progress or reset to open on a finding. DONE is only reachable through verify.
    needAgent(); const item = pos[0]; const word = opts.partial ? 'PARTIAL' : opts.open ? 'OPEN' : null;
    if (!item || !word || !opts.note) die('usage: progress <finding> --partial|--open --note "done: ... / left: ..."');
    write(st => {
      const f = readFinding(item); if (!f) die(`unknown finding ${item}`);
      if (f.inDone) die(`${item} is in findings/done. Reopen it first: claim ${item} --reopen --note "why"`);
      if (st.claims[item] && st.claims[item].agent !== agent && st.alive(st.claims[item].agent)) die(`${item} is claimed by ${st.claims[item].agent}; ask them (say --to ${st.claims[item].agent})`, 3);
      append({ type: 'progress', item, text: `${word}: ${opts.note}` });
      setStatus(item, word, `${opts.note} (${agent})`);
      syncAudit(state());
    });
    console.log(`${item} marked ${word}; STATUS.md and its pages updated`);
  },
  swept() {
    // Screen confirmation after a re-sweep: page:/route --ok|--fail --note "role, command, result".
    needAgent(); const item = pos[0]; const ok = opts.ok === true; const fail = !!opts.fail;
    if (!item?.startsWith('page:') || ok === fail || !opts.note) die('usage: swept page:/route --ok|--fail --note "role + sweep command -> result"');
    const route = item.slice(5);
    write(() => {
      const file = walkMd(path.join(AUDIT, 'pages')).find(p => fs.readFileSync(p, 'utf8').startsWith(`# \`${route}\``));
      if (!file) die(`no page file for ${route}`);
      let t = fs.readFileSync(file, 'utf8').replace(/<!-- swept: .*? -->\n?/g, '');
      if (ok) t = t.replace(/^(# .+\n)/, `$1<!-- swept: ${today()} ${agent} | ${opts.note.replace(/>/g, '›')} -->\n`);
      fs.writeFileSync(file, t);
      append({ type: 'swept', item, ok, text: opts.note });
      syncAudit(state());
    });
    console.log(ok ? `${route} recorded as confirmed on screen (shows CONFIRMED once all its findings are done)` : `${route} screen confirmation removed; open a finding or task for what failed`);
  },
  'sync-audit'() { const r = withLock(() => syncAudit()); renderBoard(); console.log(r ? `audit folder synced: ${r.done} done, ${r.review} in review, ${r.partial} partial, ${r.open} open (see lango-app/docs/audit/page-audit/STATUS.md)` : 'no audit folder found'); },
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
  claim ITEM --reopen --note "why"   redo a done finding (moves it back out of findings/done/)
  files ITEM --add a,b        lock more files under a claim you hold
  heartbeat [--note "..."]    keep your claims alive (TTL ${TTL_MIN} min)
  done ITEM --summary "..." --files a,b --verify "cmd -> result"
  verify ITEM --ok|--fail --note "..."    (must be a different agent; --ok archives a finding to findings/done/)
  progress FINDING --partial|--open --note "done: ... / left: ..."   record partial progress
  swept page:/route --ok|--fail --note "role + sweep -> result"      confirm a fixed page on screen
  sync-audit                  rebuild links, page statuses and page-audit/STATUS.md
  release ITEM [--note]  |  say "text" [--to ID]  |  inbox  |  log [--n 30]  |  leave
  install-skill [--create]    copy the skill into each agent's skills folder`);
  },
};

try { (commands[cmd] ?? commands.help)(); }
catch (e) { if (!(e instanceof HubError)) throw e; console.error(`hub: ${e.message}`); process.exit(e.code); }
