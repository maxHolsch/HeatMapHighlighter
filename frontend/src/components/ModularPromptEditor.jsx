import React, { useState } from 'react';

function HelpTooltip({ text }) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="help-icon-wrapper"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span className="help-icon">?</span>
      {visible && <span className="help-tooltip">{text}</span>}
    </span>
  );
}

export default function ModularPromptEditor({
  highlightDefinition,
  conversationContext,
  themeConditioning,
  onHighlightDefinitionChange,
  onConversationContextChange,
  onThemeConditioningChange,
  onPreview,
  onRun,
  disabled,
  detecting,
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="modular-prompt-editor">
      <div className="prompt-editor-header">
        <h3>Prompt Configuration</h3>
        <button
          className="prompt-toggle-btn"
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="prompt-field">
            <div className="prompt-field-header">
              <label>What kind of content are you looking to highlight?</label>
              <HelpTooltip text="Describe the type of moments you want to find. Be specific: mention emotional tone, content themes, or narrative types (e.g., personal stories, insights, disagreements). The more precise your definition, the better the results." />
            </div>
            <textarea
              className="prompt-field-textarea"
              value={highlightDefinition}
              onChange={(e) => onHighlightDefinitionChange(e.target.value)}
              spellCheck={false}
              rows={4}
            />
          </div>

          <div className="prompt-field">
            <div className="prompt-field-header">
              <label>Do you want to provide additional context about this conversation?</label>
              <HelpTooltip text="Provide background about the conversation setting, participants, or purpose. This helps the model understand the context and produce more relevant highlight scores." />
            </div>
            <textarea
              className="prompt-field-textarea"
              value={conversationContext}
              onChange={(e) => onConversationContextChange(e.target.value)}
              spellCheck={false}
              rows={3}
            />
          </div>

          <div className="prompt-field">
            <div className="prompt-field-header">
              <label>Do you want to find content related to a specific topic or theme?</label>
              <HelpTooltip text="Use this if you want to only find highlights related to a specific topic. For example, you could enter a theme like 'housing affordability' or 'experiences with the healthcare system' to focus the highlight extraction on that subject." />
            </div>
            <textarea
              className="prompt-field-textarea"
              value={themeConditioning}
              onChange={(e) => onThemeConditioningChange(e.target.value)}
              spellCheck={false}
              rows={3}
              placeholder="Leave empty to find highlights across all topics"
            />
          </div>

          <div className="prompt-actions">
            <button
              className="btn btn-secondary"
              onClick={onPreview}
              disabled={disabled}
            >
              Preview Full Prompt
            </button>
            <button
              className="btn btn-primary"
              onClick={onRun}
              disabled={disabled}
            >
              {detecting ? 'Detecting...' : 'Get AI-Generated Highlights'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
