import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Btn, Badge, Burst, Card, Display, Em, Eyebrow, GShape, Icon,
  Modal, Select, TextInput,
} from '../components/primitives';
import {
  fetchConversations, fetchTranscript,
  runEndToEndPipeline, previewModularPrompt,
  fetchPredictionFiles, fetchPrediction,
  fetchSpanPredictionFiles, fetchSpanPrediction,
  saveHighlights,
  fetchAnthologies, createAnthology, upsertSection, addClip,
  registerCorticoConversation,
  estimateRunCost,
  fetchPricing,
  audioUrl,
} from '../api';

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

export default function AutoHighlighter({ tweaks }) {
  const [conversations, setConversations] = useState([]);
  const [conv, setConv] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [theme, setTheme] = useState('housing displacement, rent burden, eviction stories');
  const [definition, setDefinition] = useState(
    'A highlight is a moment of vivid lived experience or quotable framing that crystallizes a community concern.'
  );
  const [context, setContext] = useState('This is a community town hall recording.');

  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState(0);
  const [scores, setScores] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [selectedHl, setSelectedHl] = useState(null);
  const [filter, setFilter] = useState('all');

  const [showRunModal, setShowRunModal] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [showLift, setShowLift] = useState(false);
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

  const heatStyle = tweaks.heatStyle || 'tiles';
  const transcriptLayout = tweaks.transcriptLayout || 'stacked';
  const showThreshold = tweaks.threshold ?? 5;

  useEffect(() => {
    fetchConversations().then(setConversations).catch((e) => setError(e.message));
    fetchPricing().then((p) => {
      setPricing(p);
      setPass1Model((m) => m || p.models?.pass1_snippet || '');
      setPass2Model((m) => m || p.models?.pass2_span || '');
    }).catch(() => { /* pricing is non-critical; modal will just disable picker */ });
  }, []);

  useEffect(() => {
    if (!conv) return;
    setTranscript(null); setPhase(0); setScores([]); setHighlights([]);
    fetchTranscript(conv).then(setTranscript).catch((e) => setError(e.message));
  }, [conv]);

  useEffect(() => {
    if (conversations.length && !conv) setConv(conversations[0]);
  }, [conversations, conv]);

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
      setHighlights((res.highlights || []).map((h) => ({
        ...h,
        status: h.status || 'pending',
        full_text: h.full_text || deriveFullText(h.spans),
      })));
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
        setHighlights((spans.highlights || []).map((h) => ({
          ...h,
          status: h.status || 'pending',
          full_text: h.full_text || deriveFullText(h.spans),
        })));
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

  function setStatus(id, status) {
    setHighlights((prev) => prev.map((h) => h.id === id ? { ...h, status } : h));
  }

  const accepted = highlights.filter((h) => h.status === 'accepted');
  const pending = highlights.filter((h) => h.status === 'pending');
  const allDecided = highlights.length > 0 && pending.length === 0;

  const snippetMeta = useMemo(() => {
    const m = {};
    scores.forEach((s) => { m[s.snippet_index] = { score: s.score, reasoning: s.reasoning }; });
    if (phase >= 2) {
      highlights.forEach((hl) => {
        hl.spans?.forEach((sp) => {
          if (!m[sp.snippet_index]) m[sp.snippet_index] = {};
          if (hl.status === 'rejected') return;
          m[sp.snippet_index].hl = hl;
          m[sp.snippet_index].span = sp;
        });
      });
    }
    return m;
  }, [phase, highlights, scores]);

  const snippets = transcript?.original_snippets || [];

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ position: 'relative', marginBottom: 28 }}>
        <Eyebrow color="var(--vermillion)">Auto-highlighter — pass 1 + 2</Eyebrow>
        <Display size={66} style={{ marginTop: 8, maxWidth: 920 }}>
          Find the moments<br/>where the room got <Em>loud</Em>.
        </Display>
        <p style={{ marginTop: 14, maxWidth: 640, fontSize: 15, color: 'var(--fg-muted)', lineHeight: 1.55 }}>
          Score every paragraph 0–10. Refine the hot ones into spans. Lift keepers into an anthology.
        </p>
        <Burst size={68} color="var(--vermillion)" style={{ position: 'absolute', right: 8, top: -8 }}/>
        <GShape shape="petal" color="cadmium" style={{ right: -34, top: 76, width: 90, height: 90, transform: 'rotate(28deg)' }}/>
      </header>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 16px', background: 'var(--vermillion)', color: 'var(--paper)',
          border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {error} <button onClick={() => setError(null)} style={{ float: 'right', background: 'transparent', border: 0, color: 'var(--paper)', cursor: 'pointer' }}><Icon name="x" size={14}/></button>
        </div>
      )}

      <Card padding={0} style={{ marginBottom: 24 }} withGrain={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 0 }}>
          <div style={{ padding: 22, position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
              backgroundSize: '380px 380px', mixBlendMode: 'multiply', opacity: 0.06, pointerEvents: 'none' }}/>
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <Eyebrow color="var(--cobalt)">The prompt</Eyebrow>
                <span style={{ flex: 1, height: 2, background: 'var(--ink)' }}/>
                <Badge kind="ink" size="sm" dot>Modular</Badge>
              </div>

              <FieldLabel n="01" label="Conversation">
                <Select value={conv} onChange={setConv}
                  options={conversations} placeholder={conversations.length ? '' : 'Loading…'}/>
              </FieldLabel>

              <FieldLabel n="02" label="Theme">
                <TextInput value={theme} onChange={setTheme}
                  placeholder="e.g., displacement, rent stress, eviction stories"/>
              </FieldLabel>

              <FieldLabel n="03" label="What counts as a highlight">
                <TextInput multiline rows={3} value={definition} onChange={setDefinition}/>
              </FieldLabel>

              <FieldLabel n="04" label="Conversation context">
                <TextInput multiline rows={2} value={context} onChange={setContext}/>
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
                <Step n="03" body={<><b>You curate</b> — accept, reject, lift to an anthology.</>}/>
              </div>
              <div style={{ marginTop: 18, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-on-dark-muted)' }}>
                est. 4–8 min · claude opus + sonnet
              </div>
            </div>
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
          threshold={showThreshold}
        />
      )}

      {phase >= 1 && transcript && (
        <TranscriptHeat
          snippets={snippets}
          snippetMeta={snippetMeta}
          highlights={highlights}
          phase={phase}
          heatStyle={heatStyle}
          transcriptLayout={transcriptLayout}
          showThreshold={showThreshold}
          onSelectHl={setSelectedHl}
          setStatus={setStatus}
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
              <Btn kind="ink" icon="wand" onClick={openRunModal} disabled={!conv}>Run highlight detection</Btn>
            </div>
          </div>
        </Card>
      )}

      {phase >= 2 && (
        <ReviewRail
          highlights={highlights}
          accepted={accepted}
          pending={pending}
          allDecided={allDecided}
          filter={filter}
          setFilter={setFilter}
          selectedHl={selectedHl}
          setSelectedHl={setSelectedHl}
          setStatus={setStatus}
          onSave={saveCurrent}
          onLift={() => setShowLift(true)}
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
            <Btn kind="ghost" onClick={() => setShowRunModal(false)}>Cancel</Btn>
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

      {showLift && (
        <LiftToAnthologyModal
          conversation={conv}
          accepted={accepted}
          snippets={snippets}
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

// Picture-frame drag interaction constants. The fan grid below uses 24
// columns; tile aspect-ratio is 1.4:1; gap is 3px. The frame is sized as
// a multiple of one tile so it visibly "frames" whatever it's hovering.
const FAN_COLS = 24;
const FAN_GAP = 3;
const TILE_ASPECT = 1.4;
const FRAME_TILE_SCALE = 1.55;     // frame is ~1.55x a tile
const FRAME_PADDING = 10;          // extra px around the framed tile
const SNAP_TRANSITION = 'left 380ms cubic-bezier(.34,1.56,.64,1), top 380ms cubic-bezier(.34,1.56,.64,1), transform 280ms cubic-bezier(.34,1.56,.64,1)';

function FanHeatmap({
  conversationTitle, snippets, snippetMeta, dbId, hasAudio, duration,
  phase, highlights, threshold,
}) {
  const audioRef = useRef(null);
  const gridRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);

  // Frame state — top-left coordinate of the frame in grid-relative pixels.
  const [framePos, setFramePos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [tilt, setTilt] = useState({ rx: 0, rz: 0 }); // playful 3D tilt
  const dragOffsetRef = useRef({ ox: 0, oy: 0 });
  const lastClientXRef = useRef(0);
  const lastTileRef = useRef(-1);
  const initRef = useRef(false);

  const audioSrc = (hasAudio && dbId != null) ? audioUrl(dbId) : null;

  // Find the snippet containing the current playhead — used to glow the active tile.
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

  // ---- layout math (recomputed on every interaction so it stays correct
  //      across window resizes without a ResizeObserver) ----
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

  // ---- audio control ----
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

  // ---- frame drag handlers ----
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
  }
  function handlePointerMove(e) {
    if (!dragging) return;
    const grid = gridRef.current?.getBoundingClientRect();
    if (!grid) return;
    const x = e.clientX - grid.left - dragOffsetRef.current.ox;
    const y = e.clientY - grid.top - dragOffsetRef.current.oy;
    setFramePos({ x, y });

    // Velocity-based tilt — leans into the direction of motion.
    const dx = e.clientX - lastClientXRef.current;
    lastClientXRef.current = e.clientX;
    const rz = Math.max(-14, Math.min(14, -dx * 1.2));
    setTilt({ rx: 10, rz });

    // Which tile is the frame's center over right now?
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

    // Snap to the tile under the frame's center on release.
    const { fw, fh } = frameSize();
    const centerX = framePos.x + fw / 2;
    const centerY = framePos.y + fh / 2;
    const idx = tileAtCenter(centerX, centerY);
    if (idx >= 0) {
      setFramePos(frameTopLeftFromTile(idx));
      // Re-fire play in case the snap landed us on a tile we hadn't crossed.
      lastTileRef.current = -1;
      playSnippet(idx);
    }
  }

  // Place the frame over snippet 0 once the grid has a measurable width.
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

  return (
    <Card padding={0} style={{ marginBottom: 20 }} withGrain={false}>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div>
            <Eyebrow color="var(--cobalt)">Fan view · drag the picture frame</Eyebrow>
            <Display size={36} style={{ marginTop: 6 }}>
              The whole <Em>episode</Em>, lit up.
            </Display>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge kind="info">{totalSnippets} snippets</Badge>
            {phase >= 2 && <Badge kind="ok" dot>{highlights?.length ?? 0} highlights</Badge>}
            <Badge kind="warn">{hot} ≥ {threshold}</Badge>
          </div>
        </div>
      </div>

      {audioSrc && (
        <div style={{ margin: '14px 24px 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--paper-warm)', border: '2px solid var(--ink)', borderRadius: 8 }}>
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--ink)',
              background: 'var(--ink)', color: 'var(--paper)', display: 'inline-flex',
              alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <Icon name={playing ? 'pause' : 'play'} size={16} stroke="var(--paper)"/>
          </button>
          <div style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
            <div style={{ color: 'var(--ink)', fontWeight: 700 }}>
              {playingIdx >= 0
                ? `Snippet ${playingIdx} · ${fmtTime(currentSec)}`
                : 'Grab the picture frame and drag it over a snippet'}
            </div>
            {playingIdx >= 0 && snippets[playingIdx] && (
              <div style={{ marginTop: 2, opacity: 0.85, maxWidth: 720, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {snippets[playingIdx].transcript}
              </div>
            )}
          </div>
          {duration ? (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              {fmtTime(currentSec)} / {fmtTime(duration)}
            </span>
          ) : null}
          <audio
            ref={audioRef}
            src={audioSrc}
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(e) => setCurrentSec(e.currentTarget.currentTime || 0)}
            style={{ display: 'none' }}
          />
        </div>
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
              return (
                <div
                  key={i}
                  title={
                    meta.score != null
                      ? `#${i} · score ${meta.score}/10 · ${fmtTime(sn.audio_start_offset ?? 0)}`
                      : `#${i} · ${fmtTime(sn.audio_start_offset ?? 0)}`
                  }
                  style={{
                    aspectRatio: '1.4 / 1',
                    background: fill,
                    border: live ? '2px solid var(--ink)' : '1px solid var(--ink)',
                    borderRadius: 3,
                    position: 'relative', overflow: 'hidden',
                    transform: live ? 'scale(1.18)' : 'scale(1)',
                    zIndex: live ? 3 : 1,
                    transition: 'transform 160ms var(--ease-bouncy)',
                    boxShadow: live ? '2px 2px 0 0 var(--ink)' : 'none',
                    opacity: muted ? 0.45 : 1,
                  }}
                >
                  {!muted && (
                    <span style={{ position: 'absolute', inset: 0,
                      backgroundImage: 'var(--grain-svg-coarse)', backgroundSize: '60px 60px',
                      mixBlendMode: 'multiply', opacity: 0.4, pointerEvents: 'none' }}/>
                  )}
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
              caption={playingIdx >= 0 ? `#${playingIdx} · ${fmtTime(currentSec)}` : 'drag me'}
            />
          ) : null}
        </div>
        <HeatLegend max={max}/>
      </div>
    </Card>
  );
}

function PictureFrame({
  x, y, w, h, dragging, tilt,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
  caption,
}) {
  // Z-lift while dragging gives the frame a hovering feel; on release it
  // snaps back down with the bouncy transition defined in SNAP_TRANSITION.
  const lift = dragging ? 36 : 0;
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      role="slider"
      aria-label="Picture-frame snippet selector — drag over the grid to peek into snippets"
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
      {/* Outer matte ring — playful red */}
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
      {/* Frame body — thick ink border, transparent interior so the tile shows through */}
      <div style={{
        position: 'absolute', inset: 0,
        border: '8px solid var(--ink)',
        borderRadius: 6,
        background: 'transparent',
        pointerEvents: 'none',
      }}/>
      {/* Top brass label like a museum plaque */}
      <div style={{
        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--cadmium)', color: 'var(--ink)',
        border: '2px solid var(--ink)', borderRadius: 3,
        padding: '2px 8px', fontFamily: 'var(--font-mono)', fontSize: 9.5,
        fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', boxShadow: '1.5px 1.5px 0 0 var(--ink)',
        pointerEvents: 'none',
      }}>
        {dragging ? 'peeking' : 'pick a snippet'}
      </div>
      {/* Bottom caption — current snippet & time */}
      <div style={{
        position: 'absolute', bottom: -22, left: '50%', transform: 'translateX(-50%)',
        background: 'var(--ink)', color: 'var(--paper)',
        padding: '3px 8px', borderRadius: 3,
        fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
        whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {caption}
      </div>
      {/* Tiny corner nails for character */}
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

function TranscriptHeat({ snippets, snippetMeta, highlights, phase, heatStyle, transcriptLayout, showThreshold, onSelectHl, setStatus }) {
  const max = 10;
  return (
    <Card style={{ marginBottom: 24, padding: 0 }} withGrain={false}>
      <div style={{ position: 'relative' }}>
        <div style={{ padding: '22px 26px 0', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
            <div>
              <Eyebrow color="var(--vermillion)">Conversation heat — pass 1</Eyebrow>
              <Display size={46} style={{ marginTop: 6 }}>Where the room got <Em>loud</Em>.</Display>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Badge kind="ok" dot>Live</Badge>
              <Badge kind="info">{phase >= 2 ? `${highlights.length} spans` : 'scores only'}</Badge>
              <Badge kind="warn">{snippets.length} snippets</Badge>
            </div>
          </div>
          <HeatLegend max={max}/>
        </div>
        <div style={{ padding: '22px 26px 30px' }}>
          {transcriptLayout === 'two-col'
            ? <TwoColLayout snippets={snippets} snippetMeta={snippetMeta} heatStyle={heatStyle} max={max} threshold={showThreshold} phase={phase} onSelectHl={onSelectHl} setStatus={setStatus}/>
            : <StackedLayout snippets={snippets} snippetMeta={snippetMeta} heatStyle={heatStyle} max={max} threshold={showThreshold} phase={phase} onSelectHl={onSelectHl} setStatus={setStatus}/>
          }
        </div>
      </div>
    </Card>
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

function StackedLayout({ snippets, snippetMeta, heatStyle, max, threshold, phase, onSelectHl, setStatus }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: heatStyle === 'margin' ? 22 : 14 }}>
      {snippets.map((sn, i) => (
        <SnippetRow key={i} idx={i} sn={sn} meta={snippetMeta[i]}
          heatStyle={heatStyle} max={max} threshold={threshold} phase={phase}
          onSelectHl={onSelectHl} setStatus={setStatus}/>
      ))}
    </div>
  );
}

function TwoColLayout({ snippets, snippetMeta, heatStyle, max, threshold, phase, onSelectHl, setStatus }) {
  const left = []; const right = [];
  snippets.forEach((sn, i) => {
    const role = (sn.speaker_name || '').split(' · ')[0].toLowerCase();
    (role === 'facilitator' || role === 'organizer' ? left : right).push({ sn, i });
  });
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow color="var(--cobalt)">Facilitator / organizer</Eyebrow>
        {left.map(({ sn, i }) => <SnippetRow key={i} idx={i} sn={sn} meta={snippetMeta[i]} heatStyle={heatStyle} max={max} threshold={threshold} phase={phase} onSelectHl={onSelectHl} setStatus={setStatus}/>)}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Eyebrow color="var(--vermillion)">Residents</Eyebrow>
        {right.map(({ sn, i }) => <SnippetRow key={i} idx={i} sn={sn} meta={snippetMeta[i]} heatStyle={heatStyle} max={max} threshold={threshold} phase={phase} onSelectHl={onSelectHl} setStatus={setStatus}/>)}
      </div>
    </div>
  );
}

function SnippetRow({ idx, sn, meta, heatStyle, max, threshold, phase, onSelectHl, setStatus }) {
  const [hover, setHover] = useState(false);
  const score = meta?.score ?? 0;
  const hot = score >= threshold;
  const hl = meta?.hl;
  const span = meta?.span;
  const accepted = hl?.status === 'accepted';
  const rejected = hl?.status === 'rejected';

  if (heatStyle === 'tiles') {
    const fill = heatColor(score, max);
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onClick={() => hl && onSelectHl(hl.id)}
        style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16,
          padding: '14px 16px', border: '2px solid var(--ink)', borderRadius: 8,
          background: hot ? fill : 'var(--paper)',
          cursor: hl ? 'pointer' : 'default',
          boxShadow: hover && hot ? '4px 4px 0 0 var(--ink)' : 'none',
          transition: 'box-shadow 140ms var(--ease-snap), transform 140ms var(--ease-snap)',
          transform: hover && hot ? 'translate(-2px,-2px)' : 'none',
          overflow: 'hidden',
          opacity: rejected ? 0.45 : 1,
        }}>
        {hot && <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg-coarse)',
          backgroundSize: '200px 200px', mixBlendMode: 'multiply', opacity: 0.35, pointerEvents: 'none' }}/>}
        <ScoreChip score={score} hot={hot}/>
        <div style={{ position: 'relative' }}>
          <SpeakerLabel sn={sn}/>
          <SnippetText sn={sn} span={span} phase={phase} accepted={accepted}/>
          {phase >= 2 && hl && <HlStatusFooter hl={hl}/>}
        </div>
      </div>
    );
  }

  if (heatStyle === 'underline') {
    const stripeColor = heatColor(score, max);
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onClick={() => hl && onSelectHl(hl.id)}
        style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16,
          padding: '14px 4px 14px 16px',
          borderLeft: `6px solid ${hot ? stripeColor : 'var(--line-soft)'}`,
          cursor: hl ? 'pointer' : 'default',
          opacity: rejected ? 0.45 : 1,
          background: hover && hot ? 'var(--paper-warm)' : 'transparent',
          transition: 'background 140ms var(--ease-snap)',
        }}>
        <ScoreChip score={score} hot={hot} muted/>
        <div>
          <SpeakerLabel sn={sn}/>
          <SnippetText sn={sn} span={span} phase={phase} accepted={accepted} highlightWithUnderline/>
          {phase >= 2 && hl && <HlStatusFooter hl={hl}/>}
        </div>
      </div>
    );
  }

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => hl && onSelectHl(hl.id)}
      style={{ position: 'relative', display: 'grid',
        gridTemplateColumns: '120px 1fr 220px', gap: 18,
        padding: '16px 0', borderTop: '1px dashed var(--line-soft)',
        cursor: hl ? 'pointer' : 'default', opacity: rejected ? 0.45 : 1,
      }}>
      <div style={{ textAlign: 'right' }}>
        <SpeakerLabel sn={sn} compact/>
        <div style={{ marginTop: 10, display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <ScoreBar score={score} max={max}/>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: hot ? 'var(--vermillion)' : 'var(--fg-muted)' }}>
            heat = {(score / max).toFixed(2)}
          </span>
        </div>
      </div>
      <div style={{ position: 'relative', paddingTop: 4 }}>
        {hot && <Burst size={26} color="var(--vermillion)" style={{ position: 'absolute', left: -34, top: 4 }} strokeWidth={2.5}/>}
        <SnippetText sn={sn} span={span} phase={phase} accepted={accepted} fontSize={hot ? 17 : 15} display={hot && phase >= 2}/>
      </div>
      <div style={{ paddingTop: 6 }}>
        {hot && (
          <div style={{ background: 'var(--paper-warm)', border: '2px solid var(--ink)',
            borderRadius: 6, padding: '10px 12px', fontSize: 12.5, lineHeight: 1.4,
            position: 'relative', boxShadow: '3px 3px 0 0 var(--ink)' }}>
            <Eyebrow color="var(--cobalt)" style={{ marginBottom: 6 }}>Why salient</Eyebrow>
            <span style={{ color: 'var(--ink)' }}>{meta?.reasoning || hl?.reasoning}</span>
            {phase >= 2 && hl && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); setStatus(hl.id, 'accepted'); }}
                  style={miniBtn(hl.status === 'accepted' ? 'var(--grass)' : 'var(--paper)', 'var(--ink)')}>
                  <Icon name="check" size={11}/> accept
                </button>
                <button onClick={(e) => { e.stopPropagation(); setStatus(hl.id, 'rejected'); }}
                  style={miniBtn(hl.status === 'rejected' ? 'var(--vermillion)' : 'var(--paper)', 'var(--ink)')}>
                  <Icon name="x" size={11}/> reject
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreChip({ score, hot, muted }) {
  return (
    <div style={{
      width: 44, height: 44, borderRadius: 8,
      border: '2px solid var(--ink)',
      background: muted ? 'var(--paper)' : (hot ? 'var(--ink)' : 'var(--paper)'),
      color: muted ? 'var(--ink)' : (hot ? 'var(--cadmium)' : 'var(--fg-muted)'),
      fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>{score}</div>
  );
}

function ScoreBar({ score, max }) {
  return (
    <div style={{ display: 'inline-flex', gap: 2, alignItems: 'flex-end', height: 22 }}>
      {Array.from({ length: max }).map((_, i) => {
        const lit = i < score;
        return <span key={i} style={{
          width: 5, height: 4 + i*1.6, background: lit ? heatColor(i+1, max) : 'var(--bone)',
          border: '1px solid var(--ink)',
        }}/>;
      })}
    </div>
  );
}

function SpeakerLabel({ sn, compact }) {
  const name = sn.speaker_name || 'Speaker';
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700,
      letterSpacing: '0.08em', textTransform: 'uppercase',
      color: 'var(--fg-muted)', marginBottom: 6 }}>
      {compact ? name.split(' · ').pop() : name}
      {!compact && <span style={{ opacity: 0.5 }}> · {fmtTime(sn.audio_start_offset)}</span>}
    </div>
  );
}

