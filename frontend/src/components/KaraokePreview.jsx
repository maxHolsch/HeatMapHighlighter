import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Btn, Eyebrow, Icon } from './primitives';
import { fetchKaraokeManifest } from '../api';

function fmtT(s) {
  if (!Number.isFinite(s)) return '00:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function findActiveWordIdx(words, t) {
  if (!words || !words.length) return -1;
  // Words are time-ordered; linear scan is fine for clip-sized arrays.
  for (let i = 0; i < words.length; i++) {
    if (t < words[i].end_local) {
      return t >= words[i].start_local ? i : -1;
    }
  }
  return words.length - 1;
}

function flattenPlaylist(manifest) {
  const out = [];
  if (!manifest?.sections) return out;
  for (const sec of manifest.sections) {
    for (const clip of (sec.clips || [])) {
      out.push({ ...clip, section_title: sec.title, section_id: sec.id });
    }
  }
  return out;
}

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(18,12,6,0.55)', zIndex: 110,
  display: 'flex', alignItems: 'stretch', justifyContent: 'center',
};
const sheetStyle = {
  background: 'var(--paper)', border: '2px solid var(--ink)', borderRadius: 10,
  boxShadow: '10px 10px 0 0 var(--ink)', margin: '24px',
  width: 'min(960px, calc(100% - 48px))', display: 'flex', flexDirection: 'column',
  overflow: 'hidden', position: 'relative',
};

