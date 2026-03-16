import React from 'react';

/**
 * Scaffolded accept/reject buttons for individual highlight spans.
 *
 * States: pending -> accepted | rejected
 * Accepted highlights show an "undo" button to revert.
 *
 * This component will be integrated into HighlightSpanEditor once the
 * second-pass LLM refinement is implemented.
 */
export default function HighlightActionButtons({
  status = 'pending',
  onAccept,
  onReject,
  onUndo,
}) {
  if (status === 'accepted') {
    return (
      <span className="highlight-actions">
        <span className="accepted-badge">Accepted</span>
        <button className="action-btn undo" onClick={onUndo}>
          Undo
        </button>
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span className="highlight-actions">
        <button className="action-btn undo" onClick={onUndo}>
          Undo
        </button>
      </span>
    );
  }

  return (
    <span className="highlight-actions">
      <button className="action-btn accept" onClick={onAccept}>
        Accept
      </button>
      <button className="action-btn reject" onClick={onReject}>
        Reject
      </button>
    </span>
  );
}
