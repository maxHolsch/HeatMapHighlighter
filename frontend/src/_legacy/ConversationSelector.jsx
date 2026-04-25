import React from 'react';

export default function ConversationSelector({ conversations, selected, onChange }) {
  return (
    <div className="control-group">
      <label>Conversation ID</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">-- Select a conversation --</option>
        {conversations.map((id) => (
          <option key={id} value={id}>
            {id}
          </option>
        ))}
      </select>
    </div>
  );
}
