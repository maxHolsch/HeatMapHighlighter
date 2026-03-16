import React from 'react';

export default function ReasoningTooltip({ x, y, score, reasoning }) {
  return (
    <div
      className="reasoning-tooltip"
      style={{ left: x, top: y }}
    >
      <div className="tooltip-score">Score: {score}</div>
      {reasoning && <div>{reasoning}</div>}
    </div>
  );
}
