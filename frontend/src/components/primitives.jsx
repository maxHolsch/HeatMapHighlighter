import React, { useState, useEffect, useRef, useMemo } from 'react';

export function Icon({ name, size = 18, stroke = 'currentColor', strokeWidth = 2, style }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', style };
  switch (name) {
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14"/><path d="M5 12h14"/></svg>;
    case 'x': return <svg {...props}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
    case 'check': return <svg {...props}><path d="M20 6 9 17l-5-5"/></svg>;
    case 'play': return <svg {...props}><polygon points="6 3 20 12 6 21 6 3"/></svg>;
    case 'pause': return <svg {...props}><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
    case 'highlight': return <svg {...props}><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>;
    case 'grid': return <svg {...props}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
    case 'book': return <svg {...props}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>;
    case 'trend': return <svg {...props}><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>;
    case 'filter': return <svg {...props}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>;
    case 'wand': return <svg {...props}><path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/><path d="M17.8 11.8 19 13"/><path d="M15 9h0"/><path d="M17.8 6.2 19 5"/><path d="m3 21 9-9"/><path d="M12.2 6.2 11 5"/></svg>;
    case 'chevron-right': return <svg {...props}><path d="m9 18 6-6-6-6"/></svg>;
    case 'download': return <svg {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
    case 'trash': return <svg {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
    case 'lasso': return <svg {...props}><path d="M7 22a5 5 0 0 1-2-4"/><path d="M3.3 14A6.8 6.8 0 0 1 2 10c0-4.4 4.5-8 10-8s10 3.6 10 8-4.5 8-10 8a12 12 0 0 1-5-1"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>;
    case 'menu': return <svg {...props}><path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/></svg>;
    default: return null;
  }
}

export function GShape({ shape = 'circle', color = 'cobalt', style = {}, bleed }) {
  const radii = {
    circle: '50%', arch: '50% 50% 0 0 / 70% 70% 0 0', leaf: '0 50% 0 50%',
    leafR: '50% 0 50% 0', petal: '50% 50% 50% 0',
    blob: '60% 40% 55% 45% / 50% 60% 40% 50%', pill: '999px', square: '4px',
  };
  const fills = {
    cobalt: 'var(--cobalt)', cadmium: 'var(--cadmium)', vermillion: 'var(--vermillion)',
    hotpink: 'var(--hotpink)', grass: 'var(--grass)', ink: 'var(--ink)',
    paper: 'var(--paper)', paperWarm: 'var(--paper-warm)', bone: 'var(--bone)',
  };
  return (
    <div className={`gshape ${bleed ? 'bleed-' + bleed : ''}`}
      style={{ background: fills[color] || color, borderRadius: radii[shape] || shape,
        position: 'absolute', ...style }} />
  );
}

export function Burst({ size = 60, color = 'var(--ink)', style = {}, strokeWidth = 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ overflow: 'visible', ...style }}>
      <g stroke={color} strokeWidth={strokeWidth} strokeLinecap="round">
        <line x1="50" y1="6" x2="50" y2="22"/><line x1="50" y1="78" x2="50" y2="94"/>
        <line x1="6" y1="50" x2="22" y2="50"/><line x1="78" y1="50" x2="94" y2="50"/>
        <line x1="18" y1="18" x2="30" y2="30"/><line x1="70" y1="70" x2="82" y2="82"/>
        <line x1="82" y1="18" x2="70" y2="30"/><line x1="30" y1="70" x2="18" y2="82"/>
      </g>
    </svg>
  );
}

export function Scribble({ width = 120, color = 'var(--vermillion)', strokeWidth = 4, style = {} }) {
  return (
    <svg width={width} height="14" viewBox="0 0 120 14" style={{ ...style }} preserveAspectRatio="none">
      <path d="M2 8 Q 12 2, 22 8 T 42 8 T 62 8 T 82 8 T 102 8 T 118 8"
        stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" fill="none"/>
    </svg>
  );
}

