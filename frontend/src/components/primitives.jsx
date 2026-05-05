import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SCRIBBLE_RECT_PATH, SCRIBBLE_RECT_VIEWBOX } from './scribbleRectPath';

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

// Five hand-drawn shape variants for buttons. Each takes a seed (deterministic
// jitter) and returns an SVG path. Shapes are smooth (Catmull–Rom) but still
// hand-drawn: minor wobble, asymmetric cap radii, an occasional dip or bulge.
function variantPill(seed, w, h, rand) {
  const r = h / 2;
  const N = 18;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cx = w / 2, cy = h / 2;
    const sx = Math.cos(t), sy = Math.sin(t);
    const flatW = w - h;
    const px = cx + (sx >= 0 ? flatW/2 : -flatW/2) + r * sx * 0.55;
    const py = cy + r * sy;
    const j = (rand() - 0.5) * (h * 0.025);
    pts.push([px + sx * j, py + sy * j]);
  }
  return pts;
}
function variantLozenge(seed, w, h, rand) {
  const N = 22;
  const pts = [];
  const rx = w * 0.5, ry = h * 0.46;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cx = w / 2 + (rand() - 0.5) * w * 0.005;
    const cy = h / 2;
    const stretch = 1 + Math.cos(t * 2) * 0.04;
    const px = cx + Math.cos(t) * rx * stretch;
    const py = cy + Math.sin(t) * ry;
    pts.push([px + (rand() - 0.5) * h * 0.03, py + (rand() - 0.5) * h * 0.03]);
  }
  return pts;
}
function variantTab(seed, w, h, rand) {
  // gently tilted rounded rectangle with a soft shoulder on the top-right.
  const N = 24;
  const pts = [];
  const r = h * 0.55;
  const tilt = 0.03 * h;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const cx = w / 2, cy = h / 2;
    const sx = Math.cos(t), sy = Math.sin(t);
    const flatW = w - h * 1.05;
    const lift = (sx > 0 ? -tilt : tilt) * Math.abs(sy);
    const shoulder = (sx > 0.5 && sy < 0) ? -h * 0.06 : 0;
    const px = cx + (sx >= 0 ? flatW/2 : -flatW/2) + r * sx * 0.5;
    const py = cy + r * sy + lift + shoulder;
    pts.push([px + (rand() - 0.5) * h * 0.02, py + (rand() - 0.5) * h * 0.02]);
  }
  return pts;
}
function variantPebble(seed, w, h, rand) {
  // organic blob — wider on the left, slimmer on the right.
  const N = 20;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const taper = 1 + Math.cos(t) * 0.08;
    const lobeY = 1 + Math.sin(t * 3) * 0.02;
    const cx = w / 2 + (rand() - 0.5) * w * 0.005;
    const cy = h / 2;
    const flatW = w - h;
    const sx = Math.cos(t), sy = Math.sin(t);
    const px = cx + (sx >= 0 ? flatW/2 : -flatW/2) * taper + (h / 2) * sx * 0.55;
    const py = cy + (h / 2) * sy * lobeY;
    pts.push([px + (rand() - 0.5) * h * 0.03, py + (rand() - 0.5) * h * 0.03]);
  }
  return pts;
}
function variantStamp(seed, w, h, rand) {
  // crisp, slightly trapezoidal shape — the "rubber stamp"
  const N = 26;
  const pts = [];
  const r = h * 0.5;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const sx = Math.cos(t), sy = Math.sin(t);
    const flatW = w - h * 1.1;
    const slant = sy < 0 ? -h * 0.04 * sx : h * 0.04 * sx;
    const cx = w / 2, cy = h / 2;
    const px = cx + (sx >= 0 ? flatW/2 : -flatW/2) + r * sx * 0.42 + slant;
    const py = cy + r * sy * 0.94;
    pts.push([px + (rand() - 0.5) * h * 0.025, py + (rand() - 0.5) * h * 0.025]);
  }
  return pts;
}

const VARIANTS = [variantPill, variantLozenge, variantTab, variantPebble, variantStamp];

function pointsToPath(pts) {
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

function seedHash(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) | 0;
  return s;
}

function scribblePath(seed, w, h) {
  let s = seedHash(seed);
  const rand = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return (s % 1000) / 1000; };
  const variantIdx = Math.abs(seedHash(seed + '-v')) % VARIANTS.length;
  const pts = VARIANTS[variantIdx](seed, w, h, rand);
  return pointsToPath(pts);
}

export function ScribbleBlob({ seed, fill, stroke, strokeWidth = 2, style }) {
  const W = 200, H = 52;
  const d = scribblePath(seed, W, H);
  return (
    <svg viewBox={`-3 -3 ${W+6} ${H+6}`} preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      <path d={d} fill={fill} stroke={stroke} strokeWidth={stroke && stroke !== 'none' ? strokeWidth : 0}
        strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
    </svg>
  );
}

