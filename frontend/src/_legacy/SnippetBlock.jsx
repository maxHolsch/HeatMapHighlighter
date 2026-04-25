import React, { useCallback, useRef } from 'react';
import HighlightActionButtons from './HighlightActionButtons';
import { snapToWordBoundary, charOffsetFromPoint } from '../utils/textUtils';

function getHeatmapColor(score, threshold) {
  if (score < threshold) return 'transparent';
  if (score <= 4) return 'hsl(270, 55%, 93%)';
  if (score <= 7) return 'hsl(270, 60%, 83%)';
  return 'hsl(270, 65%, 72%)';
}

function getStatusClass(status) {
  if (status === 'accepted') return 'highlight-span accepted';
  if (status === 'rejected') return 'highlight-span rejected';
  return 'highlight-span pending';
}

function renderSpannedText(snippet, highlightSpans, onHighlightAction, onDeleteHighlight, onDragStart, onSpanMouseMove, onSpanMouseLeave) {
  const text = snippet.transcript;
  if (!highlightSpans || highlightSpans.length === 0) {
    return <span>{text}</span>;
  }

  const segments = [];
  let pos = 0;

  for (let i = 0; i < highlightSpans.length; i++) {
    const span = highlightSpans[i];
    const start = Math.max(pos, span.char_start);
    const end = Math.min(text.length, span.char_end);

    if (pos < start) {
      segments.push(
        <span key={`plain-${pos}`} className="plain-text">
          {text.slice(pos, start)}
        </span>
      );
    }

    if (start < end) {
      segments.push(
        <span
          key={`hl-${span.highlightId}-${start}`}
          className={getStatusClass(span.status)}
          onMouseMove={(e) => onSpanMouseMove && onSpanMouseMove(e, span.highlightId)}
          onMouseLeave={onSpanMouseLeave}
        >
          <span
            className="drag-handle drag-handle-left"
            onMouseDown={(e) => onDragStart(e, span.highlightId, span.snippet_index, 'start')}
            title="Drag to adjust start"
          />
          <span className="highlight-text">{text.slice(start, end)}</span>
          <span
            className="drag-handle drag-handle-right"
            onMouseDown={(e) => onDragStart(e, span.highlightId, span.snippet_index, 'end')}
            title="Drag to adjust end"
          />
          {span.isLastSnippet && (
            <HighlightActionButtons
              status={span.status}
              onAccept={() => onHighlightAction(span.highlightId, 'accept')}
              onReject={() => onHighlightAction(span.highlightId, 'reject')}
              onUndo={() => onHighlightAction(span.highlightId, 'undo')}
              onDelete={() => onDeleteHighlight(span.highlightId)}
            />
          )}
        </span>
      );
    }

    pos = end;
  }

  if (pos < text.length) {
    segments.push(
      <span key={`plain-${pos}`} className="plain-text">
        {text.slice(pos)}
      </span>
    );
  }

  return segments;
}

export default React.memo(function SnippetBlock({
  snippet,
  index,
  score,
  scoreEntry,
  threshold,
  viewMode,
  highlightSpans,
  addingHighlight,
  onMouseMove,
  onMouseLeave,
  onHighlightAction,
  onDragStart,
  onDeleteHighlight,
  onSelectionComplete,
  selectionStartRef,
  onSpanMouseMove,
  onSpanMouseLeave,
}) {
  const blockRef = useRef(null);

  const bgColor =
    viewMode === 'heatmap' ? getHeatmapColor(score, threshold) : 'transparent';
  const isHighlighted = viewMode === 'heatmap' && bgColor !== 'transparent';

  const handleMouseMoveHeatmap = useCallback(
    (e) => {
      if (isHighlighted && scoreEntry) {
        onMouseMove(e, scoreEntry);
      }
    },
    [isHighlighted, scoreEntry, onMouseMove]
  );

  const handleMouseLeaveHeatmap = useCallback(() => {
    onMouseLeave();
  }, [onMouseLeave]);

  const handleMouseDown = useCallback(
    (e) => {
      if (!addingHighlight || viewMode !== 'final') return;
      const el = blockRef.current;
      if (!el) return;
      const offset = charOffsetFromPoint(e.clientX, e.clientY, el);
      if (offset < 0) return;
      selectionStartRef.current = { snippetIndex: index, charIndex: offset };
    },
    [addingHighlight, viewMode, index, selectionStartRef]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (!addingHighlight || viewMode !== 'final' || !selectionStartRef.current) return;
      const el = blockRef.current;
      if (!el) return;
      const charOffset = charOffsetFromPoint(e.clientX, e.clientY, el);
      if (charOffset < 0) return;

      const start = selectionStartRef.current;
      selectionStartRef.current = null;

      let startSnip = start.snippetIndex;
      let startChar = start.charIndex;
      let endSnip = index;
      let endChar = charOffset;

      if (startSnip > endSnip || (startSnip === endSnip && startChar > endChar)) {
        [startSnip, endSnip] = [endSnip, startSnip];
        [startChar, endChar] = [endChar, startChar];
      }

      if (startSnip === endSnip && startChar === endChar) return;

      const snippetText = snippet.transcript;
      startChar = snapToWordBoundary(snippetText, startChar, 'start');
      endChar = snapToWordBoundary(snippetText, endChar, 'end');

      onSelectionComplete(startSnip, startChar, endSnip, endChar);
      window.getSelection()?.removeAllRanges();
    },
    [addingHighlight, viewMode, index, snippet, selectionStartRef, onSelectionComplete]
  );

  if (viewMode === 'final') {
    return (
      <div
        ref={blockRef}
        className="snippet-block snippet-block-final"
        data-snippet-index={index}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {renderSpannedText(
          snippet,
          highlightSpans,
          onHighlightAction,
          onDeleteHighlight,
          onDragStart,
          onSpanMouseMove,
          onSpanMouseLeave,
        )}
      </div>
    );
  }

  return (
    <div
      ref={blockRef}
      className="snippet-block"
      data-snippet-index={index}
      style={{ background: bgColor }}
      onMouseMove={handleMouseMoveHeatmap}
      onMouseLeave={handleMouseLeaveHeatmap}
    >
      {snippet.transcript}
    </div>
  );
});
