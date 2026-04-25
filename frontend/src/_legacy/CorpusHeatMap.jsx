import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  fetchCorpora,
  fetchCorpusSnippets,
  runCorpusQuery,
  runCorpusSimilar,
} from '../api';
import FanGridCanvas from '../components/FanGridCanvas';
import DetailPanel from '../components/DetailPanel';
import QueryBar from '../components/QueryBar';
import AxisControls from '../components/AxisControls';

/*
  Corpus Heatmap view.

  Contract: queries never filter the corpus; they produce a score map that
  the canvas uses to grey-out non-matching snippets. The canvas itself
  always renders every snippet. That invariant is enforced here by
  keeping `snippets` and `scores` as separate state.
*/

export default function CorpusHeatMap() {
  const { corpusId: corpusIdParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [corpora, setCorpora] = useState([]);
  const [corpusId, setCorpusId] = useState(corpusIdParam ? Number(corpusIdParam) : null);
  const [conversations, setConversations] = useState([]);
  const [loadingCorpus, setLoadingCorpus] = useState(false);
  const [error, setError] = useState(null);

  // Query state.
  const [rawQuery, setRawQuery] = useState(searchParams.get('q') || '');
  const [styleQuery, setStyleQuery] = useState('');
  const [topicQuery, setTopicQuery] = useState('');
  const [rationale, setRationale] = useState('');
  const [scores, setScores] = useState({}); // snippet_id -> {fused, style, topic}
  const [threshold, setThreshold] = useState(0.5);
  const [styleOn, setStyleOn] = useState(true);
  const [topicOn, setTopicOn] = useState(true);
  const [blend, setBlend] = useState(0.5);
  const [querying, setQuerying] = useState(false);

  // Selection.
  const [focusSnippetId, setFocusSnippetId] = useState(null);
  const [selectionIds, setSelectionIds] = useState([]); // for drag-select signature

  useEffect(() => {
    fetchCorpora()
      .then((rows) => {
        setCorpora(rows);
        if (!corpusId && rows.length > 0) {
          setCorpusId(rows[0].id);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!corpusId) return;
    setLoadingCorpus(true);
    setError(null);
    fetchCorpusSnippets(corpusId)
      .then((data) => {
        setConversations(data.conversations || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingCorpus(false));
  }, [corpusId]);

  const runQuery = useCallback(async (query) => {
    if (!corpusId) return;
    setRawQuery(query);
    setSearchParams(query ? { q: query } : {});
    if (!query.trim()) {
      setScores({});
      setStyleQuery('');
      setTopicQuery('');
      setRationale('');
      return;
    }
    setQuerying(true);
    setError(null);
    try {
      const result = await runCorpusQuery(corpusId, {
        query,
        blend,
        fusion: 'rrf',
      });
      setStyleQuery(result.decomposition.style);
      setTopicQuery(result.decomposition.topic);
      setRationale(result.decomposition.rationale);
      const m = {};
      for (const row of result.scores) {
        m[row.snippet_id] = {
          fused: row.fused_score,
          style: row.style_score,
          topic: row.topic_score,
        };
      }
      setScores(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setQuerying(false);
    }
  }, [corpusId, blend, setSearchParams]);

  // Re-run scoring when the user edits decomposition directly.
  const rerunWithDecomposition = useCallback(async () => {
    if (!corpusId) return;
    setQuerying(true);
    setError(null);
    try {
      const result = await runCorpusQuery(corpusId, {
        style: styleOn ? styleQuery : '',
        topic: topicOn ? topicQuery : '',
        blend,
        fusion: 'rrf',
      });
      setRationale(result.decomposition.rationale);
      const m = {};
      for (const row of result.scores) {
        m[row.snippet_id] = {
          fused: row.fused_score,
          style: row.style_score,
          topic: row.topic_score,
        };
      }
      setScores(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setQuerying(false);
    }
  }, [corpusId, styleQuery, topicQuery, styleOn, topicOn, blend]);

  const runSimilar = useCallback(async (ids) => {
    if (!corpusId || !ids || ids.length === 0) return;
    setQuerying(true);
    setError(null);
    try {
      const result = await runCorpusSimilar(corpusId, ids);
      setStyleQuery('(drag selection)');
      setTopicQuery('(drag selection)');
      setRationale(`More like ${ids.length} selected snippet(s)`);
      const m = {};
      for (const row of result.scores) {
        m[row.snippet_id] = {
          fused: row.fused_score,
          style: row.style_score,
          topic: row.topic_score,
        };
      }
      setScores(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setQuerying(false);
    }
  }, [corpusId]);

  const hasQuery = Object.keys(scores).length > 0;

  return (
    <div className="corpus-view">
      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}
      <div className="corpus-header">
        <label className="corpus-picker">
          <span>Corpus</span>
          <select
            value={corpusId ?? ''}
            onChange={(e) => {
              const v = Number(e.target.value);
              setCorpusId(v);
              navigate(`/corpus/${v}`);
            }}
          >
            {corpora.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.num_conversations})
              </option>
            ))}
          </select>
        </label>
        <QueryBar
          value={rawQuery}
          onSubmit={runQuery}
          loading={querying}
        />
      </div>

      {hasQuery && (
        <div className="decomposition">
          <span className="deco-label">Interpreted as</span>{' '}
          <span className="deco-field">
            style =
            <input
              value={styleQuery}
              onChange={(e) => setStyleQuery(e.target.value)}
              onBlur={rerunWithDecomposition}
              placeholder="(none)"
            />
          </span>
          <span className="deco-field">
            topic =
            <input
              value={topicQuery}
              onChange={(e) => setTopicQuery(e.target.value)}
              onBlur={rerunWithDecomposition}
              placeholder="(none)"
            />
          </span>
          {rationale && <span className="deco-rationale">— {rationale}</span>}
        </div>
      )}

      <AxisControls
        styleOn={styleOn}
        topicOn={topicOn}
        blend={blend}
        threshold={threshold}
        onStyleToggle={setStyleOn}
        onTopicToggle={setTopicOn}
        onBlendChange={setBlend}
        onThresholdChange={setThreshold}
        onApply={rerunWithDecomposition}
      />

      <div className="corpus-body">
        <div className="canvas-wrap">
          {loadingCorpus && <div className="loading-indicator">Loading corpus...</div>}
          {!loadingCorpus && conversations.length === 0 && (
            <div className="empty-hint">
              No conversations in this corpus yet. Ingest with:
              <pre>python scripts/ingest.py --corpus "name" --cortico-dir ./cortico_api_transcripts_json/</pre>
            </div>
          )}
          <FanGridCanvas
            conversations={conversations}
            scores={scores}
            threshold={threshold}
            styleOn={styleOn}
            topicOn={topicOn}
            focusSnippetId={focusSnippetId}
            onFocusSnippet={setFocusSnippetId}
            onLassoSelect={(ids) => {
              setSelectionIds(ids);
              runSimilar(ids);
            }}
          />
        </div>
        <aside className="detail-wrap">
          <DetailPanel
            snippetId={focusSnippetId}
            styleQuery={styleQuery}
            topicQuery={topicQuery}
            score={focusSnippetId ? scores[focusSnippetId] : null}
          />
        </aside>
      </div>
    </div>
  );
}