// Five hand-drawn pill variants. Each is a closed Catmull-Rom path around a
// stretched ellipse with mild, calligraphy-like deviations. Variants differ in
// segment count, jitter amplitude, asymmetry, and corner softness so the same
// component picks a different shape per seed without ever looking jagged.
const SCRIBBLE_VARIANTS = [
  // 0 — soft pill, almost smooth
  { N: 22, jitter: 0.022, sway: 0.012, twist: 0.04, capRatio: 0.55, roundness: 0.62 },
  // 1 — slightly squat, gentle bulge on top
  { N: 24, jitter: 0.030, sway: 0.020, twist: 0.06, capRatio: 0.50, roundness: 0.58 },
  // 2 — long-limbed pill with subtle wave
  { N: 26, jitter: 0.028, sway: 0.024, twist: 0.05, capRatio: 0.60, roundness: 0.66 },
  // 3 — slightly diamond-asymmetric, like a marker stroke
  { N: 24, jitter: 0.034, sway: 0.018, twist: 0.09, capRatio: 0.48, roundness: 0.55 },
  // 4 — relaxed, cloud-like
  { N: 28, jitter: 0.026, sway: 0.030, twist: 0.05, capRatio: 0.62, roundness: 0.70 },
];

function variantForSeed(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const idx = Math.abs(s) % SCRIBBLE_VARIANTS.length;
  return idx;
}

