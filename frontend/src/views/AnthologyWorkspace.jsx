import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Btn, Badge, Burst, Card, Display, Em, Eyebrow, GShape, Icon, Modal, Select, TextInput,
} from '../components/primitives';
import KaraokePreview from '../components/KaraokePreview';
import {
  fetchAnthologies, fetchAnthology, updateAnthology, createAnthology,
  upsertSection, deleteSection,
  updateClip, deleteClip,
  fetchCorpora, fetchCorpusSnippets,
  audioUrl, anthologyExportUrl,
} from '../api';

function fmtT(s) {
  const m = Math.floor(s / 60); const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function useDebouncedCallback(fn, delay = 600) {
  const ref = useRef(null);
  return (...args) => {
    if (ref.current) clearTimeout(ref.current);
    ref.current = setTimeout(() => fn(...args), delay);
  };
}

export default function AnthologyWorkspace() {
  const [list, setList] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [anth, setAnth] = useState(null);
  const [convMap, setConvMap] = useState({});
  const [error, setError] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showKaraoke, setShowKaraoke] = useState(false);

  useEffect(() => {
    fetchAnthologies().then((l) => {
      setList(l || []);
      if (l && l.length) setActiveId(l[0].id);
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    (async () => {
      const corpora = await fetchCorpora().catch(() => []);
      const m = {};
      for (const c of corpora) {
        const r = await fetchCorpusSnippets(c.id).catch(() => null);
        if (!r) continue;
        for (const conv of r.conversations) {
          m[conv.conversation_id] = { title: conv.title, snippets: conv.snippets, has_audio: conv.has_audio };
        }
      }
      setConvMap(m);
    })();
  }, []);

  useEffect(() => {
    if (!activeId) { setAnth(null); return; }
    fetchAnthology(activeId).then(setAnth).catch((e) => setError(e.message));
  }, [activeId]);

  const debouncedUpdateAnth = useDebouncedCallback(async (id, patch) => {
    try { await updateAnthology(id, patch); } catch (e) { setError(e.message); }
  });
  const debouncedUpdateSection = useDebouncedCallback(async (anthId, secId, patch) => {
    try { await upsertSection(anthId, { section_id: secId, ...patch }); } catch (e) { setError(e.message); }
  });
  const debouncedUpdateClip = useDebouncedCallback(async (clipId, patch) => {
    try { await updateClip(clipId, patch); } catch (e) { setError(e.message); }
  });

  function patchTitle(v) {
    setAnth((a) => ({ ...a, name: v }));
    debouncedUpdateAnth(activeId, { name: v });
  }
  function patchPreface(v) {
    setAnth((a) => ({ ...a, preface: v }));
    debouncedUpdateAnth(activeId, { preface: v });
  }
  function patchSection(secId, p) {
    setAnth((a) => ({ ...a, sections: a.sections.map((s) => s.id === secId ? { ...s, ...p } : s) }));
    const sec = anth.sections.find((s) => s.id === secId);
    debouncedUpdateSection(activeId, secId, { ...sec, ...p });
  }
  function patchClip(secId, clipId, p) {
    setAnth((a) => ({ ...a, sections: a.sections.map((s) => s.id !== secId ? s : { ...s, clips: s.clips.map((c) => c.id === clipId ? { ...c, ...p } : c) }) }));
    debouncedUpdateClip(clipId, p);
  }
  async function removeClip(secId, clipId) {
    try {
      await deleteClip(clipId);
      setAnth((a) => ({ ...a, sections: a.sections.map((s) => s.id !== secId ? s : { ...s, clips: s.clips.filter((c) => c.id !== clipId) }) }));
    } catch (e) { setError(e.message); }
  }
  async function addNewSection() {
    if (!activeId) return;
    try {
      const r = await upsertSection(activeId, { title: 'New section', intro: '', idx: anth.sections.length });
      setAnth((a) => ({ ...a, sections: [...a.sections, { id: r.section_id, title: 'New section', intro: '', clips: [] }] }));
    } catch (e) { setError(e.message); }
  }
  async function removeSection(secId) {
    try {
      await deleteSection(secId);
      setAnth((a) => ({ ...a, sections: a.sections.filter((s) => s.id !== secId) }));
    } catch (e) { setError(e.message); }
  }
  async function createNewAnthology(name, preface) {
    try {
      const r = await createAnthology(name || 'Untitled anthology', preface || '');
      const fresh = await fetchAnthologies();
      setList(fresh || []);
      setActiveId(r.id);
      setShowNew(false);
    } catch (e) { setError(e.message); }
  }

  function clipText(clip) {
    // Prefer the exact text the curator selected at lift time. Falls back to
    // joining any conversation snippets that overlap with the clip's audio
    // range — needed for older clips saved before clip_text existed.
    if (clip.clip_text) return clip.clip_text;
    const conv = convMap[clip.conversation_id];
    if (!conv) return '';
    const overlapping = conv.snippets.filter(
      (s) => s.end_sec > clip.start_sec && s.start_sec < clip.end_sec
    );
    return overlapping.map((s) => s.text).join(' ').trim();
  }

  if (!list.length) {
    return (
      <>
        <div style={{ padding: '60px 36px', maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <Eyebrow color="var(--vermillion)">No anthologies yet</Eyebrow>
          <Display size={42} style={{ marginTop: 8 }}>Start an <Em>anthology</Em>.</Display>
          <p style={{ marginTop: 14, color: 'var(--fg-muted)' }}>
            Or lift things in from the auto-highlighter and the corpus heatmap, and they'll land here.
          </p>
          <div style={{ marginTop: 18 }}>
            <Btn kind="ink" icon="plus" onClick={() => setShowNew(true)}>Create anthology</Btn>
          </div>
        </div>
        {showNew && (
          <NewAnthologyModal onClose={() => setShowNew(false)} onCreate={createNewAnthology}/>
        )}
      </>
    );
  }

  if (!anth) {
    return <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>Loading…</div>;
  }

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1100, margin: '0 auto' }}>
      <header style={{ position: 'relative', marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 10 }}>
          <Eyebrow color="var(--vermillion)">
            Anthology workspace · {anth.sections.length} sections · {anth.sections.reduce((a, s) => a + s.clips.length, 0)} clips
          </Eyebrow>
          {list.length > 1 && (
            <div style={{ minWidth: 240 }}>
              <Select value={String(activeId)} onChange={(v) => setActiveId(parseInt(v, 10))}
                options={list.map((a) => ({ value: String(a.id), label: a.name }))}/>
            </div>
          )}
          <Btn size="sm" kind="ghost" icon="plus" onClick={() => setShowNew(true)}>New anthology</Btn>
        </div>
        <input
          value={anth.name}
          onChange={(e) => patchTitle(e.target.value)}
          style={{
            marginTop: 8, width: '100%', border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-display)', fontSize: 56, lineHeight: 0.98, letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}/>
        <Burst size={48} color="var(--cadmium)" style={{ position: 'absolute', right: 0, top: 6 }}/>

        <div style={{ marginTop: 22, display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Btn kind="ink" icon="play" frameNudgeY={-50} onClick={() => setShowKaraoke(true)}>
              Preview karaoke medley
            </Btn>
            <a href={anthologyExportUrl(activeId, 'both', false)} download
              style={{ textDecoration: 'none' }}>
              <Btn kind="vermil" icon="download">Export dataset + karaoke</Btn>
            </a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Eyebrow color="var(--fg-muted)" style={{ whiteSpace: 'nowrap' }}>Or download separately</Eyebrow>
            <span style={{ flex: 1, height: 1, borderBottom: '1.5px dashed var(--line-soft)' }}/>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <a href={anthologyExportUrl(activeId, 'dataset', false)} download
              style={{ textDecoration: 'none' }}>
              <Btn kind="paper" icon="download" full>Dataset (JSON + CSV)</Btn>
            </a>
            <a href={anthologyExportUrl(activeId, 'karaoke', false)} download
              style={{ textDecoration: 'none' }}>
              <Btn kind="paper" icon="download" full>Karaoke only</Btn>
            </a>
            <a href={anthologyExportUrl(activeId, 'karaoke', true)} download
              style={{ textDecoration: 'none' }}>
              <Btn kind="paper" icon="download" full>Karaoke (audio embedded)</Btn>
            </a>
          </div>
        </div>
      </header>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 16px', background: 'var(--vermillion)', color: 'var(--paper)',
          border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {error}
        </div>
      )}

      <Card style={{ marginBottom: 22, padding: 22 }} withGrain={true}>
        <Eyebrow color="var(--cobalt)">Preface</Eyebrow>
        <textarea
          value={anth.preface || ''}
          onChange={(e) => patchPreface(e.target.value)}
          rows={4}
          placeholder="Why this anthology exists, in your own voice."
          style={{
            width: '100%', boxSizing: 'border-box',
            marginTop: 10, padding: 0, border: 'none', outline: 'none', background: 'transparent', resize: 'vertical',
            fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.35, color: 'var(--ink)',
          }}/>
        <GShape shape="petal" color="hotpink" style={{ right: 18, bottom: 18, width: 60, height: 60, transform: 'rotate(-22deg)' }}/>
      </Card>

      {anth.sections.map((sec, si) => (
        <Section key={sec.id} sec={sec} si={si}
          convMap={convMap}
          clipText={clipText}
          onChange={(p) => patchSection(sec.id, p)}
          onClipChange={(cid, p) => patchClip(sec.id, cid, p)}
          onClipDelete={(cid) => removeClip(sec.id, cid)}
          onSectionDelete={() => removeSection(sec.id)}/>
      ))}

      <div style={{ marginTop: 18, textAlign: 'center' }}>
        <Btn kind="ink" icon="plus" onClick={addNewSection} contentStyle={{ paddingTop: 30, paddingBottom: 30 }}>Add section</Btn>
      </div>

      {showNew && (
        <NewAnthologyModal onClose={() => setShowNew(false)} onCreate={createNewAnthology}/>
      )}

      {showKaraoke && (
        <KaraokePreview anthId={activeId} onClose={() => setShowKaraoke(false)}/>
      )}
    </div>
  );
}

function NewAnthologyModal({ onClose, onCreate }) {
  const [name, setName] = useState('Untitled anthology');
  const [preface, setPreface] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await onCreate(name, preface);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <Eyebrow color="var(--cadmium)">New anthology</Eyebrow>
      <Display size={30} style={{ marginTop: 6 }}>Start a <Em>fresh book</Em>.</Display>
      <div style={{ marginTop: 18 }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Name</div>
          <TextInput value={name} onChange={setName}/>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Preface (optional)</div>
          <TextInput value={preface} onChange={setPreface} multiline rows={3}/>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind="vermil" icon="plus" onClick={submit} disabled={busy}>
          {busy ? 'Creating…' : 'Create anthology'}
        </Btn>
      </div>
    </Modal>
  );
}

function Section({ sec, si, convMap, clipText, onChange, onClipChange, onClipDelete, onSectionDelete }) {
  return (
    <div style={{ marginBottom: 26, position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 10 }}>
        <span style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'var(--ink)', color: 'var(--cadmium)',
          fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {String(si + 1).padStart(2, '0')}
        </span>
        <input value={sec.title}
          onChange={(e) => onChange({ title: e.target.value })}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--font-display)', fontSize: 36, color: 'var(--ink)',
            letterSpacing: '-0.01em', lineHeight: 1.1,
          }}/>
        <Badge kind="default">{sec.clips.length} clip{sec.clips.length === 1 ? '' : 's'}</Badge>
        <button onClick={onSectionDelete} title="Delete section"
          style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', padding: 4 }}>
          <Icon name="trash" size={16}/>
        </button>
      </div>

      <textarea
        placeholder="Section introduction (optional)"
        value={sec.intro || ''}
        onChange={(e) => onChange({ intro: e.target.value })}
        rows={2}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 14px',
          border: '2px dashed var(--line-soft)', borderRadius: 6,
          background: 'transparent', outline: 'none', resize: 'vertical',
          fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.5,
          color: 'var(--fg-muted)', marginBottom: 12,
        }}/>

      {sec.clips.map((clip, ci) => (
        <ClipRow key={clip.id} clip={clip} ci={ci}
          convMap={convMap}
          text={clipText(clip)}
          onChange={(p) => onClipChange(clip.id, p)}
          onDelete={() => onClipDelete(clip.id)}/>
      ))}
      {sec.clips.length === 0 && (
        <div style={{ padding: 22, border: '2px dashed var(--line-soft)', borderRadius: 6,
          textAlign: 'center', color: 'var(--fg-muted)', fontStyle: 'italic' }}>
          No clips here yet — lift from the highlighter.
        </div>
      )}
    </div>
  );
}

