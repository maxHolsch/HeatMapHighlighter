import React, { useState, useEffect, useCallback, useRef } from 'react';
import ConversationSelector from './components/ConversationSelector';
import PredictionsFileSelector from './components/PredictionsFileSelector';
import PromptEditor from './components/PromptEditor';
import ModularPromptEditor from './components/ModularPromptEditor';
import PreviewModal from './components/PreviewModal';
import ThresholdControls from './components/ThresholdControls';
import TranscriptViewer from './components/TranscriptViewer';
import HighlightSpanEditor from './components/HighlightSpanEditor';
import {
  fetchConversations,
  fetchTranscript,
  fetchPredictionFiles,
  fetchPrediction,
  fetchPreviewPrompt,
  fetchDefaultPrompt,
  runDetectHighlights,
  runDetectSpans,
  saveHighlights,
  fetchSpanPredictionFiles,
  fetchSpanPrediction,
  fetchConfig,
  fetchPromptComponents,
  previewModularPrompt,
  runEndToEndPipeline,
} from './api';

export default function App() {
  // --- Config ---
  const [endToEnd, setEndToEnd] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  // --- Common state ---
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [scores, setScores] = useState(null);
  const [threshold, setThreshold] = useState(5);
  const [viewMode, setViewMode] = useState('heatmap');
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectElapsed, setDetectElapsed] = useState(0);
  const [error, setError] = useState(null);

  // --- Two-step mode state ---
  const [predictionFiles, setPredictionFiles] = useState([]);
  const [selectedPredFile, setSelectedPredFile] = useState('');
  const [promptTemplate, setPromptTemplate] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewMeta, setPreviewMeta] = useState(null);

  // --- End-to-end mode state ---
  const [highlightDefinition, setHighlightDefinition] = useState('');
  const [conversationContext, setConversationContext] = useState('');
  const [themeConditioning, setThemeConditioning] = useState('');
  const [showE2EConfirm, setShowE2EConfirm] = useState(false);
  const [showModularPreview, setShowModularPreview] = useState(false);

  // --- Span-level state ---
  const [spanHighlights, setSpanHighlights] = useState(null);
  const [spanPredFiles, setSpanPredFiles] = useState([]);
  const [selectedSpanPredFile, setSelectedSpanPredFile] = useState('');
  const [detectingSpans, setDetectingSpans] = useState(false);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [showSpanConfirm, setShowSpanConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const timerRef = useRef(null);

  useEffect(() => {
    fetchConversations().then(setConversations);
    fetchConfig()
      .then((cfg) => {
        setEndToEnd(cfg.end_to_end);
        if (cfg.default_threshold) setThreshold(cfg.default_threshold);
        setConfigLoaded(true);
      })
      .catch(() => setConfigLoaded(true));

    fetchDefaultPrompt().then((data) => setPromptTemplate(data.prompt_template));
    fetchPromptComponents()
      .then((data) => {
        setHighlightDefinition(data.highlight_definition || '');
        setConversationContext(data.conversation_context || '');
        setThemeConditioning(data.theme_conditioning || '');
      })
      .catch(() => {});
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

  // ----------------------------------------------------------------
  // Common handlers
  // ----------------------------------------------------------------

  const handleConversationChange = useCallback(async (convId) => {
    setSelectedConv(convId);
    setScores(null);
    setSelectedPredFile('');
    setPredictionFiles([]);
    setTranscript(null);
    setSpanHighlights(null);
    setSpanPredFiles([]);
    setSelectedSpanPredFile('');
    setViewMode('heatmap');
    setError(null);
    setSaveMessage(null);

    if (!convId) return;

    setLoading(true);
    try {
      const [transcriptData, files, spanFiles] = await Promise.all([
        fetchTranscript(convId),
        fetchPredictionFiles(convId),
        fetchSpanPredictionFiles(convId),
      ]);
      setTranscript(transcriptData);
      setPredictionFiles(files);
      setSpanPredFiles(spanFiles);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ----------------------------------------------------------------
  // Two-step mode handlers
  // ----------------------------------------------------------------

  const handlePredictionFileChange = useCallback(
    async (filename) => {
      setSelectedPredFile(filename);
      setSpanHighlights(null);
      setSelectedSpanPredFile('');
      setViewMode('heatmap');
      setError(null);
      setSaveMessage(null);
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

  const handleDetectSpans = useCallback(async () => {
    if (!selectedConv || !selectedPredFile) return;
    setShowSpanConfirm(false);
    setError(null);
    setSaveMessage(null);
    setDetectingSpans(true);
    startTimer();
    try {
      const data = await runDetectSpans(selectedConv, selectedPredFile, threshold);
      setSpanHighlights(data.highlights);
      setSelectedSpanPredFile(data.filename);
      setViewMode('final');
      const spanFiles = await fetchSpanPredictionFiles(selectedConv);
      setSpanPredFiles(spanFiles);
    } catch (e) {
      setError(e.message);
    } finally {
      stopTimer();
      setDetectingSpans(false);
    }
  }, [selectedConv, selectedPredFile, threshold, startTimer, stopTimer]);

  const handleSpanPredFileChange = useCallback(
    async (filename) => {
      setSelectedSpanPredFile(filename);
      setError(null);
      setSaveMessage(null);
      if (!filename || !selectedConv) {
        setSpanHighlights(null);
        setViewMode('heatmap');
        return;
      }
      setLoading(true);
      try {
        const data = await fetchSpanPrediction(selectedConv, filename);
        setSpanHighlights(data.highlights);
        setViewMode('final');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedConv]
  );

  // ----------------------------------------------------------------
  // End-to-end mode handlers
  // ----------------------------------------------------------------

  const handleModularPreview = useCallback(async () => {
    if (!selectedConv) return;
    setError(null);
    setLoading(true);
    try {
      const data = await previewModularPrompt(selectedConv, {
        highlight_definition: highlightDefinition,
        conversation_context: conversationContext,
        theme_conditioning: themeConditioning,
      });
      setPreviewText(data.preview_prompt);
      setPreviewMeta(data);
      setShowModularPreview(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedConv, highlightDefinition, conversationContext, themeConditioning]);

  const handleRunE2E = useCallback(async () => {
    if (!selectedConv) return;
    setShowE2EConfirm(false);
    setError(null);
    setSaveMessage(null);
    setDetecting(true);
    startTimer();
    try {
      const data = await runEndToEndPipeline(selectedConv, {
        highlight_definition: highlightDefinition,
        conversation_context: conversationContext,
        theme_conditioning: themeConditioning,
      });
      setScores(data.scores);
      setSpanHighlights(data.highlights);
      if (data.highlights && data.highlights.length > 0) {
        setViewMode('final');
      }
      const [files, spanFiles] = await Promise.all([
        fetchPredictionFiles(selectedConv),
        fetchSpanPredictionFiles(selectedConv),
      ]);
      setPredictionFiles(files);
      setSpanPredFiles(spanFiles);
      if (data.snippet_scores_file) setSelectedPredFile(data.snippet_scores_file);
      if (data.span_predictions_file) setSelectedSpanPredFile(data.span_predictions_file);
    } catch (e) {
      setError(e.message);
    } finally {
      stopTimer();
      setDetecting(false);
    }
  }, [selectedConv, highlightDefinition, conversationContext, themeConditioning, startTimer, stopTimer]);

  // ----------------------------------------------------------------
  // Span-level highlight handlers (shared)
  // ----------------------------------------------------------------

  const handleHighlightAction = useCallback((highlightId, action) => {
    setSpanHighlights((prev) =>
      prev.map((hl) => {
        if (hl.id !== highlightId) return hl;
        if (action === 'accept') return { ...hl, status: 'accepted' };
        if (action === 'reject') return { ...hl, status: 'rejected' };
        if (action === 'undo') return { ...hl, status: 'pending' };
        return hl;
      })
    );
  }, []);

  const handleAcceptAll = useCallback(() => {
    setSpanHighlights((prev) =>
      prev.map((hl) =>
        hl.status === 'pending' ? { ...hl, status: 'accepted' } : hl
      )
    );
  }, []);

  const handleHighlightUpdate = useCallback((highlightId, newSpansOrUpdater) => {
    setSpanHighlights((prev) =>
      prev.map((hl) => {
        if (hl.id !== highlightId) return hl;
        const newSpans =
          typeof newSpansOrUpdater === 'function'
            ? newSpansOrUpdater(hl.spans)
            : newSpansOrUpdater;
        const fullText = newSpans.map((s) => s.text).join(' ');
        return { ...hl, spans: newSpans, full_text: fullText };
      })
    );
  }, []);

  const handleAddHighlight = useCallback((newHighlight) => {
    setSpanHighlights((prev) => [...(prev || []), newHighlight]);
    setAddingHighlight(false);
  }, []);

  const handleDeleteHighlight = useCallback((highlightId) => {
    setSpanHighlights((prev) => prev.filter((hl) => hl.id !== highlightId));
  }, []);

  const handleCompleteHighlighting = useCallback(async () => {
    if (!selectedConv || !spanHighlights || !transcript) return;
    setError(null);
    setSaving(true);

    const accepted = spanHighlights
      .filter((hl) => hl.status === 'accepted')
      .map((hl) => ({
        ...hl,
        snippets: hl.spans.map((span) => {
          const snip = transcript.original_snippets[span.snippet_index];
          return {
            original_snippet_index: span.snippet_index,
            speaker_id: snip.speaker_id,
            speaker_name: snip.speaker_name,
            transcript: snip.transcript,
            char_start: span.char_start,
            char_end: span.char_end,
            highlighted_text: span.text,
          };
        }),
      }));

    try {
      const data = await saveHighlights(selectedConv, accepted);
      setSaveMessage(`Saved ${accepted.length} highlight(s) to ${data.filename}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [selectedConv, spanHighlights, transcript]);

  // ----------------------------------------------------------------
  // Derived state
  // ----------------------------------------------------------------

  const formatElapsed = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const hasScores = scores !== null;
  const hasSpanHighlights = spanHighlights !== null && spanHighlights.length > 0;
  const isDetectingAny = detecting || detectingSpans;

  const allDecided = hasSpanHighlights && spanHighlights.every(
    (hl) => hl.status === 'accepted' || hl.status === 'rejected'
  );
  const hasPending = hasSpanHighlights && spanHighlights.some(
    (hl) => hl.status === 'pending'
  );

  const aboveThresholdCount = scores
    ? scores.filter((s) => s.score >= threshold).length
    : 0;

  if (!configLoaded) return null;

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------

  return (
    <div className="app">
      <header className="app-header">
        <h1>Conversation Highlight Tool</h1>
      </header>

      {error && (
        <div className="error-banner">
          <span className="error-message">{error}</span>
          <button className="error-dismiss" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="app-body">
        {/* ---- Left sidebar ---- */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <ConversationSelector
              conversations={conversations}
              selected={selectedConv}
              onChange={handleConversationChange}
            />
          </div>

          {endToEnd ? (
            /* ========== END-TO-END SIDEBAR ========== */
            <>
              {(hasScores || hasSpanHighlights) && (
                <div className="sidebar-section">
                  <div className="mode-toggle-group">
                    <label>View Mode</label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className={`mode-toggle-btn ${viewMode === 'heatmap' ? 'active' : ''}`}
                        onClick={() => setViewMode('heatmap')}
                        disabled={!hasScores}
                        style={{ flex: 1 }}
                      >
                        Heat Map
                      </button>
                      <button
                        className={`mode-toggle-btn ${viewMode === 'final' ? 'active' : ''}`}
                        onClick={() => setViewMode('final')}
                        disabled={!hasSpanHighlights}
                        style={{ flex: 1 }}
                      >
                        Span-Level
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {hasSpanHighlights && viewMode === 'final' && (
                <>
                  <div className="sidebar-divider" />
                  <div className="sidebar-section">
                    <HighlightSpanEditor highlights={spanHighlights} />
                  </div>

                  <div className="sidebar-section sidebar-actions">
                    <button
                      className={`btn btn-full ${addingHighlight ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setAddingHighlight(!addingHighlight)}
                    >
                      {addingHighlight ? 'Cancel Adding' : 'Add New Highlight'}
                    </button>

                    {hasPending && (
                      <button
                        className="btn btn-secondary btn-full"
                        onClick={handleAcceptAll}
                      >
                        Accept All
                      </button>
                    )}
                  </div>

                  <div className="sidebar-divider" />
                  <div className="sidebar-section">
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleCompleteHighlighting}
                      disabled={!allDecided || saving}
                      title={
                        allDecided
                          ? 'Save all accepted highlights'
                          : 'Accept or reject all highlights first'
                      }
                    >
                      Save Highlights
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            /* ========== TWO-STEP SIDEBAR ========== */
            <>
              <div className="sidebar-section">
                <PredictionsFileSelector
                  files={predictionFiles}
                  selected={selectedPredFile}
                  onChange={handlePredictionFileChange}
                  disabled={!selectedConv}
                />
              </div>

              <div className="sidebar-section">
                <ThresholdControls
                  threshold={threshold}
                  onChange={setThreshold}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  spanHighlightsAvailable={hasSpanHighlights}
                />
              </div>

              <div className="sidebar-divider" />

              {spanPredFiles.length > 0 && (
                <div className="sidebar-section">
                  <div className="control-group">
                    <label>Span-Level Predictions</label>
                    <select
                      value={selectedSpanPredFile}
                      onChange={(e) => handleSpanPredFileChange(e.target.value)}
                      disabled={!selectedConv || isDetectingAny}
                    >
                      <option value="">-- Select span predictions --</option>
                      {spanPredFiles.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="sidebar-section sidebar-actions">
                <button
                  className="btn btn-primary btn-full"
                  onClick={() => setShowSpanConfirm(true)}
                  disabled={!hasScores || !selectedPredFile || isDetectingAny}
                  title={
                    !hasScores
                      ? 'Load snippet-level predictions first'
                      : 'Run second-pass LLM to get precise highlight spans'
                  }
                >
                  Get Span-Level Highlights
                </button>

                {hasSpanHighlights && viewMode === 'final' && (
                  <>
                    <button
                      className={`btn btn-full ${addingHighlight ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setAddingHighlight(!addingHighlight)}
                    >
                      {addingHighlight ? 'Cancel Adding' : 'Add New Highlight'}
                    </button>

                    {hasPending && (
                      <button
                        className="btn btn-secondary btn-full"
                        onClick={handleAcceptAll}
                      >
                        Accept All
                      </button>
                    )}
                  </>
                )}
              </div>

              {hasSpanHighlights && viewMode === 'final' && (
                <>
                  <div className="sidebar-divider" />
                  <div className="sidebar-section">
                    <HighlightSpanEditor highlights={spanHighlights} />
                  </div>
                  <div className="sidebar-section">
                    <button
                      className="btn btn-primary btn-full"
                      onClick={handleCompleteHighlighting}
                      disabled={!allDecided || saving}
                      title={
                        allDecided
                          ? 'Save all accepted highlights'
                          : 'Accept or reject all highlights first'
                      }
                    >
                      Complete Highlighting
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </aside>

        {/* ---- Main content ---- */}
        <main className="main-content">
          <div className="prompt-panel">
            {endToEnd ? (
              <ModularPromptEditor
                highlightDefinition={highlightDefinition}
                conversationContext={conversationContext}
                themeConditioning={themeConditioning}
                onHighlightDefinitionChange={setHighlightDefinition}
                onConversationContextChange={setConversationContext}
                onThemeConditioningChange={setThemeConditioning}
                onPreview={handleModularPreview}
                onRun={() => setShowE2EConfirm(true)}
                disabled={!selectedConv || loading || isDetectingAny}
                detecting={detecting}
              />
            ) : (
              <PromptEditor
                value={promptTemplate}
                onChange={setPromptTemplate}
                onRun={handlePreviewPrompt}
                disabled={!selectedConv || loading || isDetectingAny}
                detecting={detecting}
              />
            )}
          </div>

          {loading && !isDetectingAny && (
            <div className="loading-indicator">Loading...</div>
          )}

          {transcript && (
            <TranscriptViewer
              snippets={transcript.original_snippets}
              scores={scores}
              threshold={threshold}
              viewMode={viewMode}
              spanHighlights={spanHighlights}
              addingHighlight={addingHighlight}
              onHighlightAction={handleHighlightAction}
              onHighlightUpdate={handleHighlightUpdate}
              onAddHighlight={handleAddHighlight}
              onDeleteHighlight={handleDeleteHighlight}
            />
          )}
        </main>
      </div>

      {/* ---- Modals & overlays ---- */}

      {showPreview && (
        <PreviewModal
          previewText={previewText}
          meta={previewMeta}
          onConfirm={handleDetectHighlights}
          onCancel={() => setShowPreview(false)}
          detecting={detecting}
        />
      )}

      {showModularPreview && (
        <PreviewModal
          previewText={previewText}
          meta={previewMeta}
          onConfirm={() => {
            setShowModularPreview(false);
            setShowE2EConfirm(true);
          }}
          onCancel={() => setShowModularPreview(false)}
          detecting={detecting}
          confirmLabel="Proceed to Run"
        />
      )}

      {showE2EConfirm && (
        <div className="modal-overlay" onClick={() => setShowE2EConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Run AI-Generated Highlighting</h2>
            </div>
            <div className="modal-body">
              <p>
                This will trigger an LLM API call to score all snippets in the
                conversation and then extract precise highlight boundaries.
              </p>
              <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                Approximate time: 4-8 minutes. This will incur API usage costs.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowE2EConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleRunE2E}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showSpanConfirm && (
        <div className="modal-overlay" onClick={() => setShowSpanConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Span-Level Detection</h2>
            </div>
            <div className="modal-body">
              <p>
                This will send <strong>{aboveThresholdCount} snippets</strong> (above
                threshold {threshold}) to the OpenAI API for precise highlight boundary
                extraction.
              </p>
              <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                This may take 1-3 minutes and will incur API usage costs.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSpanConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleDetectSpans}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isDetectingAny && (
        <div className="detecting-overlay">
          <div className="detecting-card">
            <div className="detecting-spinner" />
            <div className="detecting-text">
              {endToEnd && detecting
                ? 'Running end-to-end highlight detection...'
                : detectingSpans
                  ? 'Running span-level highlight detection...'
                  : 'Running highlight detection...'}
            </div>
            <div className="detecting-elapsed">
              Elapsed: {formatElapsed(detectElapsed)}
            </div>
            <div className="detecting-subtext">
              {endToEnd && detecting
                ? 'This can take 4-8 minutes depending on transcript length.'
                : 'This can take 1-3 minutes depending on transcript length.'}
            </div>
          </div>
        </div>
      )}

      {(saving || saveMessage) && (
        <div className="detecting-overlay">
          <div className="detecting-card">
            {saving ? (
              <>
                <div className="detecting-spinner" />
                <div className="detecting-text">Saving highlights...</div>
                <div className="detecting-subtext">
                  Writing accepted highlights to file.
                </div>
              </>
            ) : (
              <>
                <div className="save-success-icon">&#10003;</div>
                <div className="detecting-text save-success-text">{saveMessage}</div>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 20 }}
                  onClick={() => setSaveMessage(null)}
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
