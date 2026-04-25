import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  fetchAnthology, updateAnthology, upsertSection, deleteSection,
  addClip, updateClip, deleteClip, reorderClips, anthologyExportUrl,
} from '../api';

/*
  Anthology workspace. Curator edits preface, sections (title + intro),
  clips (note + boundaries). Auto-saves on blur. Export emits a .zip
  containing both the dataset bundle and the karaoke HTML bundle.
*/

export default function AnthologyWorkspace() {
  const { id } = useParams();
  const anthId = Number(id);
  const [anth, setAnth] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(() => {
    fetchAnthology(anthId).then(setAnth).catch((e) => setError(e.message));
  }, [anthId]);

  useEffect(() => { reload(); }, [reload]);

  if (!anth) return <div className="loading-indicator">Loading…</div>;

  const saveAnth = (patch) => updateAnthology(anthId, patch).then(reload);

  return (
    <div className="anth-ws">
      {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError(null)}>Dismiss</button></div>}

      <div className="anth-ws-head">
        <input
          className="anth-title"
          value={anth.name}
          onChange={(e) => setAnth({ ...anth, name: e.target.value })}
          onBlur={() => saveAnth({ name: anth.name })}
        />
        <div className="anth-export">
          <a href={anthologyExportUrl(anth.id, 'both')} target="_blank" rel="noreferrer">
            <button>Export dataset + karaoke</button>
          </a>
          <a href={anthologyExportUrl(anth.id, 'karaoke')} target="_blank" rel="noreferrer">
            <button>Export karaoke only</button>
          </a>
          <a href={anthologyExportUrl(anth.id, 'karaoke', true)} target="_blank" rel="noreferrer">
            <button>Export karaoke (audio embedded)</button>
          </a>
        </div>
      </div>

      <textarea
        className="anth-preface"
        placeholder="Preface (editable)"
        value={anth.preface}
        onChange={(e) => setAnth({ ...anth, preface: e.target.value })}
        onBlur={() => saveAnth({ preface: anth.preface })}
      />

      {anth.sections.map((sec) => (
        <Section
          key={sec.id}
          anthId={anth.id}
          section={sec}
          onChanged={reload}
        />
      ))}

      <div className="anth-section-add">
        <button
          onClick={async () => {
            await upsertSection(anth.id, { title: 'New section', intro: '' });
            reload();
          }}
        >
          + Add section
        </button>
      </div>
    </div>
  );
}

function Section({ anthId, section, onChanged }) {
  const [title, setTitle] = useState(section.title);
  const [intro, setIntro] = useState(section.intro);

  const persist = () => upsertSection(anthId, {
    section_id: section.id,
    title,
    intro,
  }).then(onChanged);

  return (
    <div className="anth-section">
      <div className="anth-section-head">
        <input
          value={title}
          placeholder="Section title"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={persist}
        />
        <button
          className="anth-section-delete"
          onClick={async () => {
            if (!confirm(`Delete section "${title}" and all its clips?`)) return;
            await deleteSection(section.id);
            onChanged();
          }}
        >
          delete section
        </button>
      </div>
      <textarea
        placeholder="Section introduction"
        value={intro}
        onChange={(e) => setIntro(e.target.value)}
        onBlur={persist}
      />
      <ul className="anth-clips">
        {section.clips.map((clip) => (
          <ClipRow key={clip.id} clip={clip} onChanged={onChanged} />
        ))}
        {section.clips.length === 0 && (
          <li className="empty-hint">No clips in this section yet.</li>
        )}
      </ul>
    </div>
  );
}

function ClipRow({ clip, onChanged }) {
  const [note, setNote] = useState(clip.curator_note);
  const [start, setStart] = useState(clip.start_sec);
  const [end, setEnd] = useState(clip.end_sec);

  const persist = () => updateClip(clip.id, {
    curator_note: note,
    start_sec: Number(start),
    end_sec: Number(end),
  }).then(onChanged);

  return (
    <li className="anth-clip">
      <div className="clip-meta">
        <strong>{clip.conversation_title}</strong>{' '}
        <span className="clip-range">
          <input type="number" step="0.1" value={start}
                 onChange={(e) => setStart(e.target.value)} onBlur={persist} />
          –
          <input type="number" step="0.1" value={end}
                 onChange={(e) => setEnd(e.target.value)} onBlur={persist} />
          s
        </span>
        <span className="clip-source">({clip.source})</span>
        <button
          className="clip-delete"
          onClick={async () => {
            if (!confirm('Delete clip?')) return;
            await deleteClip(clip.id);
            onChanged();
          }}
        >
          remove
        </button>
      </div>
      <textarea
        placeholder="Curator note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={persist}
      />
    </li>
  );
}
