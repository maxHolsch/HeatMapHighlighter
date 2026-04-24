import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export default function Shell() {
  return (
    <div className="shell">
      <nav className="shell-nav">
        <div className="shell-brand">Heatmap Highlighter</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `shell-tab ${isActive ? 'active' : ''}`}
        >
          Auto-Highlighter
        </NavLink>
        <NavLink
          to="/corpus"
          className={({ isActive }) => `shell-tab ${isActive ? 'active' : ''}`}
        >
          Corpus Heatmap
        </NavLink>
        <NavLink
          to="/anthologies"
          className={({ isActive }) => `shell-tab ${isActive ? 'active' : ''}`}
        >
          Anthologies
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