// Hand-drawn scribbled rectangle: many overlapping wobbly outlines that read as
// Hand-traced scribble rectangle — vectorized from the source PNG via potrace.
// The path is a filled silhouette of the white pen marks, so we render it with
// `fill={stroke}` (no stroke). It stretches across the button via
// preserveAspectRatio="none".
export function ScribbleRect({ seed: _seed, stroke = 'var(--ink)', style }) {
  return (
    <svg viewBox={SCRIBBLE_RECT_VIEWBOX} preserveAspectRatio="none"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      <g transform="translate(0,308) scale(0.1,-0.1)" fill={stroke} stroke="none" fillRule="evenodd">
        <path d={SCRIBBLE_RECT_PATH} />
      </g>
    </svg>
  );
}

export function Btn({ children, kind = 'ink', size = 'md', onClick, icon, disabled, type, full, frameNudgeY = 0, style: extra, contentStyle }) {
  const colors = {
    ink: { bg: 'transparent', fg: 'var(--ink)' },
    'ink-cobalt': { bg: 'var(--cobalt)', fg: 'var(--paper)' },
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
  const isInk = kind === 'ink';
  const isInkCobalt = kind === 'ink-cobalt';
  const shadowVisible = kind !== 'ghost' && !isInk && !isInkCobalt;
  const nudge = Number(frameNudgeY) || 0;
  const frameTransform = nudge ? `translateY(${nudge}px)` : undefined;
  const inkCobaltBlobTransform = `translateY(${nudge - 10}px)`;
  const shadowTransform = nudge
    ? `translate(${offset}px, ${offset + nudge}px)`
    : `translate(${offset}px, ${offset}px)`;

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
        padding: kind === 'ghost'
          ? `0 ${sz.padX}px`
          : `${isInkCobalt ? 1 : sz.padY}px ${sz.padX}px`, fontSize: sz.fontSize,
        color: colors.fg, width: full ? '100%' : 'auto', boxSizing: 'border-box',
        minHeight: sz.h, lineHeight: 1,
      }}>
        {shadowVisible && (
          <ScribbleBlob seed={seedKey + '-sh'} fill="var(--ink)" stroke="none"
            style={{ position: 'absolute', inset: 0, transform: shadowTransform, zIndex: 0,
              transition: 'transform 140ms var(--ease-snap)', pointerEvents: 'none',
              paddingTop: 10, paddingBottom: 10 }}/>
        )}
        {isInk ? (
          <ScribbleRect seed={seedKey} stroke="var(--ink)"
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', transform: frameTransform,
              paddingTop: 23, paddingBottom: 23 }}/>
        ) : isInkCobalt ? (
          <ScribbleBlob seed={seedKey} fill="var(--cobalt)" stroke="var(--ink)" strokeWidth={2.2}
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', transform: inkCobaltBlobTransform, paddingTop: 17, paddingBottom: 17 }}/>
        ) : (
          <ScribbleBlob seed={seedKey} fill={colors.bg} stroke="var(--ink)" strokeWidth={2.2}
            style={{
              position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', transform: frameTransform,
              ...(kind === 'ghost' ? { marginTop: 10, marginBottom: 10 } : {}),
            }}/>
        )}
        <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 8, paddingTop: isInkCobalt ? 0 : 9, paddingBottom: isInkCobalt ? 0 : 9, ...contentStyle }}>
          {icon && <Icon name={icon} size={14}/>}
          {children}
        </span>
      </span>
    </button>
  );
}

export function Badge({ children, kind = 'default', dot, size = 'md', style: extra }) {
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
  if (kind === 'btn-ink' || kind === 'btn-info') {
    const seedKey = `badge-${size}-${(typeof children === 'string' ? children : 'badge').slice(0, 12)}`;
    const isInfo = kind === 'btn-info';
    return (
      <span style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        padding: '13px 26px', fontSize: 13,
        color: isInfo ? 'var(--paper)' : 'var(--ink)', width: 'auto', boxSizing: 'border-box',
        minHeight: 42, lineHeight: 1, fontFamily: 'var(--font-sans)', fontWeight: 700, letterSpacing: '0.02em',
        textTransform: 'none',
        ...extra,
      }}>
        {isInfo ? (
          <ScribbleBlob seed={seedKey} fill="var(--cobalt)" stroke="var(--ink)" strokeWidth={2.2}
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}/>
        ) : (
          <ScribbleRect seed={seedKey} stroke="var(--ink)"
            style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}/>
        )}
        <span style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }}/>}
          {children}
        </span>
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: sz.f,
      letterSpacing: '.08em', textTransform: 'uppercase',
      padding: sz.p, borderRadius: 999, border: '2px solid var(--ink)',
      background: map.bg, color: map.fg,
      ...extra,
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

