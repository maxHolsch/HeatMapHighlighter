import React, { useState, useCallback } from 'react';
import SnippetBlock from './SnippetBlock';
import ReasoningTooltip from './ReasoningTooltip';

export default function TranscriptViewer({
  snippets,
  scores,
  threshold,
  viewMode,
}) {
  const [tooltip, setTooltip] = useState(null);

  const handleMouseMove = useCallback((e, scoreEntry) => {
    setTooltip({
      x: e.clientX,
      y: e.clientY,
      score: scoreEntry.score,
      reasoning: scoreEntry.reasoning,
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const scoreMap = {};
  if (scores) {
    for (const entry of scores) {
      scoreMap[entry.snippet_index] = entry;
    }
  }

  const elements = [];
  let lastSpeakerId = null;

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i];
    const scoreEntry = scoreMap[i] || null;
    const score = scoreEntry ? scoreEntry.score : 0;

    if (snippet.speaker_id !== lastSpeakerId) {
      elements.push(
        <div key={`speaker-${i}`} className="speaker-label">
          {snippet.speaker_name}
        </div>
      );
      lastSpeakerId = snippet.speaker_id;
    }

    elements.push(
      <SnippetBlock
        key={`snippet-${i}`}
        snippet={snippet}
        index={i}
        score={score}
        scoreEntry={scoreEntry}
        threshold={threshold}
        viewMode={viewMode}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    );
  }

  return (
    <div className="transcript-viewer">
      {snippets.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Select a conversation to view its transcript.
        </p>
      ) : (
        elements
      )}
      {tooltip && <ReasoningTooltip {...tooltip} />}
    </div>
  );
}
