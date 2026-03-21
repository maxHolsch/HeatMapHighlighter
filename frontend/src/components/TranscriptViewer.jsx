import React, { useState, useCallback, useRef } from 'react';
import SnippetBlock from './SnippetBlock';
import ReasoningTooltip from './ReasoningTooltip';

function getHighlightsForSnippet(spanHighlights, snippetIndex) {
  if (!spanHighlights) return [];
  const results = [];
  for (const hl of spanHighlights) {
    const maxSnippetIdx = Math.max(...hl.spans.map((s) => s.snippet_index));
    for (const span of hl.spans) {
      if (span.snippet_index === snippetIndex) {
        results.push({
          highlightId: hl.id,
          status: hl.status,
          isLastSnippet: snippetIndex === maxSnippetIdx,
          ...span,
        });
      }
    }
  }
  results.sort((a, b) => a.char_start - b.char_start);
  return results;
}

export default function TranscriptViewer({
  snippets,
  scores,
  threshold,
  viewMode,
  spanHighlights,
  addingHighlight,
  onHighlightAction,
  onHighlightUpdate,
  onAddHighlight,
  onDeleteHighlight,
}) {
  const [tooltip, setTooltip] = useState(null);
  const [spanTooltip, setSpanTooltip] = useState(null);
  const selectionStartRef = useRef(null);

  const handleMouseMove = useCallback((e, scoreEntry) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      score: scoreEntry.score,
      reasoning: scoreEntry.reasoning,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleSpanMouseMove = useCallback((e, highlightId) => {
    if (!spanHighlights) return;
    const hl = spanHighlights.find((h) => h.id === highlightId);
    if (!hl) return;
    const reasoning = hl.id.startsWith('hl_user_')
      ? 'User-created highlight'
      : hl.reasoning || '';
    setSpanTooltip({ x: e.clientX, y: e.clientY, reasoning });
  }, [spanHighlights]);

  const handleSpanMouseLeave = useCallback(() => {
    setSpanTooltip(null);
  }, []);

  const handleSelectionComplete = useCallback(
    (startSnippetIdx, startCharIdx, endSnippetIdx, endCharIdx) => {
      if (!onAddHighlight || !snippets) return;
      const spans = [];
      for (let idx = startSnippetIdx; idx <= endSnippetIdx; idx++) {
        const text = snippets[idx].transcript;
        const cStart = idx === startSnippetIdx ? startCharIdx : 0;
        const cEnd = idx === endSnippetIdx ? endCharIdx : text.length;
        if (cStart < cEnd) {
          spans.push({
            snippet_index: idx,
            char_start: cStart,
            char_end: cEnd,
            text: text.slice(cStart, cEnd),
          });
        }
      }
      if (spans.length === 0) return;
      const id = `hl_user_${Date.now()}`;
      onAddHighlight({
        id,
        spans,
        full_text: spans.map((s) => s.text).join(' '),
        reasoning: 'User-created highlight',
        status: 'pending',
      });
    },
    [onAddHighlight, snippets]
  );

  const scoreMap = {};
  if (scores) {
    for (const entry of scores) {
      scoreMap[entry.snippet_index] = entry;
    }
  }

  const elements = [];
  let lastSpeakerId = null;

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    const scoreEntry = scoreMap[i] || null;
    const score = scoreEntry ? scoreEntry.score : 0;
    const snippetSpans =
      viewMode === 'final' ? getHighlightsForSnippet(spanHighlights, i) : [];

    if (snippet.speaker_id !== lastSpeakerId) {
      elements.push(
        <div key={`speaker-${i}`} className="speaker-label">
          {snippet.speaker_name}
        </div>
      );
      lastSpeakerId = snippet.speaker_id;
    }

    elements.push(
      <SnippetBlock
        key={`snippet-${i}`}
        snippet={snippet}
        index={i}
        score={score}
        scoreEntry={scoreEntry}
        threshold={threshold}
        viewMode={viewMode}
        highlightSpans={snippetSpans}
        addingHighlight={addingHighlight}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onHighlightAction={onHighlightAction}
        onHighlightUpdate={onHighlightUpdate}
        onDeleteHighlight={onDeleteHighlight}
        onSelectionComplete={handleSelectionComplete}
        selectionStartRef={selectionStartRef}
        onSpanMouseMove={handleSpanMouseMove}
        onSpanMouseLeave={handleSpanMouseLeave}
      />
    );
  }

  return (
    <div className={`transcript-viewer ${addingHighlight ? 'add-highlight-mode' : ''}`}>
      {snippets.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Select a conversation to view its transcript.
        </p>
      ) : (
        elements
      )}
      {tooltip && <ReasoningTooltip {...tooltip} />}
      {spanTooltip && (
        <ReasoningTooltip
          x={spanTooltip.x}
          y={spanTooltip.y}
          reasoning={spanTooltip.reasoning}
        />
      )}
    </div>
  );
}
