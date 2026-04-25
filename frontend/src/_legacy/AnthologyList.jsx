import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAnthologies, createAnthology } from '../api';

export default function AnthologyList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchAnthologies().then(setRows).catch(() => {});
  }, []);

  const reload = () => fetchAnthologies().then(setRows);

  const handleCreate = async () => {
    const name = newName.trim() || 'Untitled anthology';
    const res = await createAnthology(name);
    setNewName('');
    navigate(`/anthologies/${res.id}`);
  };

  return (
    <div className="anth-list">
      <div className="anth-list-header">
        <h2>Anthologies</h2>
        <div>
          <input
            placeholder="New anthology name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button onClick={handleCreate}>Create</button>
        </div>
      </div>
      <ul>
        {rows.map((a) => (
          <li key={a.id}>
            <button onClick={() => navigate(`/anthologies/${a.id}`)}>{a.name}</button>
            <span className="anth-list-meta">
              updated {new Date(a.updated_at).toLocaleString()}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="empty-hint">No anthologies yet. Lift a clip from the Corpus Heatmap or from an Auto-Highlighter span to create one.</li>}
      </ul>
    </div>
  );
}