function scribblePath(seed, w, h, variantIdx) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000; };

  const v = SCRIBBLE_VARIANTS[variantIdx ?? variantForSeed(seed)];
  const { N, jitter, sway, twist, capRatio, roundness } = v;

  const r = h / 2;
  const flatW = Math.max(0, w - h * (1 + (1 - roundness)));
  const phase = rand() * Math.PI * 2;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cx = w / 2, cy = h / 2;
    const sx = Math.cos(t), sy = Math.sin(t);
    // Cap factor — softer wobble on the rounded ends so they read as "drawn caps".
    const capFactor = Math.abs(sx) > 0.7 ? capRatio : 1.0;
    // Smooth low-frequency sway across the perimeter — gives the line a relaxed,
    // hand-pulled feel without micro jaggies.
    const swayY = Math.sin(t * 2 + phase) * (h * sway);
    const swayX = Math.cos(t * 3 + phase) * (w * sway * 0.35);
    const px = cx + (sx >= 0 ? flatW / 2 : -flatW / 2) + r * sx * 0.55 + swayX * capFactor;
    const py = cy + r * sy + swayY * capFactor;
    // Per-point micro jitter, intentionally small.
    const j = (rand() - 0.5) * (h * jitter) * capFactor;
    // Slight tangential twist that gives a subtle marker-pressure look.
    const tw = (rand() - 0.5) * (h * twist) * capFactor;
    pts.push([px + sx * j - sy * tw, py + sy * j + sx * tw]);
  }
  const cr = (p0, p1, p2, p3) => {
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    return `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  };
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const p3 = pts[(i + 2) % pts.length];
    d += cr(p0, p1, p2, p3);
  }
  d += 'Z';
  return d;
}

export function ScribbleBlob({ seed, fill, stroke, strokeWidth = 2, style, variant }) {
  const W = 200, H = 52;
  const v = variant != null ? (variant % SCRIBBLE_VARIANTS.length) : variantForSeed(seed);
  const d = scribblePath(seed, W, H, v);
  return (
    <svg viewBox={`-3 -3 ${W+6} ${H+6}`} preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={stroke && stroke !== 'none' ? strokeWidth : 0}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

export function Btn({ children, kind = 'ink', size = 'md', onClick, icon, disabled, type, full, style: extra }) {
  const colors = {
    ink: { bg: 'var(--ink)', fg: 'var(--paper)' },
    cobalt: { bg: 'var(--cobalt)', fg: 'var(--paper)' },
    cadmium: { bg: 'var(--cadmium)', fg: 'var(--ink)' },
    vermil: { bg: 'var(--vermillion)', fg: 'var(--paper)' },
    hotpink: { bg: 'var(--hotpink)', fg: 'var(--ink)' },
    paper: { bg: 'var(--paper)', fg: 'var(--ink)' },
    ghost: { bg: 'transparent', fg: 'var(--ink)' },
  }[kind];
  const sz = size === 'sm'
    ? { padX: 18, padY: 10, fontSize: 11.5, h: 34, shadowDx: 3 }
    : size === 'lg'
    ? { padX: 32, padY: 16, fontSize: 15, h: 50, shadowDx: 5 }
    : { padX: 26, padY: 13, fontSize: 13, h: 42, shadowDx: 4 };

  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const seedKey = `${kind}-${size}-${(typeof children === 'string' ? children : icon || 'x').slice(0,12)}`;

  const offset = active ? 1 : (hover ? sz.shadowDx + 1 : sz.shadowDx);
  const shadowVisible = kind !== 'ghost';

  return (
    <button onClick={onClick} disabled={disabled} type={type}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      style={{
        fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.02em',
        textTransform: 'none',
        border: 'none', background: 'transparent', padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        position: 'relative', display: full ? 'block' : 'inline-block',
        width: full ? '100%' : 'auto',
        transition: 'transform 140ms var(--ease-snap)',
        transform: active ? 'translate(2px,2px)' : (hover && !disabled ? 'translate(-1px,-1px)' : 'none'),
        ...extra,
      }}>
      <span style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: `${sz.padY}px ${sz.padX}px`, fontSize: sz.fontSize,
        color: colors.fg, width: full ? '100%' : 'auto', boxSizing: 'border-box',
        minHeight: sz.h, lineHeight: 1,
      }}>
        {shadowVisible && (
          <ScribbleBlob seed={seedKey + '-sh'} fill="var(--ink)" stroke="none"
            style={{ position: 'absolute', inset: 0, transform: `translate(${offset}px, ${offset}px)`, zIndex: 0,
              transition: 'transform 140ms var(--ease-snap)', pointerEvents: 'none' }}/>
        )}
        <ScribbleBlob seed={seedKey} fill={colors.bg} stroke="var(--ink)" strokeWidth={2.2}
          style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}/>
        <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {icon && <Icon name={icon} size={14}/>}
          {children}
        </span>
      </span>
    </button>
  );
}

export function Badge({ children, kind = 'default', dot, size = 'md' }) {
  const map = {
    default: { bg: 'var(--paper-warm)', fg: 'var(--ink)' },
    info: { bg: 'var(--cobalt)', fg: 'var(--paper)' },
    warn: { bg: 'var(--cadmium)', fg: 'var(--ink)' },
    danger: { bg: 'var(--vermillion)', fg: 'var(--paper)' },
    soft: { bg: 'var(--hotpink-soft)', fg: 'var(--ink)' },
    ok: { bg: 'var(--grass)', fg: 'var(--paper)' },
    ink: { bg: 'var(--ink)', fg: 'var(--paper)' },
  }[kind];
  const sz = size === 'sm' ? { p: '2px 8px', f: 10 } : { p: '4px 10px', f: 11.5 };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: sz.f,
      letterSpacing: '.08em', textTransform: 'uppercase',
      padding: sz.p, borderRadius: 999, border: '2px solid var(--ink)',
      background: map.bg, color: map.fg,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }}/>}
      {children}
    </span>
  );
}

export function Eyebrow({ children, color = 'var(--vermillion)', style }) {
  return (
    <div style={{
      fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 11,
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color, ...style,
    }}>{children}</div>
  );
}

export function Display({ children, size = 56, color = 'var(--ink)', style = {} }) {
  return (
    <h1 style={{
      fontFamily: 'var(--font-display)', fontWeight: 400,
      fontSize: size, lineHeight: 0.98, letterSpacing: '-0.02em',
      color, margin: 0, textWrap: 'pretty', ...style,
    }}>{children}</h1>
  );
}

export function Em({ children, color = 'var(--vermillion)' }) {
  return <em style={{ fontStyle: 'italic', color, fontWeight: 400 }}>{children}</em>;
}

export function Card({ children, style = {}, padding = 22, shadow = 'var(--sh-print)', bg = 'var(--paper)', radius = 10, withGrain = true }) {
  return (
    <section style={{
      background: bg, border: '2px solid var(--ink)', borderRadius: radius,
      padding, position: 'relative', boxShadow: shadow, overflow: 'hidden',
      ...style,
    }}>
      {withGrain && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
          backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.08, pointerEvents: 'none' }}/>
      )}
      <div style={{ position: 'relative' }}>{children}</div>
    </section>
  );
}

function handPath(seed, x1, y1, x2, y2, segments = 7, amp = 1.2) {
  let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000 - 0.5; };
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  let d = `M ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const j = (i === segments) ? 0 : rand() * 2 * amp;
    const x = x1 + dx * t + px * j;
    const y = y1 + dy * t + py * j;
    d += ` L ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  return d;
}

export function HandFrame({ overshoot = 7, stroke = 'var(--ink)', strokeWidth = 1.6, fill = 'var(--paper-warm)', focus = false, seed = 'f', style, children, padding }) {
  const ref = useRef(null);
  const [dim, setDim] = useState({ w: 200, h: 44 });
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      if (r.width && r.height) setDim({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const { w, h } = dim;
  const o = overshoot;
  const fSeed = String(seed).replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, background: fill, zIndex: 0, pointerEvents: 'none',
      }}/>
      <svg width={w + o * 4} height={h + o * 4}
           viewBox={`${-o*2} ${-o*2} ${w + o*4} ${h + o*4}`}
           style={{ position: 'absolute', left: -o*2, top: -o*2,
                    pointerEvents: 'none', overflow: 'visible', zIndex: 1 }}>
        <defs>
          <filter id={`rough-${fSeed}`} x="-10%" y="-30%" width="120%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed={fSeed.length || 3}/>
            <feDisplacementMap in="SourceGraphic" scale="0.9"/>
          </filter>
        </defs>
        <g stroke={stroke} strokeWidth={focus ? strokeWidth + 0.3 : strokeWidth} fill="none"
           strokeLinecap="round" strokeLinejoin="round"
           filter={`url(#rough-${fSeed})`}
           opacity={focus ? 1 : 0.92}>
          <path d={handPath(fSeed + 't',  -o*0.7, 1.0,    w + o*0.6, 1.4,  10, 0.7)}/>
          <path d={handPath(fSeed + 'r',  w - 0.6, -o*0.6, w - 1.1,   h + o*0.7, 8, 0.6)}/>
          <path d={handPath(fSeed + 'b',  w + o*0.5, h - 0.8,  -o*0.7, h - 1.4, 10, 0.7)}/>
          <path d={handPath(fSeed + 'l',  1.4, h + o*0.5,  0.7, -o*0.6, 8, 0.6)}/>
          <g opacity="0.45">
            <path d={handPath(fSeed + 't2', -o*0.4, 2.4,    w + o*0.3, 0.4,  8, 0.5)}/>
            <path d={handPath(fSeed + 'r2', w - 1.6, -o*0.3, w - 0.4,   h + o*0.4, 7, 0.5)}/>
            <path d={handPath(fSeed + 'b2', w + o*0.3, h - 1.8, -o*0.4, h - 0.6, 8, 0.5)}/>
            <path d={handPath(fSeed + 'l2', 0.6, h + o*0.3,  1.7, -o*0.4, 7, 0.5)}/>
          </g>
        </g>
      </svg>
      <div aria-hidden style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        backgroundImage: 'var(--grain-svg)', backgroundSize: '180px 180px',
        mixBlendMode: 'multiply', opacity: 0.22,
      }}/>
      <div style={{ position: 'relative', zIndex: 3, padding }}>{children}</div>
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, multiline, rows = 3, monospace, style, onBlur }) {
  const [focus, setFocus] = useState(false);
  const seedRef = useRef('ti' + Math.floor(Math.random() * 9999));
  const Tag = multiline ? 'textarea' : 'input';
  const minH = multiline ? rows * 22 + 24 : 44;
  return (
    <HandFrame seed={seedRef.current} focus={focus} style={{ width: '100%', minHeight: minH, ...style }}>
      <Tag value={value} onChange={(e) => onChange?.(e.target.value)}
        onBlur={(e) => { setFocus(false); onBlur?.(e); }}
        onFocus={() => setFocus(true)}
        placeholder={placeholder} rows={multiline ? rows : undefined}
        style={{
          width: '100%', boxSizing: 'border-box',
          fontFamily: monospace ? 'var(--font-mono)' : 'var(--font-sans)',
          fontSize: 14, lineHeight: 1.5, fontWeight: 500,
          padding: multiline ? '12px 14px' : '12px 14px',
          background: 'transparent', color: 'var(--ink)',
          border: 'none', outline: 'none',
          resize: multiline ? 'vertical' : 'none',
          minHeight: multiline ? rows * 22 : 40,
          display: 'block',
        }}/>
    </HandFrame>
  );
}

