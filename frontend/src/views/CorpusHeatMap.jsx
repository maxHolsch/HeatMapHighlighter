import React, { useEffect, useMemo, useState } from 'react';
import {
  Btn, Badge, Burst, Card, Display, Em, Eyebrow, GShape, Icon, Select,
} from '../components/primitives';
import {
  fetchCorpora, fetchCorpusSnippets, runCorpusQuery,
  fetchSnippetDetail, explainSnippet, audioUrl,
  fetchCorpusValence,
} from '../api';

function heatColor(score, max = 10) {
  const h = Math.max(0, Math.min(1, score / max));
  if (h < 0.20) return 'var(--bone)';
  if (h < 0.40) return 'var(--paper-ochre)';
  if (h < 0.55) return 'var(--cadmium)';
  if (h < 0.70) return 'var(--vermillion-soft)';
  if (h < 0.85) return 'var(--vermillion)';
  return 'var(--hotpink)';
}

function adaptCorpus(snippetsResponse, corpusMeta) {
  const conversations = (snippetsResponse?.conversations || []).map((c) => ({
    id: c.conversation_id,
    title: c.title,
    has_audio: c.has_audio,
    num_snippets: c.snippets.length,
    snippets: c.snippets.map((s) => ({
      id: s.snippet_id,
      conversation_id: c.conversation_id,
      index: s.idx,
      preview: s.text,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
      duration: s.end_sec - s.start_sec,
    })),
  }));
  return {
    id: corpusMeta?.id, name: corpusMeta?.name,
    num_conversations: conversations.length,
    conversations,
  };
}

