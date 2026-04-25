import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import AutoHighlighter from './views/AutoHighlighter';
import CorpusHeatmap from './views/CorpusHeatmap';
import AnthologyWorkspace from './views/AnthologyWorkspace';

export default function App() {
  const [view, setView] = useState('highlighter');
  const tweaks = { values: { threshold: 5 } };

  return (
    <div className="page-grain" style={{ minHeight: '100vh', position: 'relative' }}>
      {/* Sidebar floats over the canvas — hidden until the cursor approaches the
          left edge. Lets the working area use the full viewport width. */}
      <Sidebar activeView={view} onNav={setView}/>

      <main style={{ flex: 1, minWidth: 0, position: 'relative', minHeight: '100vh' }}>
        {view === 'highlighter' && <AutoHighlighter tweaks={tweaks.values}/>}
        {view === 'corpus'      && <CorpusHeatmap tweaks={tweaks.values}/>}
        {view === 'anthology'   && <AnthologyWorkspace tweaks={tweaks.values}/>}
      </main>
    </div>
  );
}
