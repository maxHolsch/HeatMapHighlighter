import React from 'react';

export default function HighlightActionButtons({
  status = 'pending',
  onAccept,
  onReject,
  onUndo,
  onDelete,
}) {
  if (status === 'accepted') {
    return (
      <span className="highlight-actions" onClick={(e) => e.stopPropagation()}>
        <span className="accepted-badge">Accepted</span>
        <button className="action-btn undo" onClick={onUndo}>
          Undo
        </button>
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span className="highlight-actions" onClick={(e) => e.stopPropagation()}>
        <span className="rejected-badge">Rejected</span>
        <button className="action-btn undo" onClick={onUndo}>
          Undo
        </button>
        {onDelete && (
          <button className="action-btn delete" onClick={onDelete}>
            Delete
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="highlight-actions" onClick={(e) => e.stopPropagation()}>
      <button className="action-btn accept" onClick={onAccept}>
        Accept
      </button>
      <button className="action-btn reject" onClick={onReject}>
        Reject
      </button>
    </span>
  );
}