export default function CorpusHeatmap() {
  const [corpora, setCorpora] = useState([]);
  const [corpusId, setCorpusId] = useState('');
  const [corpus, setCorpus] = useState(null);
  const [query, setQuery] = useState('');
  const [decomp, setDecomp] = useState(null);
  const [scoreMap, setScoreMap] = useState({});
  const [valenceMap, setValenceMap] = useState({});
  const [styleQ, setStyleQ] = useState('');
  const [topicQ, setTopicQ] = useState('');
  const [styleOn, setStyleOn] = useState(true);
  const [topicOn, setTopicOn] = useState(true);
  const [blend, setBlend] = useState(0.5);
  const [threshold, setThreshold] = useState(0.45);
  const [focus, setFocus] = useState(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCorpora().then((list) => {
      setCorpora(list || []);
      if (list && list.length) setCorpusId(String(list[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!corpusId) return;
    setCorpus(null); setScoreMap({}); setValenceMap({}); setDecomp(null); setFocus(null);
    const meta = corpora.find((c) => String(c.id) === corpusId);
    fetchCorpusSnippets(corpusId)
      .then((r) => setCorpus(adaptCorpus(r, meta)))
      .catch((e) => setError(e.message));
    fetchCorpusValence(corpusId)
      .then((r) => {
        const m = {};
        (r.scores || []).forEach((s) => { m[s.snippet_id] = s.valence; });
        setValenceMap(m);
      })
      .catch(() => {}); // valence is best-effort; tiles fall back to bone
  }, [corpusId, corpora]);

  async function runQuery(q) {
    setQuery(q);
    if (!q.trim() || !corpusId) { setScoreMap({}); setDecomp(null); return; }
    setRunning(true); setError(null);
    try {
      const res = await runCorpusQuery(corpusId, { query: q });
      const m = {};
      (res.scores || []).forEach((s) => { m[s.snippet_id] = s.fused_score; });
      setScoreMap(m);
      setDecomp(res.decomposition || null);
      setStyleQ(res.decomposition?.style || '');
      setTopicQ(res.decomposition?.topic || '');
    } catch (e) { setError(e.message); }
    finally { setRunning(false); }
  }

  const hasQuery = Object.keys(scoreMap).length > 0;
  const topRankMap = useMemo(() => {
    if (!hasQuery) return {};
    const ranked = Object.entries(scoreMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const m = {};
    ranked.forEach(([sid], i) => { m[Number(sid)] = i + 1; });
    return m;
  }, [scoreMap, hasQuery]);
  const focusSnippet = useMemo(() => {
    if (!focus || !corpus) return null;
    for (const c of corpus.conversations) {
      const sn = c.snippets.find((s) => s.id === focus);
      if (sn) return { ...sn, conversation_title: c.title, conversation_id: c.id, has_audio: c.has_audio };
    }
    return null;
  }, [focus, corpus]);

  return (
    <div style={{ padding: '28px 36px 60px', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ position: 'relative', marginBottom: 22 }}>
        <Eyebrow color="var(--vermillion)">Corpus heatmap — every conversation, all at once</Eyebrow>
        <Display size={64} style={{ marginTop: 8, maxWidth: 980 }}>
          The whole <Em>wall</Em>, lit up.
        </Display>
        <Burst size={56} color="var(--cobalt)" style={{ position: 'absolute', right: 8, top: 0 }}/>
      </header>

      {error && (
        <div style={{ marginBottom: 18, padding: '12px 16px', background: 'var(--vermillion)', color: 'var(--paper)',
          border: '2px solid var(--ink)', borderRadius: 8, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {corpora.length > 1 && (
        <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Eyebrow color="var(--cobalt)">Corpus</Eyebrow>
          <div style={{ minWidth: 260 }}>
            <Select value={corpusId} onChange={setCorpusId}
              options={corpora.map((c) => ({ value: String(c.id), label: c.name }))}/>
          </div>
        </div>
      )}

      <Card padding={0} style={{ marginBottom: 18 }} withGrain={false}>
        <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <Icon name="search" size={20}/>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runQuery(query)}
            placeholder='Ask the wall a question — “frustrated moments about housing”'
            style={{
              flex: 1, minWidth: 220,
              fontFamily: 'var(--font-display)', fontSize: 22,
              border: 'none', outline: 'none', background: 'transparent',
              color: 'var(--ink)',
            }}/>
          <Btn kind="ink" icon="wand" onClick={() => runQuery(query)} disabled={!corpusId}>Run</Btn>
        </div>
        {decomp && (
          <div style={{ borderTop: '2px solid var(--ink)', padding: '12px 18px',
            background: 'var(--paper-warm)', display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fg-muted)' }}>
              Interpreted as
            </span>
            <DecField label="style" value={styleQ} onChange={setStyleQ} on={styleOn} onToggle={() => setStyleOn(!styleOn)} accent="var(--vermillion)"/>
            <DecField label="topic" value={topicQ} onChange={setTopicQ} on={topicOn} onToggle={() => setTopicOn(!topicOn)} accent="var(--cobalt)"/>
            <span style={{ flex: 1 }}/>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', maxWidth: 360 }}>
              — {decomp.rationale}
            </span>
          </div>
        )}
      </Card>

      {hasQuery && (
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          <SliderControl label="Blend (style ↔ topic)" min={0} max={1} step={0.05} value={blend} onChange={setBlend}
            leftLabel="style" rightLabel="topic"/>
          <SliderControl label="Grey-out below" min={0} max={1} step={0.05} value={threshold} onChange={setThreshold}/>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: focus ? '1fr 360px' : '1fr', gap: 18 }}>
        <Card padding={20} withGrain={false}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <Eyebrow color="var(--cobalt)">Fan grid · {corpus?.conversations.length ?? 0} conversations</Eyebrow>
              <h3 style={{ margin: '4px 0 0', fontFamily: 'var(--font-display)', fontSize: 26 }}>
                {hasQuery ? <>Heat against your <Em>question</Em>.</> : <>Pick a question.</>}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Badge kind={hasQuery ? 'danger' : 'default'} dot={hasQuery}>
                {hasQuery ? 'scored' : 'unsorted'}
              </Badge>
              <Badge kind="info">
                {corpus?.conversations.reduce((a, c) => a + c.num_snippets, 0) ?? 0} snippets
              </Badge>
            </div>
          </div>

          {corpus
            ? <FanGrid corpus={corpus} scoreMap={scoreMap} valenceMap={valenceMap}
                topRankMap={topRankMap} threshold={threshold} focus={focus}
                setFocus={setFocus} hasQuery={hasQuery}/>
            : <div style={{ padding: 40, textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>Loading corpus…</div>}
        </Card>

        {focusSnippet && (
          <DetailPanel snippet={focusSnippet} score={scoreMap[focusSnippet.id]} decomp={decomp}
            onClose={() => setFocus(null)}/>
        )}
      </div>

      {running && <RunningOverlay/>}
    </div>
  );
}

function DecField({ label, value, onChange, on, onToggle, accent }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', border: '2px solid var(--ink)', borderRadius: 999,
      background: on ? 'var(--paper)' : 'var(--bone)', opacity: on ? 1 : 0.5,
    }}>
      <button onClick={onToggle} style={{
        width: 12, height: 12, borderRadius: '50%', border: '1.5px solid var(--ink)',
        background: on ? accent : 'transparent', cursor: 'pointer', padding: 0,
      }}/>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label} =
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        style={{ border: 'none', outline: 'none', background: 'transparent',
          fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', minWidth: 200 }}/>
    </div>
  );
}

function SliderControl({ label, min, max, step, value, onChange, leftLabel, rightLabel }) {
  return (
    <div style={{ flex: '1 1 280px', maxWidth: 480 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--vermillion)' }}/>
      {leftLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>
          <span>{leftLabel}</span><span>{rightLabel}</span>
        </div>
      )}
    </div>
  );
}

function FanGrid({ corpus, scoreMap, valenceMap, topRankMap, threshold, focus, setFocus, hasQuery }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
      {corpus.conversations.map((c, ci) => (
        <Fan key={c.id} conversation={c} ci={ci} scoreMap={scoreMap} valenceMap={valenceMap}
          topRankMap={topRankMap} threshold={threshold} focus={focus} setFocus={setFocus} hasQuery={hasQuery}/>
      ))}
    </div>
  );
}

function Fan({ conversation, ci, scoreMap, valenceMap, topRankMap, threshold, focus, setFocus, hasQuery }) {
  const cols = 4;
  return (
    <div style={{ background: 'var(--paper-warm)', border: '2px solid var(--ink)', borderRadius: 8,
      padding: 14, position: 'relative', overflow: 'hidden', boxShadow: '3px 3px 0 0 var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {conversation.title}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-muted)' }}>
          {conversation.num_snippets}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3 }}>
        {conversation.snippets.map((sn) => {
          const score = scoreMap[sn.id];
          const valence = valenceMap[sn.id];
          const muted = hasQuery && (score === undefined || score < threshold);
          let fill;
          if (hasQuery) {
            fill = muted ? 'var(--bone)' : heatColor((score ?? 0) * 10, 10);
          } else if (valence !== undefined) {
            fill = heatColor(valence * 10, 10);
          } else {
            fill = 'var(--bone)';
          }
          const sel = focus === sn.id;
          const titleScore = hasQuery
            ? `score=${(score ?? 0).toFixed(2)}`
            : (valence !== undefined ? `valence=${valence.toFixed(2)}` : 'unscored');
          return (
            <button key={sn.id} onClick={() => setFocus(sn.id)}
              title={`${conversation.title} · ${titleScore}`}
              style={{
                aspectRatio: '1.4 / 1', background: fill,
                border: sel ? '2px solid var(--ink)' : '1px solid var(--ink)',
                borderRadius: 3, cursor: 'pointer', padding: 0,
                opacity: muted ? 0.35 : 1, position: 'relative', overflow: 'hidden',
                transform: sel ? 'scale(1.15)' : 'scale(1)', zIndex: sel ? 2 : 1,
                transition: 'transform 200ms var(--ease-bouncy)',
                boxShadow: sel ? '2px 2px 0 0 var(--ink)' : 'none',
              }}>
              {(!muted && (hasQuery || valence !== undefined)) && (
                <span style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg-coarse)',
                  backgroundSize: '60px 60px', mixBlendMode: 'multiply', opacity: 0.4 }}/>
              )}
              {topRankMap?.[sn.id] && (
                <span style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.6em', lineHeight: 1, color: 'var(--ink)',
                  textShadow: '0 1px 0 var(--paper)', pointerEvents: 'none',
                }}>{topRankMap[sn.id]}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailPanel({ snippet, score, decomp, onClose }) {
  const [detail, setDetail] = useState(null);
  const [explanation, setExplanation] = useState(null);

  useEffect(() => {
    setDetail(null); setExplanation(null);
    fetchSnippetDetail(snippet.id).then(setDetail).catch(() => {});
  }, [snippet.id]);

  useEffect(() => {
    if (!decomp || score === undefined) return;
    explainSnippet(snippet.id, {
      style: decomp.style, topic: decomp.topic,
      style_score: score, topic_score: score,
    }).then((r) => setExplanation(r.explanation)).catch(() => {});
  }, [snippet.id, decomp, score]);

  const text = detail?.snippet?.text || snippet.preview;
  const start = detail?.snippet?.start_sec ?? snippet.start_sec;
  const end = detail?.snippet?.end_sec ?? snippet.end_sec;

  return (
    <Card padding={0} withGrain={false}>
      <div style={{ background: 'var(--plum-purple)', color: 'var(--paper)', padding: '16px 18px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
          backgroundSize: '320px 320px', mixBlendMode: 'screen', opacity: 0.12 }}/>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            <Eyebrow color="var(--cadmium)">Snippet detail</Eyebrow>
            <div style={{ marginTop: 4, fontFamily: 'var(--font-mono)', fontSize: 11, opacity: 0.8 }}>
              {snippet.conversation_title} · #{snippet.index}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--paper)', cursor: 'pointer' }}>
            <Icon name="x" size={18}/>
          </button>
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, lineHeight: 1.2, margin: 0, color: 'var(--ink)' }}>
          “{text}”
        </p>
        {score !== undefined && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--paper-warm)',
            border: '2px solid var(--ink)', borderRadius: 6 }}>
            <Eyebrow color="var(--vermillion)">Match score</Eyebrow>
            <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.6 }}>
              <div>combined = <b>{score.toFixed(2)}</b></div>
            </div>
          </div>
        )}
        {explanation && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--cadmium)',
            border: '2px solid var(--ink)', borderRadius: 6, boxShadow: '3px 3px 0 0 var(--vermillion)' }}>
            <Eyebrow color="var(--vermillion)">Why salient</Eyebrow>
            <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>{explanation}</p>
          </div>
        )}
        {snippet.has_audio && (
          <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--paper)',
            border: '2px dashed var(--line-soft)', borderRadius: 6 }}>
            <audio controls preload="none" style={{ width: '100%' }}
              src={audioUrl(snippet.conversation_id, start, end)}/>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
              {Math.round(start)}s → {Math.round(end)}s
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function RunningOverlay() {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(18,12,6,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--plum-purple)', color: 'var(--paper)', border: '2px solid var(--ink)',
        borderRadius: 10, boxShadow: '8px 8px 0 0 var(--vermillion)', padding: 28,
        position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'var(--grain-svg)',
          backgroundSize: '320px 320px', mixBlendMode: 'screen', opacity: 0.14, pointerEvents: 'none' }}/>
        <div style={{ position: 'relative' }}>
          <Eyebrow color="var(--cadmium)">Querying</Eyebrow>
          <Display size={28} style={{ marginTop: 6, color: 'var(--paper)' }}>
            Searching <Em color="var(--cadmium)">the wall</Em>.
          </Display>
          <div style={{ marginTop: 14, height: 8, width: 240, background: 'rgba(245,239,226,0.15)', border: '2px solid var(--paper)', borderRadius: 999, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', inset: 0, animation: 'hm-pulse 1.4s ease-in-out infinite', background: 'var(--cadmium)' }}/>
          </div>
        </div>
      </div>
    </div>
  );
}
