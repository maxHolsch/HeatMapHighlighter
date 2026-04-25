import React, { useEffect, useRef, useState, useMemo } from 'react';

/*
  Canvas-rendered grid of conversation "fans". Each fan is a column
  of horizontal lines (one per snippet). Color encodes the fused
  query score; when no query is active, all snippets render at default
  neutral color. Non-matching snippets when a query is active dim via
  alpha reduction (the "grey-out" rule) — the full corpus is always
  present on screen.

  Interactions:
    - click a line -> onFocusSnippet
    - drag a rectangle -> onLassoSelect with snippet ids inside the rect
*/

const COLS = 10;
const FAN_H = 170;
const FAN_W = 36;
const PAD = 28;
const HEADER = 14;

function heatColor(score) {
  // 0..1 -> dark red -> amber gradient; clamp.
  const t = Math.max(0, Math.min(1, score));
  const r = Math.round(255 * t);
  const g = Math.round(200 * (1 - Math.abs(t - 0.6)));
  const b = Math.round(30 * (1 - t));
  return `rgb(${r}, ${Math.max(0, g)}, ${b})`;
}

function neutralColor(score) {
  // No query: render a faint constant so the corpus shape is visible.
  return `rgba(120, 120, 140, 0.45)`;
}

export default function FanGridCanvas({
  conversations,
  scores,
  threshold,
  focusSnippetId,
  onFocusSnippet,
  onLassoSelect,
}) {
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [lasso, setLasso] = useState(null);

  const layout = useMemo(() => {
    const rects = [];
    const convRects = {};
    const rows = Math.ceil(conversations.length / COLS);
    const w = PAD * 2 + COLS * (FAN_W + PAD);
    const h = PAD * 2 + rows * (FAN_H + PAD + HEADER);
    conversations.forEach((conv, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = PAD + col * (FAN_W + PAD);
      const y = PAD + row * (FAN_H + PAD + HEADER) + HEADER;
      convRects[conv.conversation_id] = { x, y, w: FAN_W, h: FAN_H, title: conv.title };
      const snips = conv.snippets;
      const n = Math.max(1, snips.length);
      for (let j = 0; j < snips.length; j++) {
        const sy = y + Math.floor((j / n) * FAN_H);
        const eh = Math.max(1, Math.ceil(FAN_H / n) - 1);
        rects.push({
          sid: snips[j].snippet_id,
          convId: conv.conversation_id,
          x,
          y: sy,
          w: FAN_W,
          h: eh,
          snippet: snips[j],
        });
      }
    });
    return { rects, convRects, w, h };
  }, [conversations]);

  const hasQuery = scores && Object.keys(scores).length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = layout.w * devicePixelRatio;
    canvas.height = layout.h * devicePixelRatio;
    canvas.style.width = `${layout.w}px`;
    canvas.style.height = `${layout.h}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.clearRect(0, 0, layout.w, layout.h);

    // Titles.
    ctx.fillStyle = '#666';
    ctx.font = '10px system-ui, sans-serif';
    for (const convId in layout.convRects) {
      const r = layout.convRects[convId];
      const t = r.title.length > 14 ? r.title.slice(0, 12) + '…' : r.title;
      ctx.fillText(t, r.x, r.y - 3);
    }

    // Snippet lines.
    for (const r of layout.rects) {
      let alpha = 1.0;
      let fill;
      if (hasQuery) {
        const sc = scores[r.sid];
        const fused = sc ? sc.fused : 0;
        if (fused < threshold) {
          alpha = 0.15;
          fill = `rgba(120, 120, 140, ${alpha})`;
        } else {
          fill = heatColor(fused);
        }
      } else {
        fill = neutralColor();
      }
      ctx.fillStyle = fill;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Focus ring.
    if (focusSnippetId) {
      const r = layout.rects.find((x) => x.sid === focusSnippetId);
      if (r) {
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3);
      }
    }

    // Lasso.
    if (lasso) {
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      const { x0, y0, x1, y1 } = lasso;
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.setLineDash([]);
    }
  }, [layout, scores, threshold, hasQuery, focusSnippetId, lasso]);

  const rectAt = (px, py) => {
    for (const r of layout.rects) {
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return r;
      }
    }
    return null;
  };

  const canvasPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const onMouseDown = (e) => {
    const p = canvasPos(e);
    if (e.shiftKey) {
      setLasso({ x0: p.x, y0: p.y, x1: p.x, y1: p.y, dragging: true });
    } else {
      const r = rectAt(p.x, p.y);
      if (r) onFocusSnippet(r.sid);
    }
  };
  const onMouseMove = (e) => {
    const p = canvasPos(e);
    if (lasso && lasso.dragging) {
      setLasso({ ...lasso, x1: p.x, y1: p.y });
      return;
    }
    const r = rectAt(p.x, p.y);
    if (r) {
      setHover({ x: p.x, y: p.y, r });
    } else if (hover) {
      setHover(null);
    }
  };
  const onMouseUp = (e) => {
    if (lasso && lasso.dragging) {
      const x0 = Math.min(lasso.x0, lasso.x1);
      const x1 = Math.max(lasso.x0, lasso.x1);
      const y0 = Math.min(lasso.y0, lasso.y1);
      const y1 = Math.max(lasso.y0, lasso.y1);
      const inside = layout.rects.filter(
        (r) => r.x + r.w >= x0 && r.x <= x1 && r.y + r.h >= y0 && r.y <= y1
      );
      setLasso(null);
      if (inside.length > 0) {
        onLassoSelect && onLassoSelect(inside.map((r) => r.sid));
      }
    }
  };

  return (
    <div className="fan-grid">
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div className="fan-tooltip" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="tt-title">{hover.r.snippet.text.slice(0, 120)}</div>
          {hasQuery && scores[hover.r.sid] && (
            <div className="tt-scores">
              <span>fused {scores[hover.r.sid].fused.toFixed(2)}</span>
              <span>style {scores[hover.r.sid].style.toFixed(2)}</span>
              <span>topic {scores[hover.r.sid].topic.toFixed(2)}</span>
            </div>
          )}
          <div className="tt-hint">Shift+drag to lasso similar snippets</div>
        </div>
      )}
    </div>
  );
}
