import React from 'react';

export default function AxisControls({
  styleOn, topicOn, blend, threshold,
  onStyleToggle, onTopicToggle, onBlendChange, onThresholdChange, onApply,
}) {
  return (
    <div className="axis-controls">
      <label className="axis-toggle">
        <input type="checkbox" checked={styleOn} onChange={(e) => { onStyleToggle(e.target.checked); onApply && onApply(); }} />
        Style (paralinguistic)
      </label>
      <label className="axis-toggle">
        <input type="checkbox" checked={topicOn} onChange={(e) => { onTopicToggle(e.target.checked); onApply && onApply(); }} />
        Topic (content)
      </label>
      <label className="axis-slider">
        Blend
        <input
          type="range" min="0" max="1" step="0.05"
          value={blend}
          onChange={(e) => onBlendChange(parseFloat(e.target.value))}
          onMouseUp={() => onApply && onApply()}
        />
        <span>{blend.toFixed(2)}</span>
      </label>
      <label className="axis-slider">
        Grey-out threshold
        <input
          type="range" min="0" max="1" step="0.02"
          value={threshold}
          onChange={(e) => onThresholdChange(parseFloat(e.target.value))}
        />
        <span>{threshold.toFixed(2)}</span>
      </label>
    </div>
  );
}