function ClipRow({ clip, ci, convMap, text, onChange, onDelete }) {
  const conv = convMap[clip.conversation_id];
  const title = conv?.title || `conversation #${clip.conversation_id}`;
  return (
    <div style={{
      position: 'relative', marginBottom: 12,
      border: '2px solid var(--ink)', borderRadius: 8, background: 'var(--paper)',
      boxShadow: '3px 3px 0 0 var(--ink)', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
        backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.06, pointerEvents: 'none' }}/>
      <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 14, padding: 16, alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 60 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>clip {String(ci + 1).padStart(2, '0')}</span>
          {conv?.has_audio && (
            <audio controls preload="none" style={{ width: 220 }}
              src={audioUrl(title, clip.start_sec, clip.end_sec)}/>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {title}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              {fmtT(clip.start_sec)} → {fmtT(clip.end_sec)}
            </span>
            {clip.source && <Badge kind="soft" size="sm">{clip.source}</Badge>}
          </div>
          {text && (
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 20, lineHeight: 1.25, color: 'var(--ink)' }}>
              “{text}”
            </p>
          )}
          <textarea
            placeholder="Curator note"
            value={clip.curator_note || ''}
            onChange={(e) => onChange({ curator_note: e.target.value })}
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: 10,
              padding: '8px 12px', border: '1.5px solid var(--line-soft)',
              borderRadius: 6, background: 'var(--paper-warm)', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5, color: 'var(--ink)',
              resize: 'vertical',
            }}/>
        </div>
        <button onClick={onDelete} title="Remove clip" style={{
          background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer',
          padding: 4,
        }}>
          <Icon name="trash" size={16}/>
        </button>
      </div>
    </div>
  );
}