function SnippetText({ sn, span, phase, accepted, fontSize = 15.5, highlightWithUnderline, display }) {
  const text = sn.transcript;
  if (phase >= 2 && span) {
    const before = text.slice(0, span.char_start);
    const inner = text.slice(span.char_start, span.char_end);
    const after = text.slice(span.char_end);
    const innerStyle = highlightWithUnderline
      ? { background: 'var(--cadmium)', padding: '1px 0', borderBottom: '3px solid var(--vermillion)', boxShadow: 'inset 0 -1px 0 0 var(--ink)' }
      : { background: 'var(--cadmium)', padding: '1px 4px', border: '2px solid var(--ink)', borderRadius: 4, boxShadow: '2px 2px 0 0 var(--ink)' };
    return (
      <p style={{
        fontFamily: display ? 'var(--font-display)' : 'var(--font-sans)',
        fontSize: display ? 22 : fontSize,
        lineHeight: display ? 1.15 : 1.55,
        color: 'var(--ink)', margin: 0, textWrap: 'pretty',
      }}>
        {before}
        <mark style={{ ...innerStyle, color: 'var(--ink)' }}>{inner}</mark>
        {after}
        {accepted && (
          <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--grass)' }}>
            <Icon name="check" size={12}/> accepted
          </span>
        )}
      </p>
    );
  }
  return (
    <p style={{ fontSize, lineHeight: 1.55, color: 'var(--ink)', margin: 0, textWrap: 'pretty' }}>{text}</p>
  );
}

