import React, { useEffect, useRef, useState } from 'react';
import { Eyebrow, GShape, Icon } from './primitives';

const ITEMS = [
  { id: 'highlighter', label: 'Auto-Highlighter', icon: 'highlight' },
  { id: 'corpus',      label: 'Corpus heat',     icon: 'grid' },
  { id: 'anthology',   label: 'Anthologies',     icon: 'book' },
];

const SIDEBAR_W = 240;
const HOVER_ZONE = 22; // px from the left edge that triggers the reveal

// Hover-reveal sidebar. A thin invisible strip on the left edge listens for
// the cursor and slides the panel in. The panel itself also keeps the menu
// open while the cursor is over it. Pinned by default on touch devices where
// hover doesn't apply (no `hover: hover` media match).
export default function Sidebar({ activeView, onNav, footer }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  useEffect(() => {
    // On hover-incapable devices, leave the panel pinned so navigation still works.
    const mq = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(hover: hover)') : null;
    if (mq && !mq.matches) setOpen(true);
  }, []);

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }
  function cancelClose() {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }

  return (
    <>
      {/* edge hover trigger — invisible strip pinned to the left edge */}
      <div
        onMouseEnter={() => { cancelClose(); setOpen(true); }}
        onMouseLeave={scheduleClose}
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0,
          width: HOVER_ZONE, zIndex: 41,
        }}
      />
      {/* peek hint — a thin vertical chip so users know something is there */}
      <div aria-hidden style={{
        position: 'fixed', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 6, height: 64, borderRadius: '0 4px 4px 0',
        background: 'var(--vermillion)', boxShadow: '2px 0 0 0 var(--ink)',
        opacity: open ? 0 : 0.85,
        transition: 'opacity 200ms var(--ease-snap)',
        zIndex: 40, pointerEvents: 'none',
      }}/>

      <aside
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0,
          width: SIDEBAR_W,
          background: 'var(--plum-purple)', color: 'var(--paper)',
          borderRight: '2px solid var(--ink)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transform: open ? 'translateX(0)' : `translateX(-${SIDEBAR_W - 4}px)`,
          transition: 'transform 220ms cubic-bezier(.34,1.4,.64,1)',
          boxShadow: open ? '8px 0 24px rgba(0,0,0,0.18)' : 'none',
          zIndex: 42,
        }}>
        <div style={{ position: 'absolute', inset: 0,
          backgroundImage: 'var(--grain-svg)', backgroundSize: '320px 320px',
          mixBlendMode: 'screen', opacity: 0.10, pointerEvents: 'none' }}/>
        <GShape shape="leaf" color="vermillion" style={{ left: -28, top: -28, width: 110, height: 110, transform: 'rotate(8deg)', opacity: 0.95 }}/>
        <GShape shape="circle" color="cadmium" style={{ right: -18, top: 38, width: 36, height: 36 }}/>

        <div style={{ position: 'relative', padding: '24px 22px 18px', borderBottom: '2px solid rgba(245,239,226,0.18)' }}>
          <Eyebrow color="var(--cadmium)">A listening tool</Eyebrow>
          <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 38, lineHeight: 0.92, letterSpacing: '-0.02em' }}>
            Hu<em style={{ color: 'var(--cadmium)', fontStyle: 'italic', fontWeight: 400 }}>m</em>.
          </div>
          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'rgba(245,239,226,0.6)' }}>
            heat · spans · anthology
          </div>
        </div>

        <nav style={{ position: 'relative', padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button key={item.id} onClick={() => onNav(item.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', textAlign: 'left',
                  background: active ? 'var(--cadmium)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--paper)',
                  border: active ? '2px solid var(--ink)' : '2px solid transparent',
                  borderRadius: 8,
                  boxShadow: active ? '3px 3px 0 0 var(--vermillion)' : 'none',
                  fontFamily: 'var(--font-sans)', fontSize: 13.5, fontWeight: 700,
                  letterSpacing: '0.01em', cursor: 'pointer',
                  transition: 'all 140ms var(--ease-snap)',
                  position: 'relative', overflow: 'hidden',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(245,239,226,0.08)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <Icon name={item.icon} size={17}/>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ flex: 1 }}/>

        <div style={{ position: 'relative', margin: 14, padding: 14,
          background: 'var(--vermillion)', color: 'var(--paper)',
          border: '2px solid var(--ink)', borderRadius: 8,
          boxShadow: '4px 4px 0 0 var(--cadmium)', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0,
            backgroundImage: 'var(--grain-svg-coarse)', backgroundSize: '200px 200px',
            mixBlendMode: 'multiply', opacity: 0.5, pointerEvents: 'none' }}/>
          <div style={{ position: 'relative' }}>
            <Eyebrow color="var(--cadmium)">{footer?.eyebrow ?? 'With love'}</Eyebrow>
            <div style={{ marginTop: 6, fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1, letterSpacing: '-0.01em' }}>
              {footer?.title ?? <>MIT <em style={{ color: 'var(--cadmium)', fontStyle: 'italic' }}>CCC</em>.</>}
            </div>
            <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.85 }}>
              {footer?.meta ?? '— · —'}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
