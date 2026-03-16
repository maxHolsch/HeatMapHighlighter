import React from 'react';

/**
 * Scaffolded component for second-pass span-level highlight editing.
 *
 * Future functionality:
 * - Render precise highlight spans within snippet text
 * - Drag handles for adjusting span start/end boundaries
 * - "Add new highlight" mode (mousedown + drag to select text)
 * - Integration with a second LLM pass that returns character-level offsets
 */
export default function HighlightSpanEditor({ snippets, highlights }) {
  return (
    <div className="span-editor-placeholder">
      <p>
        Span-level highlight editing will be available after the second-pass
        LLM refinement is implemented.
      </p>
      <p style={{ marginTop: 8, fontSize: '0.8rem' }}>
        This mode will allow you to view and adjust precise highlight
        boundaries, add new highlights, and accept or reject each one.
      </p>
    </div>
  );
}
