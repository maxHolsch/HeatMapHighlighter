import React, { useState, useEffect } from 'react';

export default function QueryBar({ value, onSubmit, loading }) {
  const [local, setLocal] = useState(value || '');

  useEffect(() => {
    setLocal(value || '');
  }, [value]);

  return (
    <form
      className="query-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(local);
      }}
    >
      <input
        type="text"
        value={local}
        placeholder='Try: "moments where people got frustrated talking about housing"'
        onChange={(e) => setLocal(e.target.value)}
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Searching…' : 'Search'}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => {
            setLocal('');
            onSubmit('');
          }}
        >
          Clear
        </button>
      )}
    </form>
  );
}
