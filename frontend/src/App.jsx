import React, { useState, useEffect, useCallback } from 'react';
import ConversationSelector from './components/ConversationSelector';
import PredictionsFileSelector from './components/PredictionsFileSelector';
import PromptEditor from './components/PromptEditor';
import PreviewModal from './components/PreviewModal';
import ThresholdControls from './components/ThresholdControls';
import TranscriptViewer from './components/TranscriptViewer';
import {
  fetchConversations,
  fetchTranscript,
  fetchPredictionFiles,
  fetchPrediction,
  fetchPreviewPrompt,
  fetchDefaultPrompt,
  runDetectHighlights,
} from './api';

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [predictionFiles, setPredictionFiles] = useState([]);
  const [selectedPredFile, setSelectedPredFile] = useState('');
  const [scores, setScores] = useState(null);
  const [threshold, setThreshold] = useState(5);
  const [promptTemplate, setPromptTemplate] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewMeta, setPreviewMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [viewMode, setViewMode] = useState('heatmap');

  useEffect(() => {
    fetchConversations().then(setConversations);
    fetchDefaultPrompt().then((data) => setPromptTemplate(data.prompt_template));
  }, []);

  const handleConversationChange = useCallback(async (convId) => {
    setSelectedConv(convId);
    setScores(null);
    setSelectedPredFile('');
    setPredictionFiles([]);
    setTranscript(null);

    if (!convId) return;

    setLoading(true);
    try {
      const [transcriptData, files] = await Promise.all([
        fetchTranscript(convId),
        fetchPredictionFiles(convId),
      ]);
      setTranscript(transcriptData);
      setPredictionFiles(files);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePredictionFileChange = useCallback(
    async (filename) => {
      setSelectedPredFile(filename);
      if (!filename || !selectedConv) {
        setScores(null);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchPrediction(selectedConv, filename);
        setScores(data.scores);
      } finally {
        setLoading(false);
      }
    },
    [selectedConv]
  );

  const handlePreviewPrompt = useCallback(async () => {
    if (!selectedConv) return;
    setLoading(true);
    try {
      const data = await fetchPreviewPrompt(selectedConv, promptTemplate);
      setPreviewText(data.preview_prompt);
      setPreviewMeta(data);
      setShowPreview(true);
    } finally {
      setLoading(false);
    }
  }, [selectedConv, promptTemplate]);

  const handleDetectHighlights = useCallback(async () => {
    if (!selectedConv) return;
    setShowPreview(false);
    setDetecting(true);
    try {
      const data = await runDetectHighlights(selectedConv, promptTemplate);
      setScores(data.scores);
      const files = await fetchPredictionFiles(selectedConv);
      setPredictionFiles(files);
      setSelectedPredFile(data.filename);
    } finally {
      setDetecting(false);
    }
  }, [selectedConv, promptTemplate]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Conversation Highlight Tool</h1>
      </header>

      <div className="control-panel">
        <div className="control-row">
          <ConversationSelector
            conversations={conversations}
            selected={selectedConv}
            onChange={handleConversationChange}
          />
          <PredictionsFileSelector
            files={predictionFiles}
            selected={selectedPredFile}
            onChange={handlePredictionFileChange}
            disabled={!selectedConv}
          />
          <ThresholdControls
            threshold={threshold}
            onChange={setThreshold}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>

        <PromptEditor
          value={promptTemplate}
          onChange={setPromptTemplate}
          onRun={handlePreviewPrompt}
          disabled={!selectedConv || loading || detecting}
          detecting={detecting}
        />
      </div>

      {showPreview && (
        <PreviewModal
          previewText={previewText}
          meta={previewMeta}
          onConfirm={handleDetectHighlights}
          onCancel={() => setShowPreview(false)}
          detecting={detecting}
        />
      )}

      {loading && !detecting && (
        <div className="loading-indicator">Loading...</div>
      )}

      {detecting && (
        <div className="loading-indicator detecting">
          Running highlight detection... This may take a minute.
        </div>
      )}

      {transcript && (
        <TranscriptViewer
          snippets={transcript.original_snippets}
          scores={scores}
          threshold={threshold}
          viewMode={viewMode}
        />
      )}
    </div>
  );
}
