import React, { useCallback } from 'react';

function getHeatmapColor(score, threshold) {
  if (score < threshold) return 'transparent';
  if (score <= 4) return 'hsl(270, 55%, 93%)';
  if (score <= 7) return 'hsl(270, 60%, 83%)';
  return 'hsl(270, 65%, 72%)';
}

export default React.memo(function SnippetBlock({
  snippet,
  index,
  score,
  scoreEntry,
  threshold,
  viewMode,
  onMouseMove,
  onMouseLeave,
}) {
  const bgColor =
    viewMode === 'heatmap' ? getHeatmapColor(score, threshold) : 'transparent';
  const isHighlighted = viewMode === 'heatmap' && bgColor !== 'transparent';

  const handleMouseMove = useCallback(
    (e) => {
      if (isHighlighted && scoreEntry) {
        onMouseMove(e, scoreEntry);
      }
    },
    [isHighlighted, scoreEntry, onMouseMove]
  );

  const handleMouseLeave = useCallback(() => {
    onMouseLeave();
  }, [onMouseLeave]);

  return (
    <div
      className="snippet-block"
      style={{ background: bgColor }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {snippet.transcript}
    </div>
  );
});
