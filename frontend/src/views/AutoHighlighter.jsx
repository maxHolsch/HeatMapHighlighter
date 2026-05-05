import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Btn, Badge, Burst, Card, Display, Em, Eyebrow, GShape, HandCircleBtn, HandPlayButton, HandProgressBar, Icon,
  Modal, Select, TextInput,
} from '../components/primitives';
import {
  fetchTranscript,
  runEndToEndPipeline, previewModularPrompt,
  fetchPredictionFiles, fetchPrediction,
  fetchSpanPredictionFiles, fetchSpanPrediction,
  saveHighlights,
  estimateRunCost,
  fetchPricing,
  audioUrl,
  fetchCorpora, fetchCorpusConversations,
} from '../api';
import LiftToAnthologyModal from '../components/LiftToAnthologyModal';

function fmtUsd(n) {
  if (n == null || Number.isNaN(n)) return '$—';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function heatColor(score, max = 10) {
  const h = Math.max(0, Math.min(1, score / max));
  if (h < 0.20) return 'var(--bone)';
  if (h < 0.40) return 'var(--paper-ochre)';
  if (h < 0.55) return 'var(--cadmium)';
  if (h < 0.70) return 'var(--vermillion-soft)';
  if (h < 0.85) return 'var(--vermillion)';
  return 'var(--hotpink)';
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60); const s = Math.floor(sec % 60);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function deriveFullText(spans) {
  if (!spans || !spans.length) return '';
  return spans.map((s) => s.text || '').join(' ').replace(/\s+/g, ' ').trim();
}

// Per-highlight status is derived from per-span statuses. 'accepted' / 'rejected'
// only when every span agrees; otherwise 'pending' (covers mixed and any-pending).
function deriveHlStatus(spans) {
  if (!spans || !spans.length) return 'pending';
  if (spans.every((s) => s.status === 'accepted')) return 'accepted';
  if (spans.every((s) => s.status === 'rejected')) return 'rejected';
  return 'pending';
}

function normalizeHighlights(arr) {
  return (arr || []).map((h) => {
    const spans = (h.spans || []).map((s) => ({ ...s, status: s.status || 'pending' }));
    return {
      ...h,
      spans,
      status: deriveHlStatus(spans),
      full_text: h.full_text || deriveFullText(spans),
    };
  });
}

export default function AutoHighlighter({ tweaks }) {
  const [corpora, setCorpora] = useState([]);
  const [corpusId, setCorpusId] = useState('');
  // conversations: [{ id: dbId, title: stem }, ...]
  const [conversations, setConversations] = useState([]);
  const [conv, setConv] = useState(''); // selected title (also pipeline route key)
  const [transcript, setTranscript] = useState(null);
  const [theme, setTheme] = useState('');
  const [definition, setDefinition] = useState('');
  const [context, setContext] = useState('');

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [scores, setScores] = useState([]);
  const [highlights, setHighlights] = useState([]);
  // Selection is per-snippet (snippet index). Every tile is clickable.
  // The drawer derives its highlight + span (if any) from tileToSpan[selectedSnippet].
  const [selectedSnippet, setSelectedSnippet] = useState(null);
  const [filter, setFilter] = useState('all');

  // editBuffer: { [hlId]: [{snippet_index, char_start, char_end} | null, ...] }
  // Indexed by spanIdx within the highlight. Initialized lazily on first slider
  // drag; committed to highlights on Accept; discarded on Reject/close.
  const [editBuffer, setEditBuffer] = useState({});

  const [showRunModal, setShowRunModal] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [showLift, setShowLift] = useState(false);
  const [showHowItRuns, setShowHowItRuns] = useState(false);
  const [error, setError] = useState(null);
  const [runElapsed, setRunElapsed] = useState(0);
  const elapsedTimerRef = useRef(null);

  const [costEstimate, setCostEstimate] = useState(null);
  const [estimatingCost, setEstimatingCost] = useState(false);
  const [runCost, setRunCost] = useState(null);
  const [phaseCost, setPhaseCost] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [pass1Model, setPass1Model] = useState('');
  const [pass2Model, setPass2Model] = useState('');

  const showThreshold = tweaks.threshold ?? 5;

  useEffect(() => {
    fetchCorpora().then((list) => {
      setCorpora(list || []);
      if (list && list.length) setCorpusId(String(list[0].id));
    }).catch((e) => setError(e.message));
    fetchPricing().then((p) => {
      setPricing(p);
      setPass1Model((m) => m || p.models?.pass1_snippet || '');
      setPass2Model((m) => m || p.models?.pass2_span || '');
    }).catch(() => { /* pricing is non-critical; modal will just disable picker */ });
  }, []);

  useEffect(() => {
    if (!corpusId) { setConversations([]); return; }
    fetchCorpusConversations(corpusId)
      .then((rows) => setConversations(rows.map((r) => ({ id: r.id, title: r.title }))))
      .catch((e) => setError(e.message));
  }, [corpusId]);

  useEffect(() => {
    if (!conv) return;
    setTranscript(null); setPhase(0); setScores([]); setHighlights([]);
    setEditBuffer({}); setSelectedSnippet(null);
    fetchTranscript(conv).then(setTranscript).catch((e) => setError(e.message));
  }, [conv]);

  useEffect(() => {
    if (conversations.length && !conv) setConv(conversations[0].title);
  }, [conversations, conv]);

  // If the active conversation no longer exists in the loaded corpus list,
  // reset so the dropdown stays in sync.
  useEffect(() => {
    if (conv && !conversations.some((c) => c.title === conv)) setConv('');
  }, [conversations, conv]);

  const activeConv = useMemo(
    () => conversations.find((c) => c.title === conv) || null,
    [conversations, conv]
  );

  useEffect(() => () => { if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current); }, []);

  async function runPipeline() {
    setShowRunModal(false);
    setRunning(true); setRunElapsed(0); setError(null);
    setRunCost(null); setPhaseCost(costEstimate);
    elapsedTimerRef.current = setInterval(() => setRunElapsed((s) => s + 1), 1000);
    try {
      const res = await runEndToEndPipeline(conv, {
        highlight_definition: definition,
        conversation_context: context,
        theme_conditioning: theme,
        pass1_model: pass1Model || undefined,
        pass2_model: pass2Model || undefined,
      });
      setScores(res.scores || []);
      setHighlights(normalizeHighlights(res.highlights));
      setEditBuffer({});
      setPhase(2);
      if (res.cost) setRunCost(res.cost);
    } catch (e) {
      setError(e.message);
    } finally {
      clearInterval(elapsedTimerRef.current);
      setRunning(false);
    }
  }

  async function openRunModal() {
    setShowRunModal(true);
    setEstimatingCost(true);
    setCostEstimate(null);
    try {
      const est = await estimateRunCost(conv, {
        highlight_definition: definition,
        conversation_context: context,
        theme_conditioning: theme,
        pass1_model: pass1Model || undefined,
        pass2_model: pass2Model || undefined,
      });
      setCostEstimate(est);
    } catch (e) {
      setError(e.message);
    } finally {
      setEstimatingCost(false);
    }
  }

  // Re-estimate when the user picks a different model from inside the modal.
  useEffect(() => {
    if (!showRunModal || !conv) return;
    let cancelled = false;
    setEstimatingCost(true);
    estimateRunCost(conv, {
      highlight_definition: definition,
      conversation_context: context,
      theme_conditioning: theme,
      pass1_model: pass1Model || undefined,
      pass2_model: pass2Model || undefined,
    }).then((est) => { if (!cancelled) setCostEstimate(est); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setEstimatingCost(false); });
    return () => { cancelled = true; };
  }, [pass1Model, pass2Model]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadCachedRun() {
    setError(null);
    try {
      const predFiles = await fetchPredictionFiles(conv);
      if (!predFiles?.length) { setError('No cached prediction runs for this conversation.'); return; }
      const predictions = await fetchPrediction(conv, predFiles[0]);
      setScores(predictions.scores || []);
      const spanFiles = await fetchSpanPredictionFiles(conv);
      if (spanFiles?.length) {
        const spans = await fetchSpanPrediction(conv, spanFiles[0]);
        setHighlights(normalizeHighlights(spans.highlights));
        setEditBuffer({});
        setPhase(2);
      } else {
        setPhase(1);
      }
    } catch (e) { setError(e.message); }
  }

  async function previewPrompt() {
    try {
      const res = await previewModularPrompt(conv, {
        highlight_definition: definition,
        conversation_context: context,
        theme_conditioning: theme,
      });
      setShowPreview(res);
    } catch (e) { setError(e.message); }
  }

  async function saveCurrent() {
    try {
      await saveHighlights(conv, highlights, { source: 'hum-ui' });
      setError(null);
      alert('Highlights saved.');
    } catch (e) { setError(e.message); }
  }

  const snippets = transcript?.original_snippets || [];

  function getEffectiveSpan(hl, spanIdx) {
    if (!hl) return null;
    const buf = editBuffer[hl.id]?.[spanIdx];
    const sp = hl.spans?.[spanIdx];
    if (!sp) return null;
    if (buf) return { snippet_index: sp.snippet_index, char_start: buf.char_start, char_end: buf.char_end };
    return { snippet_index: sp.snippet_index, char_start: sp.char_start, char_end: sp.char_end };
  }

  function setSpanBoundaries(hlId, spanIdx, charStart, charEnd) {
    setEditBuffer((prev) => {
      const hl = highlights.find((h) => h.id === hlId);
      if (!hl) return prev;
      const cur = prev[hlId] || hl.spans.map(() => null);
      const next = cur.map((b, i) => i === spanIdx
        ? { snippet_index: hl.spans[i].snippet_index, char_start: charStart, char_end: charEnd }
        : b
      );
      return { ...prev, [hlId]: next };
    });
  }

  function discardSpanEdits(hlId, spanIdx) {
    setEditBuffer((prev) => {
      const cur = prev[hlId];
      if (!cur || !cur[spanIdx]) return prev;
      const next = cur.map((b, i) => i === spanIdx ? null : b);
      if (next.every((b) => b == null)) {
        const { [hlId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [hlId]: next };
    });
  }

  // Set status on a single span. On 'accepted', commits any buffered char-range
  // edits for just that span and re-derives the span text. Then re-derives the
  // overall hl.status for legacy display + saving.
  function setSpanStatus(hlId, spanIdx, status) {
    setHighlights((prev) => prev.map((h) => {
      if (h.id !== hlId) return h;
      const newSpans = h.spans.map((s, i) => {
        if (i !== spanIdx) return s;
        const buf = editBuffer[hlId]?.[spanIdx];
        const sn = snippets[s.snippet_index];
        const cs = (status === 'accepted' && buf) ? buf.char_start : s.char_start;
        const ce = (status === 'accepted' && buf) ? buf.char_end : s.char_end;
        const text = sn ? sn.transcript.slice(cs, ce) : s.text;
        return { ...s, status, char_start: cs, char_end: ce, text };
      });
      return { ...h, spans: newSpans, full_text: deriveFullText(newSpans), status: deriveHlStatus(newSpans) };
    }));
    discardSpanEdits(hlId, spanIdx);
  }

  function acceptSpan(hlId, spanIdx) { setSpanStatus(hlId, spanIdx, 'accepted'); }
  function rejectSpan(hlId, spanIdx) { setSpanStatus(hlId, spanIdx, 'rejected'); }

  // All spans flattened and ordered by snippet index — counters + filter only.
  const sortedSpans = useMemo(() => {
    const arr = [];
    highlights.forEach((hl) => {
      hl.spans?.forEach((sp, idx) => arr.push({
        hlId: hl.id, spanIdx: idx, snippetIdx: sp.snippet_index, status: sp.status || 'pending',
      }));
    });
    arr.sort((a, b) => a.snippetIdx - b.snippetIdx);
    return arr;
  }, [highlights]);

  function visibleSnippetIndices() {
    if (filter === 'all') return snippets.map((_, i) => i);
    const want = new Set();
    sortedSpans.forEach((s) => {
      if ((s.status || 'pending') === filter) want.add(s.snippetIdx);
    });
    return [...want].sort((a, b) => a - b);
  }

  function cycleSnippet(direction) {
    const visible = visibleSnippetIndices();
    if (!visible.length) { setSelectedSnippet(null); return; }
    if (selectedSnippet == null) { setSelectedSnippet(visible[0]); return; }
    const cur = visible.indexOf(selectedSnippet);
    if (cur === -1) { setSelectedSnippet(visible[0]); return; }
    const next = (cur + direction + visible.length) % visible.length;
    setSelectedSnippet(visible[next]);
  }

  // Esc closes; j/ArrowDown next; k/ArrowUp previous. Active while drawer is open.
  useEffect(() => {
    if (selectedSnippet == null) return;
    function onKey(e) {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        const ref = tileToSpan[selectedSnippet];
        if (ref) discardSpanEdits(ref.hlId, ref.spanIdx);
        setSelectedSnippet(null);
      } else if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault(); cycleSnippet(1);
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault(); cycleSnippet(-1);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSnippet, sortedSpans, filter, highlights, editBuffer, snippets.length]);

  // Span-level counters (replaces the old highlight-level counts).
  const acceptedSpans = sortedSpans.filter((s) => s.status === 'accepted');
  const pendingSpans = sortedSpans.filter((s) => (s.status || 'pending') === 'pending');
  const rejectedSpans = sortedSpans.filter((s) => s.status === 'rejected');
  const allDecided = sortedSpans.length > 0 && pendingSpans.length === 0;

  const snippetMeta = useMemo(() => {
    const m = {};
    scores.forEach((s) => { m[s.snippet_index] = { score: s.score, reasoning: s.reasoning }; });
    if (phase >= 2) {
      highlights.forEach((hl) => {
        hl.spans?.forEach((sp) => {
          if (!m[sp.snippet_index]) m[sp.snippet_index] = {};
          if (sp.status === 'rejected') return;
          m[sp.snippet_index].hl = hl;
          m[sp.snippet_index].span = sp;
        });
      });
    }
    return m;
  }, [phase, highlights, scores]);

  // Snippet-index → {hlId, spanIdx} for the first span covering that snippet.
  // Used for tile clicks and badge rendering.
  const tileToSpan = useMemo(() => {
    const m = {};
    highlights.forEach((hl) => {
      hl.spans?.forEach((sp, idx) => {
        if (m[sp.snippet_index] == null) m[sp.snippet_index] = { hlId: hl.id, spanIdx: idx, status: sp.status || 'pending' };
      });
    });
    return m;
  }, [highlights]);

  const selectedSpanRef = selectedSnippet != null ? tileToSpan[selectedSnippet] : null;
  const selectedHl = selectedSpanRef ? highlights.find((h) => h.id === selectedSpanRef.hlId) : null;
  const selectedSpanObj = selectedHl && selectedSpanRef ? selectedHl.spans?.[selectedSpanRef.spanIdx] : null;
  const selectedSnippetObj = selectedSnippet != null ? snippets[selectedSnippet] : null;
  const selectedSnippetMeta = selectedSnippet != null ? snippetMeta[selectedSnippet] : null;

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ position: 'relative', marginBottom: 28 }}>
        <Display size={66} style={{ marginTop: 8, maxWidth: 920 }}>
          Find the moments<br/>where the room got <Em>loud</Em>.
        </Display>
        <button
          type="button"
          aria-label="How it runs"
          aria-expanded={showHowItRuns}
          onClick={() => setShowHowItRuns((v) => !v)}
          style={{
            position: 'absolute', right: 6, top: 4,
            width: 44, height: 44, borderRadius: '50%',
            background: showHowItRuns ? 'var(--cadmium)' : 'var(--paper)',
            color: 'var(--ink)', border: '2px solid var(--ink)',
            boxShadow: '3px 3px 0 0 var(--ink)', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1,
          }}
        >?</button>
        <GShape shape="petal" color="cadmium" style={{ right: -34, top: 76, width: 90, height: 90, transform: 'rotate(28deg)' }}/>
      </header>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 16px', background: 'var(--vermillion)', color: 'var(--paper)',
          border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'transparent', border: 0, color: 'var(--paper)', cursor: 'pointer' }}><Icon name="x" size={14}/></button>
        </div>
      )}

      {showHowItRuns && (
        <Card padding={0} style={{ marginBottom: 18 }} withGrain={false}>
          <div style={{ position: 'relative', background: 'var(--plum-purple)', color: 'var(--paper)',
            padding: 22, overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0,
              backgroundImage: 'var(--grain-svg)', backgroundSize: '320px 320px',
              mixBlendMode: 'screen', opacity: 0.12, pointerEvents: 'none' }}/>
            <GShape shape="circle" color="cadmium" style={{ right: -22, top: -22, width: 90, height: 90 }}/>
            <GShape shape="leaf" color="vermillion" style={{ right: 26, bottom: -18, width: 80, height: 80, transform: 'rotate(-22deg)' }}/>
            <div style={{ position: 'relative', maxWidth: 360 }}>
              <Eyebrow color="var(--cadmium)">How it runs</Eyebrow>
              <div style={{ marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 0.98, letterSpacing: '-0.01em' }}>
                Two passes.<br/>One <em style={{ color: 'var(--cadmium)', fontStyle: 'italic' }}>verdict</em>.
              </div>
              <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13.5, lineHeight: 1.45 }}>
                <Step n="01" body={<><b>Score every snippet</b> on a 0–10 scale, with reasoning.</>}/>
                <Step n="02" body={<><b>Refine the hot ones</b> into character-level spans.</>}/>
                <Step n="03" body={<><b>You curate</b> — accept, reject, or fine-tune one span at a time.</>}/>
              </div>
              <div style={{ marginTop: 18, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-on-dark-muted)' }}>
                est. 4–8 min · claude opus + sonnet
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card padding={0} style={{ marginBottom: 24 }} withGrain={false}>
        <div style={{ padding: 22, position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
            backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.06, pointerEvents: 'none' }}/>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Eyebrow color="var(--cobalt)">The prompt</Eyebrow>
              <span style={{ flex: 1, height: 2, background: 'var(--ink)' }}/>
            </div>

            {corpora.length > 1 && (
              <FieldLabel n="00" label="Corpus">
                <Select value={corpusId} onChange={setCorpusId}
                  options={corpora.map((c) => ({ value: String(c.id), label: c.name }))}/>
              </FieldLabel>
            )}
            <FieldLabel n="01" label="Conversation">
              <Select value={conv} onChange={setConv}
                options={conversations.map((c) => ({ value: c.title, label: c.title }))}
                placeholder={conversations.length ? '' : 'Loading…'}/>
            </FieldLabel>

            <FieldLabel n="02" label="Theme">
              <TextInput value={theme} onChange={setTheme}
                placeholder="e.g., housing displacement, rent burden, eviction stories"/>
            </FieldLabel>

            <FieldLabel n="03" label="What counts as a highlight">
              <TextInput multiline rows={3} value={definition} onChange={setDefinition}
                placeholder="A highlight is a moment of vivid lived experience or quotable framing that crystallizes a community concern."/>
            </FieldLabel>

            <FieldLabel n="04" label="Conversation context">
              <TextInput multiline rows={2} value={context} onChange={setContext}
                placeholder="This is a community town hall recording."/>
            </FieldLabel>

            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <Btn kind="ghost" icon="search" onClick={previewPrompt}>Preview prompt</Btn>
              <Btn kind="vermil" icon="wand" onClick={openRunModal} disabled={!conv}>
                Get AI-generated highlights
              </Btn>
            </div>

            {runCost && (
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'var(--paper-warm)',
                border: '2px solid var(--ink)', borderRadius: 6,
                fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-muted)' }}>
                Last run: <b style={{ color: 'var(--ink)' }}>{fmtUsd(runCost.total_usd)}</b>
                {runCost.calls?.length > 0 && (
                  <> · {runCost.calls.map((c) => `${c.label.split('_')[0]} ${fmtUsd(c.cost_usd)}`).join(' · ')}</>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>

      {phase >= 1 && transcript && (
        <FanHeatmap
          conversationTitle={conv}
          snippets={snippets}
          snippetMeta={snippetMeta}
          dbId={transcript?.db_id}
          hasAudio={transcript?.has_audio}
          duration={transcript?.duration_sec}
          phase={phase}
          highlights={highlights}
          acceptedSpans={acceptedSpans}
          pendingSpans={pendingSpans}
          rejectedSpans={rejectedSpans}
          allSpans={sortedSpans}
          allDecided={allDecided}
          threshold={showThreshold}
          filter={filter}
          setFilter={setFilter}
          tileToSpan={tileToSpan}
          selectedSnippet={selectedSnippet}
          onTileTap={(idx) => setSelectedSnippet(idx)}
          onSave={saveCurrent}
          onLift={() => setShowLift(true)}
        />
      )}

      {phase === 0 && (
        <Card style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ position: 'relative', padding: '30px 20px' }}>
            <Burst size={50} color="var(--cadmium)" style={{ position: 'absolute', left: -34, top: 6 }}/>
            <Burst size={50} color="var(--cobalt)" style={{ position: 'absolute', right: -34, top: 6 }}/>
            <Eyebrow color="var(--vermillion)">No highlights yet</Eyebrow>
            <Display size={42} style={{ marginTop: 8 }}>Press <Em color="var(--cobalt)">run</Em> to begin.</Display>
            <div style={{ marginTop: 18, display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Btn kind="ghost" onClick={loadCachedRun} disabled={!conv}>Load cached run</Btn>
              <Btn kind="ink-cobalt" icon="wand" onClick={openRunModal} disabled={!conv}>Run highlight detection</Btn>
            </div>
          </div>
        </Card>
      )}

      {selectedSnippetObj && (
        <SnippetDrawer
          snippetIdx={selectedSnippet}
          snippet={selectedSnippetObj}
          score={selectedSnippetMeta?.score ?? null}
          reasoning={selectedSnippetMeta?.reasoning ?? null}
          hl={selectedHl}
          spanIdx={selectedSpanRef?.spanIdx ?? null}
          span={selectedSpanObj}
          editedSpan={selectedHl && selectedSpanRef
            ? getEffectiveSpan(selectedHl, selectedSpanRef.spanIdx)
            : null}
          onSpanEdit={(cs, ce) => {
            if (selectedHl && selectedSpanRef) {
              setSpanBoundaries(selectedHl.id, selectedSpanRef.spanIdx, cs, ce);
            }
          }}
          onAccept={() => {
            if (selectedHl && selectedSpanRef) {
              acceptSpan(selectedHl.id, selectedSpanRef.spanIdx);
            }
          }}
          onReject={() => {
            if (selectedHl && selectedSpanRef) {
              rejectSpan(selectedHl.id, selectedSpanRef.spanIdx);
            }
          }}
          onClose={() => {
            if (selectedHl && selectedSpanRef) {
              discardSpanEdits(selectedHl.id, selectedSpanRef.spanIdx);
            }
            setSelectedSnippet(null);
          }}
          onPrev={() => cycleSnippet(-1)}
          onNext={() => cycleSnippet(1)}
          dbId={transcript?.db_id}
          hasAudio={transcript?.has_audio}
        />
      )}

      {showRunModal && (
        <Modal onClose={() => setShowRunModal(false)}>
          <Eyebrow color="var(--vermillion)">Confirm</Eyebrow>
          <Display size={36} style={{ marginTop: 6 }}>Spend <Em>tokens</Em>?</Display>
          <p style={{ marginTop: 14, color: 'var(--fg-muted)', maxWidth: 400, fontSize: 14, lineHeight: 1.55 }}>
            4–8 minutes for a town-hall-length conversation.
          </p>

          {pricing && (
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <ModelPicker
                label="Pass 1 — score every snippet"
                value={pass1Model}
                onChange={setPass1Model}
                models={Object.keys(pricing.rates_usd_per_mtok || {})}
                defaultModel={pricing.models?.pass1_snippet}
              />
              <ModelPicker
                label="Pass 2 — refine into spans"
                value={pass2Model}
                onChange={setPass2Model}
                models={Object.keys(pricing.rates_usd_per_mtok || {})}
                defaultModel={pricing.models?.pass2_span}
              />
            </div>
          )}

          <div style={{ marginTop: 16, padding: 14, background: 'var(--paper-warm)',
            border: '2px solid var(--ink)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase' }}>Estimated cost</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>
                {estimatingCost ? '…' : fmtUsd(costEstimate?.total_usd)}
              </span>
            </div>
            {costEstimate && (
              <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
                pass 1 ({costEstimate.pass1.model}): {fmtUsd(costEstimate.pass1.cost_usd)}<br/>
                pass 2 ({costEstimate.pass2.model}): {fmtUsd(costEstimate.pass2.cost_usd)} <span style={{ opacity: 0.7 }}>· {costEstimate.pass2.note}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <Btn kind="ghost" style={{ marginTop: 8 }} onClick={() => setShowRunModal(false)}>Cancel</Btn>
            <Btn kind="vermil" icon="wand" onClick={runPipeline}>Run it</Btn>
          </div>
        </Modal>
      )}

      {showPreview && (
        <Modal onClose={() => setShowPreview(null)} maxWidth={720}>
          <Eyebrow color="var(--cobalt)">Prompt preview</Eyebrow>
          <Display size={28} style={{ marginTop: 6 }}>The first <Em>10</Em> snippets.</Display>
          <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
            full prompt: {showPreview.full_prompt_length} chars · {showPreview.num_merged_snippets} merged snippets
          </div>
          <pre style={{ marginTop: 12, padding: 14, background: 'var(--paper-warm)', border: '2px solid var(--ink)',
            borderRadius: 6, maxHeight: 360, overflow: 'auto', fontSize: 12, lineHeight: 1.5,
            fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap' }}>{showPreview.preview_prompt}</pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
            <Btn kind="ink" onClick={() => setShowPreview(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {showLift && activeConv && (
        <LiftToAnthologyModal
          drafts={buildDraftsFromAcceptedSpans(highlights, snippets, activeConv.id)}
          defaultName={`Highlights from ${activeConv.title}`}
          defaultSection={`From ${activeConv.title}`}
          liftLabel="spans kept"
          onClose={() => setShowLift(false)}
          onDone={() => { setShowLift(false); alert('Lifted to anthology.'); }}
          setError={setError}
        />
      )}

      {running && <RunningOverlay elapsed={runElapsed} estimate={costEstimate}/>}
    </div>
  );
}

function FieldLabel({ n, label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{
          width: 22, height: 22, borderRadius: '50%', background: 'var(--ink)',
          color: 'var(--paper)', fontFamily: 'var(--font-mono)', fontSize: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700,
        }}>{n}</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 12.5, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function ModelPicker({ label, value, onChange, models, defaultModel }) {
  const sorted = [...models].sort();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11.5, fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>
        {label}
      </span>
      <select
        value={value || defaultModel || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 12,
          background: 'var(--paper)', color: 'var(--ink)',
          border: '2px solid var(--ink)', borderRadius: 6, cursor: 'pointer',
        }}
      >
        {sorted.map((m) => (
          <option key={m} value={m}>
            {m}{m === defaultModel ? ' (default)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function Step({ n, body }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--cadmium)', marginTop: 4 }}>{n}</span>
      <span>{body}</span>
    </div>
  );
}

// --- Fan grid layout constants ---
const FAN_COLS = 24;
const FAN_GAP = 3;
const TILE_ASPECT = 1.4;
const FRAME_TILE_SCALE = 1.55;
const FRAME_PADDING = 10;
const SNAP_TRANSITION = 'left 380ms cubic-bezier(.34,1.56,.64,1), top 380ms cubic-bezier(.34,1.56,.64,1), transform 280ms cubic-bezier(.34,1.56,.64,1)';

function FanHeatmap({
  conversationTitle, snippets, snippetMeta, dbId, hasAudio, duration,
  phase, highlights, acceptedSpans, pendingSpans, rejectedSpans, allSpans, allDecided, threshold,
  filter, setFilter, tileToSpan, selectedSnippet, onTileTap, onSave, onLift,
}) {
  const audioRef = useRef(null);
  const gridRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);

  const [framePos, setFramePos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, rz: 0 });
  const dragOffsetRef = useRef({ ox: 0, oy: 0 });
  const lastClientXRef = useRef(0);
  const lastTileRef = useRef(-1);
  const initRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const movedRef = useRef(false);

  const audioSrc = (hasAudio && dbId != null) ? audioUrl(dbId) : null;

  const playingIdx = useMemo(() => {
    if (!snippets?.length) return -1;
    for (let i = 0; i < snippets.length; i++) {
      const sn = snippets[i];
      const start = sn.audio_start_offset ?? 0;
      const end = sn.audio_end_offset ?? start;
      if (currentSec >= start && currentSec < end) return i;
    }
    return -1;
  }, [currentSec, snippets]);

  function tileSize() {
    const grid = gridRef.current;
    if (!grid) return { w: 0, h: 0 };
    const w = (grid.clientWidth - (FAN_COLS - 1) * FAN_GAP) / FAN_COLS;
    const h = w / TILE_ASPECT;
    return { w, h };
  }
  function frameSize() {
    const { w, h } = tileSize();
    return {
      fw: w * FRAME_TILE_SCALE + FRAME_PADDING * 2,
      fh: h * FRAME_TILE_SCALE + FRAME_PADDING * 2,
    };
  }
  function tileTopLeft(idx) {
    const { w, h } = tileSize();
    const col = idx % FAN_COLS;
    const row = Math.floor(idx / FAN_COLS);
    return { x: col * (w + FAN_GAP), y: row * (h + FAN_GAP) };
  }
  function tileAtCenter(centerX, centerY) {
    const { w, h } = tileSize();
    if (w === 0) return -1;
    const col = Math.floor(centerX / (w + FAN_GAP));
    const row = Math.floor(centerY / (h + FAN_GAP));
    if (col < 0 || col >= FAN_COLS || row < 0) return -1;
    const idx = row * FAN_COLS + col;
    if (idx < 0 || idx >= snippets.length) return -1;
    return idx;
  }
  function frameTopLeftFromTile(idx) {
    const { w, h } = tileSize();
    const { fw, fh } = frameSize();
    const { x, y } = tileTopLeft(idx);
    return { x: x + w / 2 - fw / 2, y: y + h / 2 - fh / 2 };
  }

  function playSnippet(idx) {
    if (idx < 0 || !audioSrc) return;
    if (lastTileRef.current === idx) return;
    lastTileRef.current = idx;
    const sn = snippets[idx];
    const a = audioRef.current;
    if (!sn || !a) return;
    try {
      a.currentTime = sn.audio_start_offset ?? 0;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* audio not ready */ }
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      a.pause();
    }
  }

  function handlePointerDown(e) {
    if (!audioSrc) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setDragging(true);
    const frameRect = e.currentTarget.getBoundingClientRect();
    dragOffsetRef.current = {
      ox: e.clientX - frameRect.left,
      oy: e.clientY - frameRect.top,
    };
    lastClientXRef.current = e.clientX;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
  }
  function handlePointerMove(e) {
    if (!dragging) return;
    const ds = dragStartRef.current;
    if (Math.abs(e.clientX - ds.x) > 4 || Math.abs(e.clientY - ds.y) > 4) movedRef.current = true;
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid) return;
    const x = e.clientX - grid.left - dragOffsetRef.current.ox;
    const y = e.clientY - grid.top - dragOffsetRef.current.oy;
    setFramePos({ x, y });

    const dx = e.clientX - lastClientXRef.current;
    lastClientXRef.current = e.clientX;
    const rz = Math.max(-14, Math.min(14, -dx * 1.2));
    setTilt({ rx: 10, rz });

    const { fw, fh } = frameSize();
    const centerX = x + fw / 2;
    const centerY = y + fh / 2;
    const idx = tileAtCenter(centerX, centerY);
    if (idx >= 0) playSnippet(idx);
  }
  function handlePointerUp(e) {
    if (!dragging) return;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setDragging(false);
    setTilt({ rx: 0, rz: 0 });

    const { fw, fh } = frameSize();
    const centerX = framePos.x + fw / 2;
    const centerY = framePos.y + fh / 2;
    const idx = tileAtCenter(centerX, centerY);

    // Tap (no real drag) on frame → treat as click on the tile under it.
    if (!movedRef.current) {
      if (idx >= 0 && onTileTap) onTileTap(idx);
      return;
    }

    if (idx >= 0) {
      setFramePos(frameTopLeftFromTile(idx));
      lastTileRef.current = -1;
      playSnippet(idx);
    }
  }

  useEffect(() => {
    if (initRef.current || !snippets.length) return;
    let tries = 0;
    const tick = () => {
      const grid = gridRef.current;
      if (grid && grid.clientWidth > 0) {
        setFramePos(frameTopLeftFromTile(0));
        initRef.current = true;
        return;
      }
      if (tries++ < 20) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snippets.length]);

  const max = 10;
  const totalSnippets = snippets?.length ?? 0;
  const hot = totalSnippets ? snippets.filter((_, i) => (snippetMeta[i]?.score ?? -1) >= threshold).length : 0;
  const { fw, fh } = frameSize();
  const hasSpans = phase >= 2 && (allSpans?.length ?? 0) > 0;

  return (
    <Card padding={0} style={{ marginBottom: 20 }} withGrain={false}>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <Display size={36} style={{ marginTop: 6 }}>
              The whole <Em>episode</Em>, lit up.
            </Display>
          </div>
          {hasSpans ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 36, lineHeight: 1, color: 'var(--ink)' }}>
                <Em>{acceptedSpans.length}</Em><span style={{ color: 'var(--fg-muted)' }}> / {allSpans.length}</span> spans kept
              </div>
              <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                {pendingSpans.length} pending · {rejectedSpans.length} rejected
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge kind="btn-ink">{totalSnippets} SNIPPETS</Badge>
              <Badge kind="warn">{hot} ≥ {threshold}</Badge>
            </div>
          )}
        </div>
      </div>

      {hasSpans && (
        <div style={{ padding: '14px 24px 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'pending', 'accepted', 'rejected'].map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={filterPillStyle(filter === f)}>
                {f}
              </button>
            ))}
          </div>
          <span style={{ flex: 1 }}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
            {allDecided ? 'all spans decided — ready to save' : `${pendingSpans.length} still pending`}
          </span>
          <Btn size="sm" kind="paper" icon="download" disabled={!allDecided} onClick={onSave}>Save highlights</Btn>
          <Btn size="sm" kind="cadmium" icon="book" disabled={acceptedSpans.length === 0} onClick={onLift}>
            Lift {acceptedSpans.length} to anthology
          </Btn>
        </div>
      )}

      {audioSrc && (
        <HandAudioBar
          playing={playing}
          onTogglePlay={togglePlay}
          currentSec={currentSec}
          duration={duration}
          playingIdx={playingIdx}
          snippet={playingIdx >= 0 ? snippets[playingIdx] : null}
          onSeekFraction={(f) => {
            const a = audioRef.current;
            if (!a) return;
            const d = duration || a.duration || 0;
            if (!d) return;
            try { a.currentTime = Math.max(0, Math.min(d - 0.1, f * d)); }
            catch { /* not ready */ }
          }}
          seed={`fan-${conversationTitle || 'x'}`}
          audioEl={
            <audio
              ref={audioRef}
              src={audioSrc}
              preload="metadata"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime || 0)}
              style={{ display: 'none' }}
            />
          }
        />
      )}

      {!audioSrc && hasAudio === false && (
        <div style={{ margin: '14px 24px 0', padding: '8px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5,
          color: 'var(--fg-muted)', background: 'var(--bone)', border: '1.5px dashed var(--line-soft)', borderRadius: 6 }}>
          No audio for this conversation — hover-to-play disabled.
        </div>
      )}

      <div style={{ padding: '18px 24px 24px' }}>
        <div ref={gridRef} style={{ position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 3 }}>
            {snippets.map((sn, i) => {
              const meta = snippetMeta[i] || {};
              const score = meta.score;
              const muted = score == null;
              const fill = muted ? 'var(--bone)' : heatColor(score, max);
              const live = playingIdx === i;
              const ref = tileToSpan[i]; // {hlId, spanIdx, status} | undefined
              const status = ref?.status;
              const isSelected = selectedSnippet === i;

              let filterDim = 1;
              if (filter !== 'all') {
                const s = status || 'pending';
                if (!ref || s !== filter) filterDim = 0.22;
              }
              const tileOpacity = (muted ? 0.45 : 1) * filterDim;

              return (
                <div
                  key={i}
                  title={
                    meta.score != null
                      ? `#${i} · score ${meta.score}/10 · ${fmtTime(sn.audio_start_offset ?? 0)}${sn.speaker_name ? ' · ' + sn.speaker_name : ''}`
                      : `#${i} · ${fmtTime(sn.audio_start_offset ?? 0)}${sn.speaker_name ? ' · ' + sn.speaker_name : ''}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    onTileTap?.(i);
                  }}
                  style={{
                    aspectRatio: '1.4 / 1',
                    background: fill,
                    border: live || isSelected ? '2px solid var(--ink)' : '1px solid var(--ink)',
                    borderRadius: 3,
                    position: 'relative', overflow: 'hidden',
                    transform: live ? 'scale(1.18)' : (isSelected ? 'scale(1.12)' : 'scale(1)'),
                    zIndex: isSelected ? 4 : (live ? 3 : 1),
                    transition: 'transform 160ms var(--ease-bouncy), opacity 200ms ease',
                    boxShadow: isSelected
                      ? '0 0 0 2px var(--vermillion), 2px 2px 0 0 var(--ink)'
                      : (live ? '2px 2px 0 0 var(--ink)' : 'none'),
                    opacity: tileOpacity,
                    cursor: 'pointer',
                  }}
                >
                  {!muted && (
                    <span style={{ position: 'absolute', inset: 0,
                      backgroundImage: 'var(--grain-svg-coarse)', backgroundSize: '60px 60px',
                      mixBlendMode: 'multiply', opacity: 0.4, pointerEvents: 'none' }}/>
                  )}
                  {ref && <TileBadge status={status}/>}
                </div>
              );
            })}
          </div>

          {audioSrc ? (
            <PictureFrame
              x={framePos.x}
              y={framePos.y}
              w={fw}
              h={fh}
              dragging={dragging}
              tilt={tilt}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              caption={playingIdx >= 0 ? `#${playingIdx} · ${fmtTime(currentSec)}` : 'drag · or tap a tile'}
            />
          ) : null}
        </div>
        <HeatLegend max={max}/>
      </div>
    </Card>
  );
}

function filterPillStyle(active) {
  return {
    fontFamily: 'var(--font-mono)', fontSize: 11,
    padding: '4px 10px', borderRadius: 999,
    border: '2px solid var(--ink)',
    background: active ? 'var(--ink)' : 'var(--paper)',
    color: active ? 'var(--paper)' : 'var(--ink)',
    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
  };
}

function TileBadge({ status }) {
  if (status === 'accepted') {
    return (
      <svg width={11} height={11} viewBox="0 0 24 24"
        style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none' }}>
        <circle cx="12" cy="12" r="11" fill="var(--grass)" stroke="var(--ink)" strokeWidth="2"/>
        <path d="M7 12l3 3 7-7" stroke="var(--paper)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (status === 'rejected') {
    return (
      <svg width={11} height={11} viewBox="0 0 24 24"
        style={{ position: 'absolute', top: 2, right: 2, pointerEvents: 'none' }}>
        <circle cx="12" cy="12" r="11" fill="var(--vermillion)" stroke="var(--ink)" strokeWidth="2"/>
        <path d="M7 7l10 10M17 7L7 17" stroke="var(--paper)" strokeWidth="3" fill="none" strokeLinecap="round"/>
      </svg>
    );
  }
  return (
    <span style={{
      position: 'absolute', top: 2, right: 2, width: 7, height: 7,
      borderRadius: '50%', background: 'var(--cadmium)',
      border: '1.5px solid var(--ink)', pointerEvents: 'none',
    }}/>
  );
}

function PictureFrame({
  x, y, w, h, dragging, tilt,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  caption,
}) {
  const lift = dragging ? 36 : 0;
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="slider"
      aria-label="Picture-frame snippet selector — drag over the grid to peek into snippets, tap to open the curator drawer"
      style={{
        position: 'absolute',
        left: x, top: y, width: w, height: h,
        transform: `perspective(900px) rotateX(${tilt.rx}deg) rotateZ(${tilt.rz}deg) translateZ(${lift}px)`,
        transformStyle: 'preserve-3d',
        transformOrigin: '50% 60%',
        transition: dragging
          ? 'transform 80ms ease-out'
          : SNAP_TRANSITION,
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        zIndex: 20,
      }}
    >
      <div style={{
        position: 'absolute', inset: -6,
        border: '2px solid var(--vermillion)',
        borderRadius: 10,
        boxShadow: dragging
          ? '0 22px 36px -10px rgba(0,0,0,0.45), 0 6px 14px rgba(0,0,0,0.25)'
          : '4px 4px 0 0 var(--vermillion)',
        transition: 'box-shadow 200ms ease',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', inset: 0,
        border: '8px solid var(--ink)',
        borderRadius: 6,
        background: 'transparent',
        pointerEvents: 'none',
      }}/>
      <div style={{
        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--cadmium)', color: 'var(--ink)',
        border: '2px solid var(--ink)', borderRadius: 3,
        padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
        fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', boxShadow: '1.5px 1.5px 0 0 var(--ink)',
        pointerEvents: 'none',
      }}>
        {dragging ? 'peeking' : 'tap or drag'}
      </div>
      <div style={{
        position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--ink)', color: 'var(--paper)',
        padding: '3px 8px', borderRadius: 3,
        fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {caption}
      </div>
      {[ [4,4], ['auto',4,4,'auto'], [4,'auto','auto',4], ['auto','auto',4,4] ].map((pos, i) => (
        <span key={i} style={{
          position: 'absolute',
          top: pos[0], right: pos[1], bottom: pos[2], left: pos[3],
          width: 4, height: 4, borderRadius: '50%', background: 'var(--paper)',
          border: '1px solid var(--ink)', pointerEvents: 'none',
        }}/>
      ))}
    </div>
  );
}

function HeatLegend({ max }) {
  const stops = [0.05, 0.18, 0.30, 0.45, 0.60, 0.75, 0.86, 0.95];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
      <span>cool · 0</span>
      {stops.map((h, i) => (
        <span key={i} style={{ width: 22, height: 14, borderRadius: 3, background: heatColor(h * max, max),
          position: 'relative', overflow: 'hidden', border: '1.5px solid var(--ink)',
        }}>
          <span style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg-coarse)',
            backgroundSize: '60px 60px', mixBlendMode: 'multiply', opacity: 0.5 }}/>
        </span>
      ))}
      <span>10 · hot</span>
    </div>
  );
}

// =====================================================================
//  SnippetDrawer — opens for any clicked snippet. When the snippet has a
//  Pass-2 span, the drawer shows the proposed span with a slider and
//  Accept/Reject controls; otherwise it shows the snippet text and
//  audio playback only (no curation actions until Pass 2 has run).
// =====================================================================

function SnippetDrawer({
  snippetIdx, snippet, score, reasoning,
  hl, spanIdx, span, editedSpan, onSpanEdit,
  onAccept, onReject, onClose, onPrev, onNext, dbId, hasAudio,
}) {
  const audioRef = useRef(null);
  const audioSrc = (hasAudio && dbId != null) ? audioUrl(dbId) : null;
  const [playing, setPlaying] = useState(false);

  if (!snippet) return null;

  function playSnippet() {
    if (!audioSrc || !audioRef.current) return;
    const t = snippet.audio_start_offset ?? 0;
    try {
      audioRef.current.currentTime = t;
      const p = audioRef.current.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch { /* not ready */ }
    const stopAt = snippet.audio_end_offset ?? null;
    if (stopAt != null) {
      const el = audioRef.current;
      const onTime = () => {
        if (el.currentTime >= stopAt) { el.pause(); el.removeEventListener('timeupdate', onTime); }
      };
      el.addEventListener('timeupdate', onTime);
    }
  }

  const hasSpan = !!(hl && span);
  const status = hasSpan ? (span.status || 'pending') : null;
  const stateColor =
    status === 'accepted' ? 'var(--grass)' :
    status === 'rejected' ? 'var(--vermillion)' :
    status === 'pending'  ? 'var(--cobalt)' : 'var(--fg-muted)';
  const totalSpans = hl?.spans?.length || 0;

  return (
    <>
      <div onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(18,12,6,0.25)', zIndex: 49 }}/>

      <div
        role="dialog"
        aria-label={`Snippet ${snippetIdx} curator`}
        style={{
          position: 'fixed', right: 0, top: 0, bottom: 0,
          width: 'min(520px, 100vw)',
          background: 'var(--paper)', borderLeft: '2px solid var(--ink)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
          boxShadow: '-10px 0 28px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          animation: 'hl-drawer-in 240ms cubic-bezier(.34,1.4,.64,1)',
        }}
      >
        <style>{`@keyframes hl-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        {/* Header */}
        <div style={{ padding: '18px 22px 12px', borderBottom: '2px solid var(--ink)',
          background: 'var(--paper-warm)', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Eyebrow color="var(--cobalt)">{hasSpan ? 'Span editor' : 'Snippet'}</Eyebrow>
            <span style={{ flex: 1 }}/>
            <button onClick={onClose} aria-label="Close drawer"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: '2px solid var(--ink)',
                background: 'var(--paper)', cursor: 'pointer', display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: 0,
              }}>
              <Icon name="x" size={14}/>
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <Display size={26}>#{snippetIdx}</Display>
            {snippet.speaker_name && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                {snippet.speaker_name}
              </span>
            )}
            {score != null && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                score {score}/10
              </span>
            )}
            {hasSpan && (
              <>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                  · {hl.id} span {spanIdx + 1}/{totalSpans}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor, border: '1.5px solid var(--ink)' }}/>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: stateColor,
                  textTransform: 'uppercase', letterSpacing: '0.08em' }}>{status}</span>
              </>
            )}
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>
            <button onClick={onPrev} title="Previous snippet (k / ↑)" style={navBtnStyle}>↑ prev</button>
            <button onClick={onNext} title="Next snippet (j / ↓)" style={navBtnStyle}>↓ next</button>
            <span style={{ marginLeft: 'auto' }}>esc to close</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>
          {/* Reasoning, when there's a Pass-2 highlight or a Pass-1 score */}
          {(hl?.reasoning || reasoning) && (
            <div style={{ background: 'var(--paper-warm)', border: '2px solid var(--ink)',
              borderRadius: 8, padding: '12px 14px', marginBottom: 18, position: 'relative',
              boxShadow: '3px 3px 0 0 var(--ink)' }}>
              <Eyebrow color="var(--vermillion)" style={{ marginBottom: 6 }}>Why salient</Eyebrow>
              <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--ink)' }}>
                {hl?.reasoning || reasoning}
              </p>
            </div>
          )}

          {/* Audio play */}
          {audioSrc && (
            <div style={{ marginBottom: 18, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--paper-warm)', border: '2px dashed var(--ink)', borderRadius: 12,
              boxShadow: '3px 3px 0 0 var(--ink)' }}>
              <HandCircleBtn size={36} seed={`drawer-${snippetIdx}`}
                ariaLabel={playing ? 'Pause snippet' : 'Play snippet'}
                fill="var(--ink)" fg="var(--paper)" onClick={playSnippet}>
                <Icon name={playing ? 'pause' : 'play'} size={13} stroke="var(--paper)"/>
              </HandCircleBtn>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-muted)' }}>
                play this snippet · {fmtTime(snippet.audio_start_offset)}–{fmtTime(snippet.audio_end_offset)}
              </span>
              <audio ref={audioRef} src={audioSrc} preload="metadata"
                onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
                style={{ display: 'none' }}/>
            </div>
          )}

          {/* Speaker label + transcript text (with mark when there's a span) */}
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
            letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 8,
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{snippet.speaker_name || 'Speaker'}</span>
            <span style={{ opacity: 0.5 }}>· snippet #{snippetIdx} · {fmtTime(snippet.audio_start_offset)}</span>
          </div>
          <DrawerSnippetText sn={snippet} editedSpan={hasSpan ? editedSpan : null}
            onSpanEdit={hasSpan ? onSpanEdit : null}/>
          {!hasSpan && (
            <div style={{ marginTop: 14, padding: '10px 12px', borderRadius: 6,
              background: 'var(--bone)', border: '1.5px dashed var(--line-soft)',
              fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-muted)' }}>
              No proposed span here yet. Run highlight detection to generate spans you can accept or reject.
            </div>
          )}
        </div>

        {/* Footer — accept/reject only meaningful when there's a span */}
        <div style={{
          padding: '14px 22px', borderTop: '2px solid var(--ink)',
          background: 'var(--paper-warm)',
          display: 'flex', gap: 10, alignItems: 'center',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-muted)' }}>
            j/k to cycle snippets
          </span>
          <span style={{ flex: 1 }}/>
          <Btn kind="ghost" icon="x" onClick={onReject} disabled={!hasSpan}>Reject span</Btn>
          <Btn kind="vermil" icon="check" onClick={onAccept} disabled={!hasSpan}>Accept span</Btn>
        </div>
      </div>
    </>
  );
}

const navBtnStyle = {
  fontFamily: 'var(--font-mono)', fontSize: 10.5,
  padding: '3px 8px', borderRadius: 999,
  border: '1.5px solid var(--ink)',
  background: 'var(--paper)', color: 'var(--ink)',
  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
};

function DrawerSnippetText({ sn, editedSpan, onSpanEdit }) {
  const text = sn.transcript || '';
  const containerRef = useRef(null);
  const [hoverIdx, setHoverIdx] = useState(null);

  if (!editedSpan) {
    return (
      <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', margin: 0, textWrap: 'pretty' }}>
        {text}
      </p>
    );
  }
  const cs = Math.max(0, Math.min(text.length, editedSpan.char_start));
  const ce = Math.max(cs, Math.min(text.length, editedSpan.char_end));

  function nearestCharIndex(clientX, clientY) {
    const root = containerRef.current;
    if (!root) return null;
    const charSpans = root.querySelectorAll('[data-char-idx]');
    let best = -1;
    let bestDist = Infinity;
    let bestSide = 0;
    for (const node of charSpans) {
      const r = node.getBoundingClientRect();
      if (clientY < r.top - 4 || clientY > r.bottom + 4) continue;
      const cx = (r.left + r.right) / 2;
      const d = Math.abs(clientX - cx);
      if (d < bestDist) {
        bestDist = d;
        best = parseInt(node.dataset.charIdx, 10);
        bestSide = clientX < cx ? 0 : 1;
      }
    }
    if (best === -1) return null;
    return Math.max(0, Math.min(text.length, best + bestSide));
  }

  function startDrag(handle, e) {
    if (!onSpanEdit) return;
    e.preventDefault();
    e.stopPropagation();
    function move(ev) {
      const idx = nearestCharIndex(ev.clientX, ev.clientY);
      if (idx == null) return;
      if (handle === 'start') {
        onSpanEdit(Math.max(0, Math.min(idx, ce - 1)), ce);
      } else {
        onSpanEdit(cs, Math.max(cs + 1, Math.min(text.length, idx)));
      }
    }
    function up() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const handleStyle = (active) => ({
    display: 'inline-block',
    width: active ? 12 : 10,
    height: 22,
    verticalAlign: 'middle',
    background: 'var(--vermillion)',
    border: '2px solid var(--ink)',
    borderRadius: 3,
    boxShadow: '2px 2px 0 0 var(--ink)',
    cursor: onSpanEdit ? 'ew-resize' : 'default',
    margin: '0 1px',
    touchAction: 'none',
    position: 'relative',
    top: -1,
  });

  const before = [];
  const inner = [];
  const after = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const node = (
      <span key={i} data-char-idx={i}
        onMouseEnter={() => setHoverIdx(i)}
        onMouseLeave={() => setHoverIdx((v) => (v === i ? null : v))}
        onClick={(e) => {
          if (!onSpanEdit) return;
          const idx = i + (e.clientX > e.currentTarget.getBoundingClientRect().left + 6 ? 1 : 0);
          if (idx <= cs) onSpanEdit(Math.max(0, idx), ce);
          else if (idx >= ce) onSpanEdit(cs, Math.min(text.length, idx));
        }}
        style={{
          background: hoverIdx === i && (i < cs || i >= ce) && onSpanEdit
            ? 'rgba(255,209,26,0.35)' : 'transparent',
        }}
      >{ch}</span>
    );
    if (i < cs) before.push(node);
    else if (i < ce) inner.push(node);
    else after.push(node);
  }

  return (
    <div ref={containerRef}
      style={{ fontSize: 14.5, lineHeight: 1.7, color: 'var(--ink)', margin: 0, textWrap: 'pretty', userSelect: 'none' }}>
      {before}
      {onSpanEdit && (
        <span role="slider" aria-label="Drag to set span start"
          onPointerDown={(e) => startDrag('start', e)}
          style={handleStyle(false)}/>
      )}
      <mark style={{ background: 'var(--cadmium)', padding: '1px 2px',
        borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)',
        color: 'var(--ink)' }}>
        {inner.length ? inner : <span style={{ display: 'inline-block', width: 6 }}> </span>}
      </mark>
      {onSpanEdit && (
        <span role="slider" aria-label="Drag to set span end"
          onPointerDown={(e) => startDrag('end', e)}
          style={handleStyle(false)}/>
      )}
      {after}
      {onSpanEdit && (
        <div style={{ marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: 'var(--fg-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>drag <b style={{ color: 'var(--vermillion)' }}>red handles</b> to resize · click outside to extend</span>
          <span>{ce - cs} chars</span>
        </div>
      )}
    </div>
  );
}

function HandAudioBar({
  playing, onTogglePlay, currentSec, duration, playingIdx, snippet,
  onSeekFraction, audioEl, seed,
}) {
  const trackRef = useRef(null);
  const value = (duration && duration > 0) ? Math.max(0, Math.min(1, currentSec / duration)) : 0;

  function handleSeek(e) {
    const r = trackRef.current?.getBoundingClientRect();
    if (!r) return;
    const f = Math.max(0, Math.min(1, (e.clientX - r.left) / Math.max(1, r.width)));
    onSeekFraction?.(f);
  }

  return (
    <div style={{
      margin: '14px 24px 0', padding: '12px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'var(--paper-warm)', border: '2px dashed var(--ink)',
      borderRadius: 14, position: 'relative',
      boxShadow: '4px 4px 0 0 var(--ink)',
    }}>
      <HandCircleBtn
        size={42} seed={`${seed}-play`}
        ariaLabel={playing ? 'Pause' : 'Play'}
        fill="var(--ink)" fg="var(--paper)"
        onClick={onTogglePlay}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} stroke="var(--paper)"/>
      </HandCircleBtn>

      <div ref={trackRef} onClick={handleSeek}
        style={{ flex: 1, minWidth: 120, height: 18, display: 'flex', alignItems: 'center',
          cursor: duration ? 'pointer' : 'default' }}>
        <HandProgressBar value={value} seed={`${seed}-track`}
          fill="var(--vermillion)" track="var(--bone)"/>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5,
        color: 'var(--fg-muted)', whiteSpace: 'nowrap', minWidth: 96, textAlign: 'right' }}>
        {duration
          ? `${fmtTime(currentSec)} / ${fmtTime(duration)}`
          : fmtTime(currentSec)}
      </div>

      {playingIdx >= 0 && snippet && (
        <div style={{
          position: 'absolute', left: 70, right: 110, bottom: -18,
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: 'var(--fg-muted)', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          #{playingIdx} · {snippet.transcript}
        </div>
      )}

      {audioEl}
    </div>
  );
}

// =====================================================================
//  Running overlay
// =====================================================================

// Map a span's [char_start, char_end] within a snippet's joined transcript to
// the audio range covered by the words it overlaps. Falls back to the whole
// snippet if word-level data is missing or no word overlaps cleanly.
function spanCharRangeToAudio(snippet, charStart, charEnd) {
  const words = snippet?.words || [];
  const fallbackStart = snippet?.audio_start_offset ?? 0;
  const fallbackEnd = snippet?.audio_end_offset ?? fallbackStart;
  if (!words.length || charStart == null || charEnd == null || charEnd <= charStart) {
    return [fallbackStart, fallbackEnd];
  }
  let pos = 0;
  let firstWord = -1;
  let lastWord = -1;
  for (let i = 0; i < words.length; i++) {
    const wText = words[i].word ?? words[i].text ?? '';
    const wStart = pos;
    const wEnd = pos + wText.length;
    if (wStart < charEnd && wEnd > charStart) {
      if (firstWord === -1) firstWord = i;
      lastWord = i;
    }
    pos = wEnd + 1; // " " separator between words
  }
  if (firstWord === -1) return [fallbackStart, fallbackEnd];
  const a = words[firstWord].audio_start_offset ?? words[firstWord].start_sec ?? fallbackStart;
  const b = words[lastWord].audio_end_offset ?? words[lastWord].end_sec ?? fallbackEnd;
  return [a, b];
}

// Flatten accepted spans across highlights into draft clips for the shared
// lift-to-anthology modal. One clip per accepted span.
function buildDraftsFromAcceptedSpans(highlights, snippets, conversationId) {
  const out = [];
  highlights.forEach((hl) => {
    hl.spans?.forEach((sp) => {
      if (sp.status !== 'accepted') return;
      const sn = snippets[sp.snippet_index];
      if (!sn) return;
      const [startSec, endSec] = spanCharRangeToAudio(sn, sp.char_start, sp.char_end);
      out.push({
        conversation_id: conversationId,
        start_sec: startSec,
        end_sec: endSec,
        curator_note: hl.reasoning || '',
        clip_text: sp.text || '',
        source: 'pass2_span',
        source_ref: `${hl.id}#${sp.snippet_index}`,
      });
    });
  });
  return out;
}

