import React, { useState } from 'react';

export default function PromptEditor({
  value,
  onChange,
  onRun,
  disabled,
  detecting,
}) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="prompt-editor">
      <div className="prompt-editor-header">
        <h3>Prompt Template</h3>
        <button
          className="prompt-toggle-btn"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <textarea
            className="prompt-textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
          <div className="prompt-actions">
            <button
              className="btn btn-primary"
              onClick={onRun}
              disabled={disabled}
            >
              {detecting ? 'Detecting...' : 'Run Highlight Detection'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
