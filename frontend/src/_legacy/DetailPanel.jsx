import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchSnippetDetail,
  explainSnippet,
  audioUrl,
  fetchAnthologies,
  createAnthology,
  fetchAnthology,
  addClip,
} from '../api';

const PAD_SEC = 30;

export default function DetailPanel({ snippetId, styleQuery, topicQuery, score }) {
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [explaining, setExplaining] = useState(false);
  const [liftStart, setLiftStart] = useState(0);
  const [liftEnd, setLiftEnd] = useState(0);
  const [anthologies, setAnthologies] = useState([]);
  const [chosenAnthology, setChosenAnthology] = useState('');
  const [liftMessage, setLiftMessage] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!snippetId) {
      setDetail(null);
      setExplanation('');
      return;
    }
    setLoading(true);
    setExplanation('');
    setLiftMessage('');
    fetchSnippetDetail(snippetId)
      .then((d) => {
        setDetail(d);
        // Default lift boundaries: snippet ±30s (clamped to conversation bounds).
        setLiftStart(Math.max(0, d.snippet.start_sec - PAD_SEC));
        setLiftEnd(d.snippet.end_sec + PAD_SEC);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetchAnthologies()
      .then(setAnthologies)
      .catch(() => {});
  }, [snippetId]);

  const runExplain = useCallback(async () => {
    if (!snippetId) return;
    setExplaining(true);
    try {
      const res = await explainSnippet(snippetId, {
        style: styleQuery || '',
        topic: topicQuery || '',
        style_score: score?.style ?? 0,
        topic_score: score?.topic ?? 0,
      });
      setExplanation(res.explanation);
    } catch (e) {
      setExplanation(`(error: ${e.message})`);
    } finally {
      setExplaining(false);
    }
  }, [snippetId, styleQuery, topicQuery, score]);

  const handleLift = useCallback(async () => {
    if (!detail) return;
    setLiftMessage('');
    try {
      let anthId = chosenAnthology ? Number(chosenAnthology) : null;
      if (!anthId) {
        const r = await createAnthology('Untitled anthology');
        anthId = r.id;
      }
      const anth = await fetchAnthology(anthId);
      const sectionId = anth.sections[0]?.id;
      if (!sectionId) throw new Error('Anthology has no section to receive the clip.');
      await addClip({
        section_id: sectionId,
        conversation_id: detail.conversation.id,
        start_sec: Math.max(0, liftStart),
        end_sec: liftEnd,
        curator_note: note,
        source: 'manual',
        tags: [],
      });
      setLiftMessage(`Lifted → ${anth.name}`);
    } catch (e) {
      setLiftMessage(`(error: ${e.message})`);
    }
  }, [detail, chosenAnthology, liftStart, liftEnd, note]);

  if (!snippetId) {
    return (
      <div className="detail empty">
        Click a snippet on the heatmap to see the transcript, audio, and lift controls here.
      </div>
    );
  }
  if (loading || !detail) return <div className="detail">Loading…</div>;

  const hasAudio = detail.conversation.has_audio;

  return (
    <div className="detail">
      <div className="detail-header">
        <div className="detail-conv">{detail.conversation.title}</div>
        <button
          type="button"
          onClick={() => navigate(`/?conv=${encodeURIComponent(detail.conversation.title)}&topic=${encodeURIComponent(topicQuery || '')}&style=${encodeURIComponent(styleQuery || '')}`)}
        >
          Open in Auto-Highlighter →
        </button>
      </div>

      {score && (
        <div className="scores-row">
          <span>fused {score.fused.toFixed(2)}</span>
          <span>style {score.style.toFixed(2)}</span>
          <span>topic {score.topic.toFixed(2)}</span>
        </div>
      )}

      <div className="neighbor-block">
        {detail.neighbors.map((n) => (
          <p
            key={n.id}
            className={n.id === detail.snippet.id ? 'focus' : 'ctx'}
          >
            <span className="speaker">{n.speaker_name || ''}</span>{' '}
            <span>{n.text}</span>
          </p>
        ))}
      </div>

      {hasAudio ? (
        <audio
          controls
          src={audioUrl(detail.conversation.id, Math.max(0, detail.snippet.start_sec - PAD_SEC), detail.snippet.end_sec + PAD_SEC)}
          style={{ width: '100%' }}
        />
      ) : (
        <div className="no-audio">(no audio attached)</div>
      )}

      <div className="explain-row">
        <button onClick={runExplain} disabled={explaining}>
          {explaining ? 'Explaining…' : 'Why is this salient?'}
        </button>
        {explanation && <div className="explain-text">{explanation}</div>}
      </div>

      <div className="lift-block">
        <h4>Lift to anthology</h4>
        <label>
          start (sec)
          <input type="number" step="0.1" value={liftStart.toFixed(1)}
                 onChange={(e) => setLiftStart(parseFloat(e.target.value))} />
        </label>
        <label>
          end (sec)
          <input type="number" step="0.1" value={liftEnd.toFixed(1)}
                 onChange={(e) => setLiftEnd(parseFloat(e.target.value))} />
        </label>
        <label>
          note
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <label>
          anthology
          <select value={chosenAnthology} onChange={(e) => setChosenAnthology(e.target.value)}>
            <option value="">(create new)</option>
            {anthologies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <button onClick={handleLift}>Lift</button>
        {liftMessage && <div className="lift-msg">{liftMessage}</div>}
      </div>
    </div>
  );
}
