import React, { useEffect, useState } from 'react';
import {
  Btn, Display, Em, Eyebrow, Modal, Select, TextInput,
} from './primitives';
import {
  fetchAnthologies, createAnthology, upsertSection, addClip,
} from '../api';

// Shared modal for lifting one or more drafts into an anthology section.
//
// Each `drafts[i]` describes a single clip-to-be against a DB conversation:
//   {
//     conversation_id: number,
//     start_sec: number,
//     end_sec: number,
//     curator_note?: string,
//     tags?: string[],
//     source?: string,
//     source_ref?: string,
//   }
//
// Props:
//   drafts:         array as above
//   defaultName:    suggested anthology name (new mode)
//   defaultSection: suggested section title
//   liftLabel:      noun used in the headline ("spans kept", "snippet", etc.)
//   onClose, onDone, setError
export default function LiftToAnthologyModal({
  drafts,
  defaultName = 'Untitled anthology',
  defaultSection = 'New section',
  liftLabel = 'clips',
  onClose,
  onDone,
  setError,
}) {
  const [mode, setMode] = useState('new');
  const [anthologies, setAnthologies] = useState([]);
  const [selectedAnth, setSelectedAnth] = useState('');
  const [name, setName] = useState(defaultName);
  const [sectionTitle, setSectionTitle] = useState(defaultSection);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAnthologies().then((list) => {
      setAnthologies(list || []);
      if (list && list.length) {
        setSelectedAnth(String(list[0].id));
        setMode('existing');
      } else {
        setMode('new');
      }
    }).catch((e) => setError && setError(e.message));
  }, [setError]);

  async function commit() {
    if (!drafts.length) return;
    setBusy(true);
    try {
      let anthId;
      if (mode === 'new') {
        const r = await createAnthology(name.trim() || defaultName, '');
        anthId = r.id;
      } else {
        anthId = parseInt(selectedAnth, 10);
      }
      const sec = await upsertSection(anthId, {
        title: sectionTitle.trim() || defaultSection,
        intro: '',
      });
      const sectionId = sec.section_id;

      for (const d of drafts) {
        if (d.conversation_id == null) continue;
        await addClip({
          section_id: sectionId,
          conversation_id: d.conversation_id,
          start_sec: d.start_sec,
          end_sec: d.end_sec,
          tags: d.tags || [],
          curator_note: d.curator_note || '',
          clip_text: d.clip_text || '',
          source: d.source || 'manual',
          source_ref: d.source_ref || null,
        });
      }
      onDone({ anthology_id: anthId, section_id: sectionId, count: drafts.length });
    } catch (e) {
      if (setError) setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <Eyebrow color="var(--cadmium)">Lift to anthology</Eyebrow>
      <Display size={30} style={{ marginTop: 6 }}>
        {drafts.length} <Em>{liftLabel}</Em>.
      </Display>
      <div style={{ marginTop: 18, display: 'flex', gap: 8 }}>
        <ModeBtn active={mode === 'new'} onClick={() => setMode('new')}>New anthology</ModeBtn>
        <ModeBtn active={mode === 'existing'} onClick={() => setMode('existing')} disabled={!anthologies.length}>
          Append to existing
        </ModeBtn>
      </div>
      <div style={{ marginTop: 18 }}>
        {mode === 'new' ? (
          <div>
            <FieldLabel n="A" label="Anthology name">
              <TextInput value={name} onChange={setName}/>
            </FieldLabel>
            <FieldLabel n="B" label="Section title">
              <TextInput value={sectionTitle} onChange={setSectionTitle}/>
            </FieldLabel>
          </div>
        ) : (
          <div>
            <FieldLabel n="A" label="Anthology">
              <Select value={selectedAnth} onChange={setSelectedAnth}
                options={anthologies.map((a) => ({ value: String(a.id), label: a.name }))}/>
            </FieldLabel>
            <FieldLabel n="B" label="New section title">
              <TextInput value={sectionTitle} onChange={setSectionTitle}/>
            </FieldLabel>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
        <Btn kind="ghost" onClick={onClose}>Cancel</Btn>
        <Btn kind="vermil" icon="book" onClick={commit} disabled={busy || drafts.length === 0}>
          {busy ? 'Lifting…' : `Lift ${drafts.length}`}
        </Btn>
      </div>
    </Modal>
  );
}

function FieldLabel({ n, label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 22, height: 22, borderRadius: 4, background: 'var(--ink)', color: 'var(--cadmium)',
          fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>{n}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

function ModeBtn({ active, onClick, children, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        fontFamily: 'var(--font-mono)', fontSize: 11,
        padding: '6px 12px', borderRadius: 999,
        border: '2px solid var(--ink)',
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>{children}</button>
  );
}