function HlStatusFooter({ hl }) {
  return (
    <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{hl.id}</span>
      <span>·</span>
      <span style={{
        color: hl.status === 'accepted' ? 'var(--grass)' :
               hl.status === 'rejected' ? 'var(--vermillion)' : 'var(--cobalt)'
      }}>{hl.status}</span>
    </div>
  );
}

function miniBtn(bg, fg) {
  return {
    fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '3px 8px',
    border: '1.5px solid var(--ink)', borderRadius: 999,
    background: bg, color: fg, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}

function ReviewRail({ highlights, accepted, pending, allDecided, filter, setFilter, selectedHl, setSelectedHl, setStatus, onSave, onLift }) {
  const visible = filter === 'all' ? highlights : highlights.filter((h) => h.status === filter);
  return (
    <Card padding={0} style={{ marginBottom: 24 }} withGrain={false}>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 0 }}>
        <div style={{ background: 'var(--paper-warm)', padding: 22, borderRight: '2px solid var(--ink)', position: 'relative', overflow: 'hidden' }}>
          <GShape shape="circle" color="vermillion" style={{ left: -22, bottom: -22, width: 90, height: 90 }}/>
          <div style={{ position: 'relative' }}>
            <Eyebrow color="var(--cobalt)">Curator review</Eyebrow>
            <Display size={32} style={{ marginTop: 6 }}>
              <Em>{accepted.length}</Em>/{highlights.length} kept.
            </Display>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all', 'pending', 'accepted', 'rejected'].map((f) => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      padding: '4px 10px', borderRadius: 999,
                      border: '2px solid var(--ink)',
                      background: filter === f ? 'var(--ink)' : 'var(--paper)',
                      color: filter === f ? 'var(--paper)' : 'var(--ink)',
                      cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>{f}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                <Btn full kind="vermil" icon="download" disabled={!allDecided} onClick={onSave}>Save highlights</Btn>
                <Btn full kind="cadmium" icon="book" disabled={accepted.length === 0} onClick={onLift}>
                  Lift {accepted.length} to anthology
                </Btn>
              </div>
              <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
                {allDecided ? 'all decisions made — ready to save' : `${pending.length} still pending`}
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 22, maxHeight: 480, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Eyebrow color="var(--vermillion)">Pass-2 spans</Eyebrow>
            <span style={{ flex: 1, height: 2, background: 'var(--ink)' }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)' }}>
              {visible.length} showing
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visible.map((hl) => (
              <HlReviewCard key={hl.id} hl={hl} selected={selectedHl === hl.id}
                onSelect={() => setSelectedHl(hl.id)}
                onAccept={() => setStatus(hl.id, 'accepted')}
                onReject={() => setStatus(hl.id, 'rejected')}
                onUndo={() => setStatus(hl.id, 'pending')}/>
            ))}
            {visible.length === 0 && (
              <div style={{ color: 'var(--fg-muted)', fontStyle: 'italic', padding: 20, textAlign: 'center' }}>
                Nothing in this filter.
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function HlReviewCard({ hl, selected, onSelect, onAccept, onReject, onUndo }) {
  const stateColor =
    hl.status === 'accepted' ? 'var(--grass)' :
    hl.status === 'rejected' ? 'var(--vermillion)' : 'var(--cobalt)';
  return (
    <div onClick={onSelect}
      style={{
        position: 'relative', padding: '14px 16px',
        border: '2px solid var(--ink)', borderRadius: 8,
        background: selected ? 'var(--cadmium)' : 'var(--paper)',
        boxShadow: selected ? '4px 4px 0 0 var(--vermillion)' : '3px 3px 0 0 var(--ink)',
        cursor: 'pointer', transition: 'all 140ms var(--ease-snap)',
        opacity: hl.status === 'rejected' ? 0.5 : 1,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {hl.id}
        </span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor, border: '1.5px solid var(--ink)' }}/>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: stateColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {hl.status}
        </span>
      </div>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, lineHeight: 1.2, margin: 0, color: 'var(--ink)', textWrap: 'pretty' }}>
        “{hl.full_text}”
      </p>
      <p style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.45, color: 'var(--fg-muted)' }}>
        <b style={{ color: 'var(--ink)' }}>Why:</b> {hl.reasoning}
      </p>
      <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {hl.status === 'pending' ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); onAccept(); }} style={miniBtn('var(--grass)', 'var(--paper)')}>
              <Icon name="check" size={12}/> accept
            </button>
            <button onClick={(e) => { e.stopPropagation(); onReject(); }} style={miniBtn('var(--paper)', 'var(--ink)')}>
              <Icon name="x" size={12}/> reject
            </button>
          </>
        ) : (
          <button onClick={(e) => { e.stopPropagation(); onUndo(); }} style={miniBtn('var(--paper)', 'var(--ink)')}>undo</button>
        )}
      </div>
    </div>
  );
}

