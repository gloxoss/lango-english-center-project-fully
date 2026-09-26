const fs = require('fs');
const path = require('path');

const eventsFile = path.resolve(process.cwd(), '.agent-hub/events.jsonl');
const lines = fs.readFileSync(eventsFile, 'utf8').split('\n').filter(Boolean);

const doneItems = new Map();
const verifiedItems = new Map();

for (const line of lines) {
  try {
    const ev = JSON.parse(line);
    if (ev.type === 'done') {
      doneItems.set(ev.item, {
        item: ev.item,
        agent: ev.agent,
        summary: ev.summary,
        verify: ev.verify,
        files: ev.files || [],
        ts: ev.ts
      });
    } else if (ev.type === 'verify') {
      verifiedItems.set(ev.item, {
        item: ev.item,
        agent: ev.agent,
        ok: ev.ok,
        note: ev.note,
        ts: ev.ts
      });
    }
  } catch (e) {}
}

const listToVerify = [];

for (const [item, done] of doneItems.entries()) {
  const v = verifiedItems.get(item);
  if (!v) {
    listToVerify.push({
      item,
      category: 'unverified',
      doneBy: done.agent,
      summary: done.summary,
      verifyCmd: done.verify,
      files: done.files,
      previousVerify: null
    });
  } else if (v.agent === 'antigravity-1') {
    listToVerify.push({
      item,
      category: 'redo-antigravity-1',
      doneBy: done.agent,
      summary: done.summary,
      verifyCmd: done.verify,
      files: done.files,
      previousVerify: v
    });
  }
}

fs.writeFileSync(
  path.resolve(process.cwd(), 'scratch/s02_items.json'),
  JSON.stringify(listToVerify, null, 2),
  'utf8'
);

console.log(`Total items to verify: ${listToVerify.length}`);
console.log(`Unverified: ${listToVerify.filter(x => x.category === 'unverified').length}`);
console.log(`Redo antigravity-1: ${listToVerify.filter(x => x.category === 'redo-antigravity-1').length}`);