function getIsoShadowSpec(shadow) {
  if (!shadow || shadow === 'none') return null;
  if (shadow === 'var(--sh-print)') return { dx: 4, dy: 4, color: 'var(--ink)' };
  if (shadow === 'var(--sh-print-cobalt)') return { dx: 6, dy: 6, color: 'var(--cobalt)' };
  if (shadow === 'var(--sh-print-vermil)') return { dx: 6, dy: 6, color: 'var(--vermillion)' };

  const offsetMatch = String(shadow).match(/(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/);
  const colorMatches = String(shadow).match(/var\(--[^)]+\)|#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)/g);
  return {
    dx: offsetMatch ? Math.abs(Number(offsetMatch[1])) : 4,
    dy: offsetMatch ? Math.abs(Number(offsetMatch[2])) : 4,
    color: colorMatches?.at(-1) || 'var(--ink)',
  };
}

// Hand-derived isometric extrusion for a rounded rectangle.
//
// For a rounded rect (W × H, corner radius r) extruded by depth (dx, dy),
// a boundary point with outward normal n is back-visible iff n·(dx,dy) > 0.
//   • Right edge n=(+1,0): back-visible when dx>0
//   • Bottom edge n=(0,+1): back-visible when dy>0
//   • BR corner sweeps n from (+1,0) to (0,+1) — fully back-visible
//   • TR corner: boundary at θ_tr = atan2(-dx, dy)  (visible from θ_tr → 0)
//   • BL corner: boundary at θ_bl = π - atan2(dx, dy)  (visible from π/2 → θ_bl)
// The two boundary points are the cube's silhouette tangents; the back outline
// is the front silhouette translated by (dx, dy); the depth edges connect
// matched pairs of silhouette + corner-transition points.
function IsoDepthLines({ dx = 0, dy = 0, color = 'var(--ink)', borderColor = 'var(--ink)', radius = 10 }) {
  const ref = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      const box = e.borderBoxSize?.[0];
      const w = box ? box.inlineSize : e.contentRect.width;
      const h = box ? box.blockSize : e.contentRect.height;
      if (w && h) setSize({ w: Math.round(w), h: Math.round(h) });
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const W = size.w, H = size.h;
  if (W < 4 || H < 4) {
    return <span ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />;
  }

  const r = Math.max(0, Math.min(radius, W / 2, H / 2));
  const hasDepth = dx > 0 || dy > 0;

  // Front rounded-rect outline. Stroke is centered on the path, so insetting
  // by 1px keeps the visible line within the section's 2px transparent border
  // — geometry stays identical to the previous CSS border.
  const frontD = [
    `M ${r} 1`,
    `L ${W - r} 1`,
    `A ${r - 1} ${r - 1} 0 0 1 ${W - 1} ${r}`,
    `L ${W - 1} ${H - r}`,
    `A ${r - 1} ${r - 1} 0 0 1 ${W - r} ${H - 1}`,
    `L ${r} ${H - 1}`,
    `A ${r - 1} ${r - 1} 0 0 1 1 ${H - r}`,
    `L 1 ${r}`,
    `A ${r - 1} ${r - 1} 0 0 1 ${r} 1`,
    `Z`,
  ].join(' ');

  let backD = null;
  let depthPoints = [];
  if (hasDepth) {
    // n·(dx,dy) > 0 ⇒ back-visible. TR/BL corners split at:
    //   θ_tr = atan2(-dx, dy),   θ_bl = π - atan2(dx, dy).
    const theta_tr = Math.atan2(-dx, dy);
    const theta_bl = Math.PI - Math.atan2(dx, dy);
    const trTangent = [W - r + r * Math.cos(theta_tr), r + r * Math.sin(theta_tr)];
    const blTangent = [r + r * Math.cos(theta_bl), H - r + r * Math.sin(theta_bl)];
    backD = [
      `M ${(trTangent[0] + dx).toFixed(2)} ${(trTangent[1] + dy).toFixed(2)}`,
      `A ${r} ${r} 0 0 1 ${(W + dx).toFixed(2)} ${(r + dy).toFixed(2)}`,
      `L ${(W + dx).toFixed(2)} ${(H - r + dy).toFixed(2)}`,
      `A ${r} ${r} 0 0 1 ${(W - r + dx).toFixed(2)} ${(H + dy).toFixed(2)}`,
      `L ${(r + dx).toFixed(2)} ${(H + dy).toFixed(2)}`,
      `A ${r} ${r} 0 0 1 ${(blTangent[0] + dx).toFixed(2)} ${(blTangent[1] + dy).toFixed(2)}`,
    ].join(' ');
    const brExtreme = [W - r + r * Math.SQRT1_2, H - r + r * Math.SQRT1_2];
    depthPoints = [trTangent, [W, r], brExtreme, [W - r, H], blTangent];
  }

  const padPx = (hasDepth ? Math.max(dx, dy) : 0) + 6;
  const baseSeed = (W + H + dx + dy) % 97;
  const colorKey = String(color).replace(/[^a-zA-Z0-9]/g, '');
  const filterId = `iso-grain-${W}-${H}-${dx}-${dy}-${colorKey}`;

  return (
    <span ref={ref} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg
        width={W + padPx}
        height={H + padPx}
        viewBox={`-3 -3 ${W + padPx + 3} ${H + padPx + 3}`}
        style={{ position: 'absolute', top: -3, left: -3, overflow: 'visible', pointerEvents: 'none' }}
      >
        <defs>
          {/* Same recipe as HandFrame's rough filter so iso lines + the card
              outline pick up the same paper grain as form borders. */}
          <filter id={filterId} x="-10%" y="-30%" width="120%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={baseSeed} />
            <feDisplacementMap in="SourceGraphic" scale="1.4" />
          </filter>
        </defs>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${filterId})`}>
          {hasDepth && (
            <g stroke={color} strokeWidth="1.6" opacity="0.92">
              <path d={backD} />
              {depthPoints.map((p, i) => (
                <line key={i}
                  x1={p[0].toFixed(2)} y1={p[1].toFixed(2)}
                  x2={(p[0] + dx).toFixed(2)} y2={(p[1] + dy).toFixed(2)} />
              ))}
            </g>
          )}
          {/* Single-pass front outline: same width and color as the previous
              CSS border (2px solid var(--ink)), filtered for matching grain. */}
          <path d={frontD} stroke={borderColor} strokeWidth="2" />
        </g>
      </svg>
    </span>
  );
}

export function Card({ children, style = {}, padding = 22, shadow = 'var(--sh-print)', bg = 'var(--paper)', radius = 10, withGrain = true }) {
  const isoShadow = getIsoShadowSpec(shadow);
  return (
    <div style={{ position: 'relative' }}>
      <section style={{
        background: bg, border: '2px solid transparent', borderRadius: radius,
        padding, position: 'relative', overflow: 'hidden',
        ...style,
      }}>
        {withGrain && (
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
            backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.08, pointerEvents: 'none' }}/>
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      </section>
      {/* Rendered AFTER the section so the front border draws on top of the
          section's background instead of being covered by it. The back iso
          lines are positioned outside the section's box, so paint order
          doesn't matter for them. */}
      <IsoDepthLines
        dx={isoShadow?.dx || 0}
        dy={isoShadow?.dy || 0}
        color={isoShadow?.color || 'var(--ink)'}
        borderColor="var(--ink)"
        radius={radius}
      />
    </div>
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
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={fSeed.length || 3}/>
            <feDisplacementMap in="SourceGraphic" scale="1.4"/>
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

export function HandPlayButton({ playing, onClick, size = 44, label }) {
  const seedRef = useRef('hp' + Math.floor(Math.random() * 9999));
  const seed = seedRef.current;
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick} aria-label={label || (playing ? 'Pause' : 'Play')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, padding: 0, border: 'none', background: 'transparent',
        cursor: 'pointer', position: 'relative', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        transform: hover ? 'translate(-1px,-1px)' : 'none',
        transition: 'transform 140ms var(--ease-snap)',
      }}>
      <svg width={size} height={size} viewBox="0 0 60 60" style={{ overflow: 'visible' }}>
        <defs>
          <filter id={`hp-${seed}`} x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency="1.0" numOctaves="2" seed={seed.length}/>
            <feDisplacementMap in="SourceGraphic" scale="0.9"/>
          </filter>
        </defs>
        <circle cx="32" cy="32" r="26" fill="var(--ink)" opacity="0.9"
          filter={`url(#hp-${seed})`}/>
        <circle cx="30" cy="30" r="26" fill="var(--cadmium)" stroke="var(--ink)" strokeWidth="2"
          filter={`url(#hp-${seed})`}/>
        {playing ? (
          <g fill="var(--ink)" filter={`url(#hp-${seed})`}>
            <rect x="22" y="20" width="5" height="20" rx="1.4"/>
            <rect x="33" y="20" width="5" height="20" rx="1.4"/>
          </g>
        ) : (
          <polygon points="24,18 42,30 24,42" fill="var(--ink)"
            filter={`url(#hp-${seed})`}/>
        )}
      </svg>
    </button>
  );
}

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
