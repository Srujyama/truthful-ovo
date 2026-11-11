// Coins on a page.
//
//   <Coin state="owed" u={2} />                 one coin, as SVG (legends, list rows)
//   <CoinStrip states={coinsFor(...)} u={3} />  one promise's coins in a row, on a canvas.
//        When a coin's state changes it turns over to the new face, one after another,
//        left to right, the way money arrives. With reduced motion it just changes.
//
// The crowd on the cover (many coins that sort themselves) is built on the same
// drawCoin; see coins.js.

import React, { useEffect, useRef } from 'react';
import { COIN, coinSVG, drawCoin } from './coins.js';

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function Coin({ state = 'in', u = 2, frame = 0, className = '', title }) {
  return <span className={`t-coin ${className}`} title={title} role={title ? 'img' : undefined} aria-label={title} dangerouslySetInnerHTML={{ __html: coinSVG(state, u, frame) }} />;
}

/**
 * states: one entry per coin ('in' | 'owed' | 'note' | 'offer').
 * u: pixels per square. gap: squares between coins. perRow: wrap after this many (0 = one row).
 * label: what a screen reader hears ("$900 of $2,400 came in").
 */
export function CoinStrip({ states, u = 3, gap = 2, perRow = 0, label, className = '' }) {
  const ref = useRef(null);
  const shown = useRef(null);     // what each coin shows now
  const raf = useRef(0);
  const cols = perRow > 0 ? Math.min(perRow, states.length) : states.length;
  const rows = Math.max(1, Math.ceil(states.length / Math.max(1, cols)));
  const pitch = (COIN + gap) * u;
  const width = Math.max(1, cols * pitch - gap * u);
  const height = rows * pitch - gap * u;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;

    const before = shown.current && shown.current.length === states.length ? shown.current : null;
    const at = (i) => [(i % cols) * pitch, Math.floor(i / cols) * pitch];
    const paint = (faces) => {
      ctx.clearRect(0, 0, width, height);
      faces.forEach(([state, frame], i) => { const [x, y] = at(i); drawCoin(ctx, x, y, u, state, frame); });
    };
    // which coins change, in order
    const changed = before ? states.map((s, i) => (s !== before[i] ? i : -1)).filter((i) => i >= 0) : [];
    if (!changed.length || reduced()) {
      paint(states.map((s) => [s, 0]));
      shown.current = [...states];
      return undefined;
    }
    // turn them over one after another: edge-on, then the new face
    const start = performance.now();
    const STEP = 70, TURN = 260;
    const tick = (now) => {
      const t = now - start;
      let done = true;
      const faces = states.map((s, i) => {
        const k = changed.indexOf(i);
        if (k < 0) return [s, 0];
        const local = t - k * STEP;
        if (local < 0) { done = false; return [before[i], 0]; }
        if (local >= TURN) return [s, 0];
        done = false;
        const half = local < TURN / 2;
        const f = half ? Math.round((local / (TURN / 2)) * 3) : Math.round((1 - (local - TURN / 2) / (TURN / 2)) * 3);
        return [half ? before[i] : s, Math.min(3, f)];
      });
      paint(faces);
      if (!done) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    shown.current = [...states];
    return () => cancelAnimationFrame(raf.current);
  }, [states.join(','), u, gap, cols, width, height, pitch]);

  return <canvas ref={ref} className={`t-strip ${className}`} role="img" aria-label={label} style={{ width, height, imageRendering: 'pixelated' }} />;
}