function LiftToAnthologyModal({ conversation, accepted, snippets, onClose, onDone, setError }) {
  const [mode, setMode] = useState('new');
  const [anthologies, setAnthologies] = useState([]);
  const [selectedAnth, setSelectedAnth] = useState('');
  const [name, setName] = useState(`Highlights from ${conversation.replace(/\.json$/, '')}`);
  const [sectionTitle, setSectionTitle] = useState(`From ${conversation.replace(/\.json$/, '')}`);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchAnthologies().then((list) => {
      setAnthologies(list || []);
      if (list && list.length) setSelectedAnth(String(list[0].id));
    }).catch((e) => setError(e.message));
  }, [setError]);

  async function commit() {
    setBusy(true);
    try {
      const reg = await registerCorticoConversation(conversation);
      const conversation_id = reg.conversation_id;

      let anthId;
      if (mode === 'new') {
        const r = await createAnthology(name, '');
        anthId = r.id;
      } else {
        anthId = parseInt(selectedAnth, 10);
      }
      const sec = await upsertSection(anthId, { title: sectionTitle, intro: '' });
      const sectionId = sec.section_id;

      for (const hl of accepted) {
        const idxs = hl.spans.map((s) => s.snippet_index);
        const first = snippets[Math.min(...idxs)];
        const last = snippets[Math.max(...idxs)];
        if (!first || !last) continue;
        await addClip({
          section_id: sectionId,
          conversation_id,
          start_sec: first.audio_start_offset,
          end_sec: last.audio_end_offset,
          tags: [],
          curator_note: hl.reasoning || '',
          source: 'pass2_span',
          source_ref: hl.id,
        });
      }
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} maxWidth={520}>
      <Eyebrow color="var(--cadmium)">Lift to anthology</Eyebrow>
      <Display size={30} style={{ marginTop: 6 }}>{accepted.length} <Em>kept</Em>.</Display>
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
        <Btn kind="vermil" icon="book" onClick={commit} disabled={busy}>
          {busy ? 'Lifting…' : `Lift ${accepted.length}`}
        </Btn>
      </div>
    </Modal>
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