export default function KaraokePreview({ anthId, onClose }) {
  const [manifest, setManifest] = useState(null);
  const [error, setError] = useState(null);
  const [activeClip, setActiveClip] = useState(0);
  const [activeWord, setActiveWord] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipTime, setClipTime] = useState(0);

  const audioRef = useRef(null);
  const clipRefs = useRef([]);
  const rafRef = useRef(0);
  const playlistRef = useRef([]);
  const activeClipRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchKaraokeManifest(anthId)
      .then((m) => { if (!cancelled) setManifest(m); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [anthId]);

  const playlist = useMemo(() => flattenPlaylist(manifest), [manifest]);
  // Keep refs in sync so the rAF loop can read latest values without
  // re-binding (avoids re-subscribing the audio element on every clip change).
  playlistRef.current = playlist;
  activeClipRef.current = activeClip;

  const stopRaf = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const idx = activeClipRef.current;
    const clip = playlistRef.current[idx];
    if (clip) {
      const t = audio.currentTime;
      setClipTime(t);
      const w = findActiveWordIdx(clip.words, t);
      setActiveWord((prev) => (prev === w ? prev : w));
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // Scroll the active clip into view as the medley progresses.
  useEffect(() => {
    const node = clipRefs.current[activeClip];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeClip]);

  // Load the active clip's audio whenever the index changes.
  useEffect(() => {
    const audio = audioRef.current;
    const clip = playlist[activeClip];
    if (!audio || !clip) return;
    setActiveWord(-1);
    setClipTime(0);
    if (clip.audio_url) {
      audio.src = clip.audio_url;
      audio.load();
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    } else {
      audio.removeAttribute('src');
      audio.load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeClip, playlist.length]);

  // Drive the rAF loop only while playing.
  useEffect(() => {
    if (isPlaying) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return stopRaf;
  }, [isPlaying, tick, stopRaf]);

  const handleEnded = useCallback(() => {
    // Advance to the next playable clip; stop at end.
    const list = playlistRef.current;
    let next = activeClipRef.current + 1;
    while (next < list.length && !list[next].audio_url) next += 1;
    if (next >= list.length) {
      setIsPlaying(false);
      setActiveWord(-1);
      return;
    }
    setActiveClip(next);
  }, []);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const clip = playlist[activeClip];
    if (!audio || !clip?.audio_url) return;
    if (audio.paused) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, [playlist, activeClip]);

  const restart = useCallback(() => {
    setActiveClip(0);
    setActiveWord(-1);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }
  }, []);

  const jumpTo = useCallback((idx) => {
    setActiveClip(idx);
    setActiveWord(-1);
  }, []);

  const totalDuration = useMemo(
    () => playlist.reduce((acc, c) => acc + (c.duration_sec || 0), 0),
    [playlist],
  );

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        <header style={{
          padding: '20px 28px 16px', borderBottom: '2px solid var(--ink)',
          display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Eyebrow color="var(--vermillion)">Karaoke preview</Eyebrow>
            <h2 style={{
              margin: '6px 0 0', fontFamily: 'var(--font-display)',
              fontSize: 32, lineHeight: 1.05, letterSpacing: '-0.02em',
            }}>
              {manifest?.name || 'Loading…'}
            </h2>
            <div style={{
              marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--fg-muted)',
            }}>
              {playlist.length} clip{playlist.length === 1 ? '' : 's'} · medley {fmtT(totalDuration)}
            </div>
          </div>
          <button onClick={onClose} title="Close" style={{
            background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
            color: 'var(--ink)',
          }}>
            <Icon name="x" size={22}/>
          </button>
        </header>

        {error && (
          <div style={{
            padding: '12px 28px', background: 'var(--vermillion)',
            color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '14px 28px',
          borderBottom: '2px solid var(--ink)', background: 'var(--paper-warm)',
          flexWrap: 'wrap',
        }}>
          <Btn kind="vermil" icon={isPlaying ? 'pause' : 'play'}
            onClick={togglePlay} disabled={!playlist.length}>
            {isPlaying ? 'Pause' : 'Play medley'}
          </Btn>
          <Btn kind="ghost" onClick={restart} disabled={!playlist.length}>
            Restart
          </Btn>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)',
          }}>
            Clip {Math.min(activeClip + 1, playlist.length || 1)} / {playlist.length || 0}
            {playlist[activeClip] && (
              <> · {fmtT(clipTime)} / {fmtT(playlist[activeClip].duration_sec || 0)}</>
            )}
          </div>
          <audio
            ref={audioRef}
            preload="metadata"
            onEnded={handleEnded}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ display: 'none' }}
          />
        </div>

        <div style={{
          padding: '20px 28px 32px', overflowY: 'auto', flex: 1, minHeight: 0,
        }}>
          {manifest?.preface && (
            <p style={{
              margin: '0 0 22px', fontFamily: 'var(--font-display)', fontSize: 18,
              fontStyle: 'italic', color: 'var(--fg-muted)', lineHeight: 1.45,
            }}>
              {manifest.preface}
            </p>
          )}
          {!manifest && !error && (
            <div style={{
              padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)',
              color: 'var(--fg-muted)',
            }}>
              Loading karaoke manifest…
            </div>
          )}
          {manifest && playlist.length === 0 && (
            <div style={{
              padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)',
              color: 'var(--fg-muted)',
            }}>
              No clips in this anthology yet.
            </div>
          )}
          {playlist.map((clip, idx) => (
            <ClipCard
              key={`${clip.section_id}-${clip.id}`}
              clip={clip}
              idx={idx}
              isActive={idx === activeClip}
              activeWord={idx === activeClip ? activeWord : -1}
              onJump={() => jumpTo(idx)}
              cardRef={(el) => { clipRefs.current[idx] = el; }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const cardBase = {
  position: 'relative', marginBottom: 16, padding: 18,
  border: '2px solid var(--ink)', borderRadius: 8, background: 'var(--paper)',
  boxShadow: '3px 3px 0 0 var(--ink)',
};
const cardActive = {
  background: 'var(--paper-warm)',
  boxShadow: '5px 5px 0 0 var(--vermillion)',
};

function ClipCardImpl({ clip, idx, isActive, activeWord, onJump, cardRef }) {
  const sectionLine = clip.section_title
    ? `${clip.section_title} · ${clip.conversation_title}`
    : clip.conversation_title;
  return (
    <div ref={cardRef} style={{ ...cardBase, ...(isActive ? cardActive : null) }}>
      <div style={{
        display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          {String(idx + 1).padStart(2, '0')} · {sectionLine}
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
        }}>
          {fmtT(clip.start_sec)} → {fmtT(clip.end_sec)}
        </span>
        <button onClick={onJump} title="Jump to clip" style={{
          marginLeft: 'auto', background: 'transparent', border: '1.5px solid var(--ink)',
          borderRadius: 4, padding: '3px 10px', fontFamily: 'var(--font-mono)',
          fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
          Jump
        </button>
      </div>
      {clip.curator_note && (
        <div style={{
          margin: '0 0 10px', paddingLeft: 12, borderLeft: '3px solid var(--line-soft)',
          color: 'var(--fg-muted)', fontStyle: 'italic', fontSize: 14,
        }}>
          {clip.curator_note}
        </div>
      )}
      {!clip.has_audio && (
        <div style={{
          marginBottom: 10, fontFamily: 'var(--font-mono)', fontSize: 11,
          color: 'var(--vermillion)',
        }}>
          (no source audio — transcript only)
        </div>
      )}
      <p style={{
        margin: 0, fontFamily: 'var(--font-display)', fontSize: 19,
        lineHeight: 1.55, color: 'var(--ink)',
      }}>
        {clip.words && clip.words.length > 0
          ? clip.words.map((w, i) => {
              const past = isActive && i < activeWord;
              const active = isActive && i === activeWord;
              return (
                <span key={i} style={{
                  padding: '1px 2px', borderRadius: 3,
                  background: active ? 'var(--cadmium)' : 'transparent',
                  color: past ? 'var(--fg-muted)' : 'var(--ink)',
                  transition: 'background 80ms linear',
                }}>
                  {w.text}{i < clip.words.length - 1 ? ' ' : ''}
                </span>
              );
            })
          : <span style={{ color: 'var(--fg-muted)' }}>{clip.clip_text || '(no transcript)'}</span>}
      </p>
    </div>
  );
}

const ClipCard = React.memo(ClipCardImpl);
