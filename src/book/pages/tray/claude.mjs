// The tray's side of the Claude reader (server/model-reader.mjs). The key lives on
// the server; this file only asks whether Claude is there and sends it the papers.
// Every figure that comes back was already checked against the text on the server,
// and carries where its quote sits so the paper can put it under the highlighter.

const KIND = { promise: 'promise', invoice: 'invoice', reply: 'reply' };

/** { available, model }. Without a server (the browser-only demo) Claude is simply not there. */
export async function modelStatus() {
  try {
    const reply = await fetch('/api/model/status', { headers: { accept: 'application/json' } });
    if (!reply.ok || !(reply.headers.get('content-type') || '').includes('json')) return { available: false, model: '' };
    const body = await reply.json();
    return { available: body?.available === true, model: String(body?.model || '') };
  } catch {
    return { available: false, model: '' };
  }
}

async function readOne(text, source, vendorHint) {
  const reply = await fetch('/api/model/read', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ text, kind: KIND[source] || '', vendorHint }),
  });
  const body = await reply.json().catch(() => null);
  if (!reply.ok || !body?.verified) throw new Error(body?.error?.message || 'Claude couldn’t read this paper.');
  return body;
}

/** Send each paper in the tray to Claude. One paper failing doesn't stop the others. */
export async function readPapers(slots, form) {
  const papers = await Promise.all(slots.filter(slot => form[slot.key]?.trim()).map(async slot => {
    try { return { key: slot.key, source: slot.source, result: await readOne(form[slot.key], slot.source, form.vendor || '') }; } catch (e) { return { key: slot.key, source: slot.source, error: e.message }; }
  }));
  const model = papers.find(p => p.result)?.result.model || '';
  return { model, papers };
}

/** Each figure Claude kept, flattened, with an id the paper's highlighter can light. */
export function claudeFigures(reading) {
  const out = [];
  for (const paper of reading?.papers || []) {
    const facts = paper.result?.facts;
    if (!facts) continue;
    facts.promises.forEach((p, i) => out.push({ id: `c-${paper.source}-p${i}`, key: paper.key, kind: p.conditions.length ? 'offer' : 'promise', ...p }));
    facts.credits.forEach((c, i) => out.push({ id: `c-${paper.source}-c${i}`, key: paper.key, kind: 'credit', ...c }));
  }
  return out;
}

/** The marks Claude's figures add to one paper. */
export function claudeMarks(figures, key) {
  return figures.filter(f => f.key === key && f.at).map(f => ({ id: f.id, start: f.at.start, end: f.at.end }));
}

export function claudeLeftOut(reading) {
  return (reading?.papers || []).flatMap(paper => (paper.result?.rejected || []).map(r => ({ ...r, source: paper.source })));
}