function RunningOverlay({ elapsed, estimate }) {
  const m = Math.floor(elapsed / 60); const s = elapsed % 60;
  const fmt = m > 0 ? `${m}m ${s}s` : `${s}s`;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,12,6,0.55)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--plum-purple)', color: 'var(--paper)', border: '2px solid var(--ink)',
        borderRadius: 10, boxShadow: '8px 8px 0 0 var(--vermillion)', padding: 32,
        maxWidth: 460, width: 'calc(100% - 40px)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
          backgroundSize: '320px 320px', mixBlendMode: 'screen', opacity: 0.14, pointerEvents: 'none' }}/>
        <GShape shape="circle" color="cadmium" style={{ right: -24, top: -24, width: 90, height: 90 }}/>
        <div style={{ position: 'relative' }}>
          <Eyebrow color="var(--cadmium)">Calling Claude</Eyebrow>
          <Display size={36} style={{ marginTop: 6, color: 'var(--paper)' }}>
            Listening to <Em color="var(--cadmium)">every word</Em>.
          </Display>
          <div style={{ marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--fg-on-dark-muted)' }}>
            elapsed = {fmt} · est. 4–8m total
          </div>
          <div style={{ marginTop: 14, height: 10, background: 'rgba(245,239,226,0.15)', border: '2px solid var(--paper)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, animation: 'hm-pulse 1.4s ease-in-out infinite', background: 'var(--cadmium)' }}/>
          </div>
          {estimate && (
            <div style={{ marginTop: 16, padding: '10px 12px', background: 'rgba(245,239,226,0.10)',
              border: '1.5px solid rgba(245,239,226,0.35)', borderRadius: 6,
              fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.55,
              color: 'var(--paper)' }}>
              projected spend ≈ <b style={{ color: 'var(--cadmium)' }}>{fmtUsd(estimate.total_usd)}</b><br/>
              <span style={{ opacity: 0.75 }}>
                p1 {fmtUsd(estimate.pass1.cost_usd)} · p2 {fmtUsd(estimate.pass2.cost_usd)} · actuals shown when run finishes
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
