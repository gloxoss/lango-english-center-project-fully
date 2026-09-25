// Suggests the next free code in a "<PREFIX>-<number>" series (RT-101 -> RT-102)
// from the codes already on screen. The form pre-fills it; the user can still
// edit it. Replaces random suggestions that could collide with an existing code.
export function nextCode(prefix: string, existing: Array<string | null | undefined>, start = 101): string {
  const head = `${prefix}-`;
  let max = start - 1;
  for (const code of existing) {
    if (!code?.startsWith(head)) {
      continue;
    }
    const tail = code.slice(head.length);
    if (/^\d+$/.test(tail)) {
      max = Math.max(max, Number(tail));
    }
  }
  return `${head}${max + 1}`;
}
