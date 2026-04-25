import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import { useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSlider } from './components/TweaksPanel';
import AutoHighlighter from './views/AutoHighlighter';
import CorpusHeatmap from './views/CorpusHeatmap';
import AnthologyWorkspace from './views/AnthologyWorkspace';

const TWEAK_DEFAULTS = {
  heatStyle: 'tiles',
  transcriptLayout: 'stacked',
  threshold: 5,
};

export default function App() {
  const [view, setView] = useState('highlighter');
  const tweaks = useTweaks(TWEAK_DEFAULTS);

  return (
    <div className="page-grain" style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar activeView={view} onNav={setView}/>
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        {view === 'highlighter' && <AutoHighlighter tweaks={tweaks.values}/>}
        {view === 'corpus'      && <CorpusHeatmap tweaks={tweaks.values}/>}
        {view === 'anthology'   && <AnthologyWorkspace tweaks={tweaks.values}/>}
      </main>

      <TweaksPanel title="Tweaks">
        <TweakSection title="Heat visualization">
          <TweakRadio
            label="Heat style"
            value={tweaks.values.heatStyle}
            options={[
              { value: 'tiles',     label: 'Riso tiles' },
              { value: 'underline', label: 'Underline' },
              { value: 'margin',    label: 'Margin' },
            ]}
            onChange={(v) => tweaks.set('heatStyle', v)}/>
          <TweakSlider
            label="Heat threshold"
            min={1} max={10} step={1}
            value={tweaks.values.threshold}
            onChange={(v) => tweaks.set('threshold', v)}/>
        </TweakSection>
        <TweakSection title="Transcript layout">
          <TweakRadio
            label="Layout"
            value={tweaks.values.transcriptLayout}
            options={[
              { value: 'stacked', label: 'Stacked' },
              { value: 'two-col', label: 'Two-col' },
            ]}
            onChange={(v) => tweaks.set('transcriptLayout', v)}/>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}
