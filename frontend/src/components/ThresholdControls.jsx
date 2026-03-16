import React from 'react';

export default function ThresholdControls({
  threshold,
  onChange,
  viewMode,
  onViewModeChange,
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
          >
            Heat Map
          </button>
          <button
            className={`mode-toggle-btn ${viewMode === 'final' ? 'active' : ''}`}
            onClick={() => onViewModeChange('final')}
            disabled
            title="Available after second-pass span detection"
          >
            Final Highlights
          </button>
        </div>
      </div>
    </div>
  );
}
