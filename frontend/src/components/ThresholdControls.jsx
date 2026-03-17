import React from 'react';

export default function ThresholdControls({
  threshold,
  onChange,
  viewMode,
  onViewModeChange,
  spanHighlightsAvailable = false,
}) {
  return (
    <div className="threshold-controls">
      <div className="threshold-slider-group">
        <label>Threshold</label>
        <div className="threshold-slider-row">
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={threshold}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="threshold-value">{threshold}</span>
        </div>
      </div>

      <div className="mode-toggle-group">
        <label>View Mode</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`mode-toggle-btn ${viewMode === 'heatmap' ? 'active' : ''}`}
            onClick={() => onViewModeChange('heatmap')}
            style={{ flex: 1 }}
          >
            Heat Map
          </button>
          <button
            className={`mode-toggle-btn ${viewMode === 'final' ? 'active' : ''}`}
            onClick={() => onViewModeChange('final')}
            disabled={!spanHighlightsAvailable}
            title={
              spanHighlightsAvailable
                ? 'View precise highlight spans'
                : 'Run span-level detection first'
            }
            style={{ flex: 1 }}
          >
            Predicted Spans
          </button>
        </div>
      </div>
    </div>
  );
}