export function Select({ value, onChange, options, placeholder, disabled, style }) {
  const [focus, setFocus] = useState(false);
  const seedRef = useRef('sel' + Math.floor(Math.random() * 9999));
  return (
    <HandFrame seed={seedRef.current} focus={focus} style={{ width: '100%', minHeight: 44, ...style }}>
      <div style={{ position: 'relative' }}>
        <select value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} disabled={disabled}
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          style={{
            width: '100%', fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
            padding: '12px 32px 12px 14px',
            background: 'transparent', color: 'var(--ink)',
            border: 'none', borderRadius: 0,
            appearance: 'none', outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}>
          {placeholder && <option value="">{placeholder}</option>}
          {options?.map((o) => typeof o === 'string'
            ? <option key={o} value={o}>{o}</option>
            : <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <svg width="14" height="20" viewBox="0 0 14 20"
             style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      pointerEvents: 'none', overflow: 'visible' }}>
          <g stroke="var(--ink)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.2 7.4 L 7 2.6 L 12.1 7.2"/>
            <path d="M2.0 12.6 L 7.1 17.5 L 11.9 12.4"/>
          </g>
        </svg>
      </div>
    </HandFrame>
  );
}

export function HandToggle({ value, onChange, label, color = 'var(--cobalt)' }) {
  const seedRef = useRef('tg' + Math.floor(Math.random() * 9999));
  const seed = seedRef.current;
  const trackPath = useMemo(() => {
    let s = 0; for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000 - 0.5; };
    const W = 56, H = 28, r = H / 2, cy = H / 2;
    const N = 28; let d = '';
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      let cx = W / 2;
      let px, py;
      if (Math.cos(t) > 0) {
        cx = W - r;
      } else {
        cx = r;
      }
      px = cx + Math.cos(t) * r + rand() * 0.7;
      py = cy + Math.sin(t) * r + rand() * 0.7;
      d += (i === 0 ? 'M' : 'L') + ` ${px.toFixed(2)} ${py.toFixed(2)}`;
    }
    d += ' Z';
    return d;
  }, [seed]);
  return (
    <button type="button" onClick={() => onChange?.(!value)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
        fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500, color: 'var(--ink)',
      }}>
      <span style={{ position: 'relative', width: 56, height: 28, display: 'inline-block' }}>
        <svg width="56" height="28" viewBox="-3 -3 62 34" style={{ overflow: 'visible' }}>
          <defs>
            <filter id={`tg-rough-${seed}`} x="-10%" y="-10%" width="120%" height="120%">
              <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed={seed.length}/>
              <feDisplacementMap in="SourceGraphic" scale="0.7"/>
            </filter>
          </defs>
          <path d={trackPath} fill={value ? color : 'var(--bone)'}
                stroke="var(--ink)" strokeWidth="1.6"
                filter={`url(#tg-rough-${seed})`}
                strokeLinejoin="round"/>
          <g style={{ transition: 'transform 160ms var(--ease-snap)',
                      transform: value ? 'translateX(28px)' : 'translateX(0px)' }}
             filter={`url(#tg-rough-${seed})`}>
            <circle cx="14" cy="14" r="10" fill="var(--paper)" stroke="var(--ink)" strokeWidth="1.6"/>
            <circle cx="14" cy="14" r="10" fill="none" stroke="var(--ink)" strokeWidth="0.8" opacity="0.5"
                    transform="rotate(8 14 14) translate(0.4 -0.3)"/>
          </g>
        </svg>
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}

