import React, { useState, useCallback, useRef } from 'react';
import SnippetBlock from './SnippetBlock';
import ReasoningTooltip from './ReasoningTooltip';
import { snapToWordBoundary, charOffsetFromPoint } from '../utils/textUtils';

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

function findSnippetFromPoint(clientX, clientY) {
  const range = document.caretRangeFromPoint(clientX, clientY);
  if (!range) return null;
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  const blockEl = node?.closest('[data-snippet-index]');
  if (!blockEl) return null;
  const idx = parseInt(blockEl.getAttribute('data-snippet-index'), 10);
  if (isNaN(idx)) return null;
  const charOffset = charOffsetFromPoint(clientX, clientY, blockEl);
  if (charOffset < 0) return null;
  return { snippetIndex: idx, charOffset, blockEl };
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
  const dragRef = useRef(null);

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

  // --- Cross-snippet drag-to-resize ---

  const buildSpansForDrag = useCallback(
    (highlightId, side, targetSnippetIdx, targetCharOffset) => {
      if (!snippets || !spanHighlights) return null;
      const hl = spanHighlights.find((h) => h.id === highlightId);
      if (!hl || hl.spans.length === 0) return null;

      const sortedSpans = [...hl.spans].sort((a, b) => a.snippet_index - b.snippet_index);
      const firstIdx = sortedSpans[0].snippet_index;
      const lastIdx = sortedSpans[sortedSpans.length - 1].snippet_index;

      const snapped = snapToWordBoundary(
        snippets[targetSnippetIdx].transcript,
        targetCharOffset,
        side,
      );

      let newFirstIdx, newFirstStart, newLastIdx, newLastEnd;

      if (side === 'start') {
        // Clamp: start can't go past the end boundary
        if (targetSnippetIdx > lastIdx) return null;
        if (targetSnippetIdx === lastIdx) {
          const lastEnd = sortedSpans[sortedSpans.length - 1].char_end;
          if (snapped >= lastEnd) return null;
        }
        newFirstIdx = targetSnippetIdx;
        newFirstStart = snapped;
        newLastIdx = lastIdx;
        newLastEnd = sortedSpans[sortedSpans.length - 1].char_end;
      } else {
        // Clamp: end can't go before the start boundary
        if (targetSnippetIdx < firstIdx) return null;
        if (targetSnippetIdx === firstIdx) {
          const firstStart = sortedSpans[0].char_start;
          if (snapped <= firstStart) return null;
        }
        newFirstIdx = firstIdx;
        newFirstStart = sortedSpans[0].char_start;
        newLastIdx = targetSnippetIdx;
        newLastEnd = snapped;
      }

      const newSpans = [];
      for (let idx = newFirstIdx; idx <= newLastIdx; idx++) {
        if (idx < 0 || idx >= snippets.length) continue;
        const text = snippets[idx].transcript;
        let cStart = 0;
        let cEnd = text.length;

        if (idx === newFirstIdx) cStart = newFirstStart;
        if (idx === newLastIdx) cEnd = newLastEnd;

        if (cStart >= cEnd) continue;

        newSpans.push({
          snippet_index: idx,
          char_start: cStart,
          char_end: cEnd,
          text: text.slice(cStart, cEnd),
        });
      }

      return newSpans.length > 0 ? newSpans : null;
    },
    [snippets, spanHighlights],
  );

  const handleDragStart = useCallback(
    (e, highlightId, _snippetIdx, side) => {
      e.preventDefault();
      e.stopPropagation();

      dragRef.current = { highlightId, side };

      const onMove = (moveEvent) => {
        const drag = dragRef.current;
        if (!drag) return;
        const hit = findSnippetFromPoint(moveEvent.clientX, moveEvent.clientY);
        if (!hit) return;

        const newSpans = buildSpansForDrag(
          drag.highlightId,
          drag.side,
          hit.snippetIndex,
          hit.charOffset,
        );
        if (newSpans) {
          onHighlightUpdate(drag.highlightId, newSpans);
        }
      };

      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [buildSpansForDrag, onHighlightUpdate],
  );

  // --- Add-new-highlight selection ---

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

  // --- Build element list ---

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
        onDragStart={handleDragStart}
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
