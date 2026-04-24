import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import CorpusHeatMap from './views/CorpusHeatMap';
import AnthologyList from './views/AnthologyList';
import AnthologyWorkspace from './views/AnthologyWorkspace';
import Shell from './views/Shell';
import './App.css';
import './views/views.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<App />} />
          <Route path="/corpus" element={<CorpusHeatMap />} />
          <Route path="/corpus/:corpusId" element={<CorpusHeatMap />} />
          <Route path="/anthologies" element={<AnthologyList />} />
          <Route path="/anthologies/:id" element={<AnthologyWorkspace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
