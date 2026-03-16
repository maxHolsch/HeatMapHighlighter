import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [detectElapsed, setDetectElapsed] = useState(0);
  const [viewMode, setViewMode] = useState('heatmap');
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  useEffect(() => {
    fetchConversations().then(setConversations);
    fetchDefaultPrompt().then((data) => setPromptTemplate(data.prompt_template));
  }, []);

  const startTimer = useCallback(() => {
    setDetectElapsed(0);
    timerRef.current = setInterval(() => {
      setDetectElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleConversationChange = useCallback(async (convId) => {
    setSelectedConv(convId);
    setScores(null);
    setSelectedPredFile('');
    setPredictionFiles([]);
    setTranscript(null);
    setError(null);

    if (!convId) return;

    setLoading(true);
    try {
      const [transcriptData, files] = await Promise.all([
        fetchTranscript(convId),
        fetchPredictionFiles(convId),
      ]);
      setTranscript(transcriptData);
      setPredictionFiles(files);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePredictionFileChange = useCallback(
    async (filename) => {
      setSelectedPredFile(filename);
      setError(null);
      if (!filename || !selectedConv) {
        setScores(null);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchPrediction(selectedConv, filename);
        setScores(data.scores);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedConv]
  );

  const handlePreviewPrompt = useCallback(async () => {
    if (!selectedConv) return;
    setError(null);
    setLoading(true);
    try {
      const data = await fetchPreviewPrompt(selectedConv, promptTemplate);
      setPreviewText(data.preview_prompt);
      setPreviewMeta(data);
      setShowPreview(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedConv, promptTemplate]);

  const handleDetectHighlights = useCallback(async () => {
    if (!selectedConv) return;
    setShowPreview(false);
    setError(null);
    setDetecting(true);
    startTimer();
    try {
      const data = await runDetectHighlights(selectedConv, promptTemplate);
      setScores(data.scores);
      const files = await fetchPredictionFiles(selectedConv);
      setPredictionFiles(files);
      setSelectedPredFile(data.filename);
    } catch (e) {
      setError(e.message);
    } finally {
      stopTimer();
      setDetecting(false);
    }
  }, [selectedConv, promptTemplate, startTimer, stopTimer]);

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Conversation Highlight Tool</h1>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button
            className="error-dismiss"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

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
        <div className="detecting-overlay">
          <div className="detecting-card">
            <div className="detecting-spinner" />
            <div className="detecting-text">
              Running highlight detection...
            </div>
            <div className="detecting-elapsed">
              Elapsed: {formatElapsed(detectElapsed)}
            </div>
            <div className="detecting-subtext">
              This can take 1-3 minutes depending on transcript length.
            </div>
          </div>
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
