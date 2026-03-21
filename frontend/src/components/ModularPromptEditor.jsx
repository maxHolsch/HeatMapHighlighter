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

  const requireHighlightDefinition = (callback) => () => {
    if (!highlightDefinition || !highlightDefinition.trim()) {
      alert('The highlight definition field must not be left blank. Please describe what kind of content you are looking to highlight.');
      return;
    }
    callback();
  };

  return (
    <div className="modular-prompt-editor">
      <div className="prompt-editor-header">
        <h3>Highlight Configurations</h3>
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
              <label>What kind of content are you looking to highlight? In other words, how are you defining a highlight?</label>
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
              <HelpTooltip text="Provide background about the conversation setting, participants, or purpose. This helps the model understand the context and produce more relevant highlights." />
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
              <HelpTooltip text="Fill in this field if you want to find highlights related to a specific topic or theme. For example, you could enter a theme like 'housing affordability' or 'experiences with the healthcare system' to focus the highlight detection on that subject. The more specific and precise your description, the better the results will be." />
            </div>
            <textarea
              className="prompt-field-textarea"
              value={themeConditioning}
              onChange={(e) => onThemeConditioningChange(e.target.value)}
              spellCheck={false}
              rows={20}
            />
          </div>

          <div className="prompt-actions">
            <button
              className="btn btn-secondary"
              onClick={requireHighlightDefinition(onPreview)}
              disabled={disabled}
            >
              Preview Full Prompt
            </button>
            <button
              className="btn btn-primary"
              onClick={requireHighlightDefinition(onRun)}
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