// Hand-drawn round button (used for play/pause and other circular actions).
// Renders a slightly wobbly disc + ink stroke so audio controls feel of-a-piece
// with the rest of the marker-and-paper UI.
export function HandCircleBtn({
  onClick, ariaLabel, size = 38, fill = 'var(--ink)', fg = 'var(--paper)',
  stroke = 'var(--ink)', strokeWidth = 1.8, seed = 'cb', children, disabled,
}) {
  const sSeed = String(seed).replace(/[^a-zA-Z0-9_-]/g, '') || 'cb';
  const wobblePath = useMemo(() => {
    let s = 0; for (let i = 0; i < sSeed.length; i++) s = (s * 31 + sSeed.charCodeAt(i)) | 0;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000 - 0.5; };
    const cx = 50, cy = 50, r = 44, N = 28;
    const pts = [];
    const phase = (Math.abs(s) % 1000) / 1000 * Math.PI * 2;
    for (let i = 0; i < N; i++) {
      const t = (i / N) * Math.PI * 2;
      const sway = Math.sin(t * 3 + phase) * 1.2 + rand() * 1.2;
      const rr = r + sway;
      pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
    }
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      const p3 = pts[(i + 2) % pts.length];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6;
      const c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6;
      const c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    d += 'Z';
    return d;
  }, [sSeed]);
  const [hover, setHover] = useState(false);
  const [active, setActive] = useState(false);
  const lift = active ? 0 : (hover && !disabled ? 2 : 1);
  return (
    <button onClick={onClick} aria-label={ariaLabel} disabled={disabled}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setActive(false); }}
      onMouseDown={() => setActive(true)} onMouseUp={() => setActive(false)}
      style={{
        width: size, height: size, padding: 0, background: 'transparent', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', position: 'relative',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
        transform: active ? 'translate(1px,1px)' : 'none',
        transition: 'transform 120ms var(--ease-snap)',
      }}>
      <svg width={size} height={size} viewBox="0 0 100 100"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* drop shadow disc */}
        <path d={wobblePath} fill={stroke} opacity="0.95"
          transform={`translate(${lift + 1}, ${lift + 1.5})`}/>
        <path d={wobblePath} fill={fill} stroke={stroke} strokeWidth={strokeWidth}
          strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
      <span style={{ position: 'relative', color: fg, display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center', lineHeight: 0 }}>
        {children}
      </span>
    </button>
  );
}

