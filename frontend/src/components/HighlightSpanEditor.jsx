import React from 'react';

/**
 * Summary panel for the current span-level highlight session.
 * Displayed in the sidebar showing progress counts.
 */
export default function HighlightSpanEditor({ highlights }) {
  if (!highlights || highlights.length === 0) return null;

  const pending = highlights.filter((h) => h.status === 'pending').length;
  const accepted = highlights.filter((h) => h.status === 'accepted').length;
  const rejected = highlights.filter((h) => h.status === 'rejected').length;

  return (
    <div className="span-editor-summary">
      <div className="span-count">
        <strong>{highlights.length}</strong> highlight{highlights.length !== 1 ? 's' : ''}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span className="span-stat pending-stat">{pending} pending</span>
        <span className="span-stat accepted-stat">{accepted} accepted</span>
        <span className="span-stat rejected-stat">{rejected} rejected</span>
      </div>
    </div>
  );
}
