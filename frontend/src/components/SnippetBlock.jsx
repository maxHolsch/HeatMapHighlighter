import React, { useCallback, useRef } from 'react';
import HighlightActionButtons from './HighlightActionButtons';

function getHeatmapColor(score, threshold) {
  if (score < threshold) return 'transparent';
  if (score <= 4) return 'hsl(270, 55%, 93%)';
  if (score <= 7) return 'hsl(270, 60%, 83%)';
  return 'hsl(270, 65%, 72%)';
}

function snapToWordBoundary(text, charIdx, direction) {
  if (charIdx <= 0) return 0;
  if (charIdx >= text.length) return text.length;
  if (direction === 'start') {
    let i = charIdx;
    while (i > 0 && text[i - 1] !== ' ') i--;
    return i;
  }
  let i = charIdx;
  while (i < text.length && text[i] !== ' ') i++;
  return i;
}

function getStatusClass(status) {
  if (status === 'accepted') return 'highlight-span accepted';
  if (status === 'rejected') return 'highlight-span rejected';
  return 'highlight-span pending';
}

function renderSpannedText(snippet, highlightSpans, onHighlightAction, onDeleteHighlight, onDragStart) {
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
        <span key={`hl-${span.highlightId}-${start}`} className={getStatusClass(span.status)}>
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
  onHighlightUpdate,
  onDeleteHighlight,
  onSelectionComplete,
  selectionStartRef,
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
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!range) return;
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let charOffset = 0;
      let node;
      while ((node = walker.nextNode())) {
        if (node === textNode) {
          charOffset += range.startOffset;
          break;
        }
        charOffset += node.textContent.length;
      }
      selectionStartRef.current = { snippetIndex: index, charIndex: charOffset };
    },
    [addingHighlight, viewMode, index, selectionStartRef]
  );

  const handleMouseUp = useCallback(
    (e) => {
      if (!addingHighlight || viewMode !== 'final' || !selectionStartRef.current) return;
      const el = blockRef.current;
      if (!el) return;
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (!range) return;
      const textNode = range.startContainer;
      if (textNode.nodeType !== Node.TEXT_NODE) return;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
      let charOffset = 0;
      let node;
      while ((node = walker.nextNode())) {
        if (node === textNode) {
          charOffset += range.startOffset;
          break;
        }
        charOffset += node.textContent.length;
      }

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

  const handleDragStart = useCallback(
    (e, highlightId, snippetIdx, side) => {
      e.preventDefault();
      e.stopPropagation();
      const text = snippet.transcript;

      const onMove = (moveEvent) => {
        const el = blockRef.current;
        if (!el) return;
        const range = document.caretRangeFromPoint(moveEvent.clientX, moveEvent.clientY);
        if (!range) return;
        const textNode = range.startContainer;
        if (textNode.nodeType !== Node.TEXT_NODE) return;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        let charOffset = 0;
        let node;
        while ((node = walker.nextNode())) {
          if (node === textNode) {
            charOffset += range.startOffset;
            break;
          }
          charOffset += node.textContent.length;
        }
        const snapped = snapToWordBoundary(text, charOffset, side);
        if (onHighlightUpdate) {
          onHighlightUpdate(highlightId, (prevSpans) => {
            return prevSpans.map((s) => {
              if (s.snippet_index !== snippetIdx) return s;
              const newStart = side === 'start' ? snapped : s.char_start;
              const newEnd = side === 'end' ? snapped : s.char_end;
              if (newStart >= newEnd) return s;
              return {
                ...s,
                char_start: newStart,
                char_end: newEnd,
                text: text.slice(newStart, newEnd),
              };
            });
          });
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [snippet, onHighlightUpdate]
  );

  if (viewMode === 'final') {
    return (
      <div
        ref={blockRef}
        className="snippet-block snippet-block-final"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
      >
        {renderSpannedText(
          snippet,
          highlightSpans,
          onHighlightAction,
          onDeleteHighlight,
          handleDragStart,
        )}
      </div>
    );
  }

  return (
    <div
      ref={blockRef}
      className="snippet-block"
      style={{ background: bgColor }}
      onMouseMove={handleMouseMoveHeatmap}
      onMouseLeave={handleMouseLeaveHeatmap}
    >
      {snippet.transcript}
    </div>
  );
});