// A relaxed, hand-drawn audio progress track. Pure visual — value 0..1.
export function HandProgressBar({ value, height = 10, fill = 'var(--cadmium)',
  track = 'var(--bone)', stroke = 'var(--ink)', seed = 'pb', style }) {
  const sSeed = String(seed).replace(/[^a-zA-Z0-9_-]/g, '') || 'pb';
  const { topPath, botPath } = useMemo(() => {
    let s = 0; for (let i = 0; i < sSeed.length; i++) s = (s * 31 + sSeed.charCodeAt(i)) | 0;
    const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000 - 0.5; };
    const W = 200, H = 12, N = 14;
    const top = [];
    const bot = [];
    const phase = (Math.abs(s) % 1000) / 1000 * Math.PI * 2;
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W;
      const j1 = Math.sin(i * 0.7 + phase) * 0.7 + rand() * 0.6;
      const j2 = Math.sin(i * 0.9 + phase + 1) * 0.7 + rand() * 0.6;
      top.push([x, 0 + j1]);
      bot.push([x, H + j2]);
    }
    const toD = (pts) => pts.map((p, i) => (i === 0 ? 'M' : 'L') + ` ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    return { topPath: toD(top), botPath: toD(bot) };
  }, [sSeed]);
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div style={{ position: 'relative', flex: 1, height, ...style }}>
      <svg viewBox="0 0 200 12" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <clipPath id={`pbclip-${sSeed}`}>
            <rect x="0" y="-2" width={200 * v} height="16"/>
          </clipPath>
        </defs>
        <path d={topPath} stroke={stroke} strokeWidth="1.4" fill="none"
          strokeLinecap="round" strokeLinejoin="round"/>
        <path d={botPath} stroke={stroke} strokeWidth="1.4" fill="none"
          strokeLinecap="round" strokeLinejoin="round"/>
        <path d={`${topPath} L 200 12 L 0 12 Z`} fill={track}/>
        <g clipPath={`url(#pbclip-${sSeed})`}>
          <path d={`${topPath} L 200 12 L 0 12 Z`} fill={fill}/>
        </g>
      </svg>
    </div>
  );
}

export function Modal({ children, onClose, maxWidth = 460 }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(18,12,6,0.45)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10,
          boxShadow: '8px 8px 0 0 var(--ink)', padding: 28, maxWidth, width: 'calc(100% - 40px)',
          position: 'relative', overflow: 'hidden',
        }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
          backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.08, pointerEvents: 'none' }}/>
        <GShape shape="leaf" color="cadmium" style={{ right: -20, top: -20, width: 80, height: 80, transform: 'rotate(28deg)' }}/>
        <div style={{ position: 'relative' }}>{children}</div>
      </div>
    </div>
  );
}
