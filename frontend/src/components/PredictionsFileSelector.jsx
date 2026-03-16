import React from 'react';

export default function PredictionsFileSelector({
  files,
  selected,
  onChange,
  disabled,
}) {
  return (
    <div className="control-group">
      <label>Predictions File</label>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || files.length === 0}
      >
        <option value="">
          {files.length === 0 ? 'No predictions available' : '-- Select predictions --'}
        </option>
        {files.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </div>
  );
}
