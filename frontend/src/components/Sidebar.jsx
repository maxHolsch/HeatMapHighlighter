import React from 'react';
import { Eyebrow, GShape, Icon } from './primitives';

const ITEMS = [
  { id: 'highlighter', label: 'Auto-Highlighter', icon: 'highlight' },
  { id: 'corpus',      label: 'Corpus heat',     icon: 'grid' },
  { id: 'anthology',   label: 'Anthologies',     icon: 'book' },
];

export default function Sidebar({ activeView, onNav, footer }) {
  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--plum-purple)', color: 'var(--paper)',
      borderRight: '2px solid var(--ink)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
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
          <div style={{ marginTop: 6, fontFamily: 'var(--font-display)', fontSize: 26, lineHeight: 1, letterSpacing: '-0.01em' }}>
            {footer?.title ?? <>MIT <em style={{ color: 'var(--cadmium)', fontStyle: 'italic' }}>CCC</em></>}
          </div>
        </div>
      </div>
    </aside>
  );
}
