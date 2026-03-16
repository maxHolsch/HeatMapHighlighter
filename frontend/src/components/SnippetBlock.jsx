import React, { useCallback } from 'react';

function getHeatmapColor(score, threshold) {
  if (score < threshold) return 'transparent';

  const range = 10 - threshold;
  if (range <= 0) return 'transparent';

  const t = (score - threshold) / range;
  const lightness = 95 - t * 40;
  const saturation = 55 + t * 20;
  return `hsl(270, ${saturation}%, ${lightness}%)`;
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
  const isHighlighted = viewMode === 'heatmap' && score >= threshold;
  const bgColor =
    viewMode === 'heatmap' ? getHeatmapColor(score, threshold) : 'transparent';

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
