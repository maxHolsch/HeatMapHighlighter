import React from 'react';

export default function PreviewModal({
  previewText,
  meta,
  onConfirm,
  onCancel,
  detecting,
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Prompt Preview</h2>
          <button className="btn btn-secondary" onClick={onCancel}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {meta && (
            <div className="modal-meta">
              Merged snippets: <strong>{meta.num_merged_snippets}</strong>
              &nbsp;&middot;&nbsp; Full prompt length:{' '}
              <strong>{meta.full_prompt_length.toLocaleString()}</strong>{' '}
              characters
            </div>
          )}
          <pre>{previewText}</pre>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={detecting}
          >
            {detecting ? 'Detecting...' : 'Get Highlights'}
          </button>
        </div>
      </div>
    </div>
  );
}
