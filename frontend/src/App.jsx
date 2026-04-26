import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import AutoHighlighter from './views/AutoHighlighter';
import CorpusHeatmap from './views/CorpusHeatMap';
import AnthologyWorkspace from './views/AnthologyWorkspace';

const FIXED_TWEAKS = { threshold: 5 };

export default function App() {
  const [view, setView] = useState('highlighter');

  return (
    <div className="page-grain" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeView={view} onNav={setView}/>
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {view === 'highlighter' && <AutoHighlighter tweaks={FIXED_TWEAKS}/>}
        {view === 'corpus'      && <CorpusHeatmap tweaks={FIXED_TWEAKS}/>}
        {view === 'anthology'   && <AnthologyWorkspace tweaks={FIXED_TWEAKS}/>}
      </main>
    </div>
  );
}
