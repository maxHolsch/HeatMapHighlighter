import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  registerCorticoConversation,
  fetchAnthologies,
  createAnthology,
  fetchAnthology,
  addClip,
} from './api';

export default function App() {
  const [searchParams] = useSearchParams();
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

  // Metadata tracking refs (end-to-end mode only)
  const originalSpansRef = useRef({});
  const rejectedIdsRef = useRef(new Set());
  const pipelineDurationRef = useRef(null);
  const editSessionStartRef = useRef(null);

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
        // If the user arrived with a ?topic=... pre-fill, use it; else default.
        const topicParam = searchParams.get('topic');
        setThemeConditioning(topicParam && topicParam.trim() ? topicParam : (data.theme_conditioning || ''));
      })
      .catch(() => {});
  }, [searchParams]);

  // Auto-select a conversation from the URL (?conv=...) once the
  // conversation list has loaded. Runs once per (conv param, list) change.
  useEffect(() => {
    const convParam = searchParams.get('conv');
    if (!convParam || conversations.length === 0 || selectedConv) return;
    if (conversations.includes(convParam)) {
      handleConversationChange(convParam);
    }
    // handleConversationChange is stable (useCallback with empty deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, searchParams]);

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

    originalSpansRef.current = {};
    rejectedIdsRef.current = new Set();
    pipelineDurationRef.current = null;
    editSessionStartRef.current = null;

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

        if (endToEnd && data.highlights && data.highlights.length > 0) {
          const origMap = {};
          for (const hl of data.highlights) {
            origMap[hl.id] = JSON.parse(JSON.stringify(hl.spans));
          }
          originalSpansRef.current = origMap;
          editSessionStartRef.current = Date.now();
          pipelineDurationRef.current = null;
        }

        if (data.source_predictions_file) {
          try {
            const predData = await fetchPrediction(selectedConv, data.source_predictions_file);
            setScores(predData.scores);
            setSelectedPredFile(data.source_predictions_file);
          } catch {
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [selectedConv, endToEnd]
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
    const pipelineStart = Date.now();
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

        const origMap = {};
        for (const hl of data.highlights) {
          origMap[hl.id] = JSON.parse(JSON.stringify(hl.spans));
        }
        originalSpansRef.current = origMap;
        pipelineDurationRef.current = Date.now() - pipelineStart;
        editSessionStartRef.current = Date.now();
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
    if (endToEnd && !highlightId.startsWith('hl_user_')) {
      if (action === 'reject') rejectedIdsRef.current.add(highlightId);
      if (action === 'undo') rejectedIdsRef.current.delete(highlightId);
    }
  }, [endToEnd]);

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
    if (endToEnd && !highlightId.startsWith('hl_user_')) {
      rejectedIdsRef.current.add(highlightId);
    }
  }, [endToEnd]);

  const [liftingToAnth, setLiftingToAnth] = useState(false);
  const [liftAnthMessage, setLiftAnthMessage] = useState('');

  const handleLiftAcceptedToAnthology = useCallback(async () => {
    if (!selectedConv || !spanHighlights || !transcript) return;
    setLiftingToAnth(true);
    setLiftAnthMessage('');
    try {
      // Ensure the Cortico conversation is registered in the DB.
      const reg = await registerCorticoConversation(selectedConv);
      const convId = reg.conversation_id;

      // Find or create an anthology matching this conversation.
      const list = await fetchAnthologies();
      const targetName = `${selectedConv} highlights`;
      let anth = list.find((a) => a.name === targetName);
      if (!anth) {
        const r = await createAnthology(targetName);
        anth = await fetchAnthology(r.id);
      } else {
        anth = await fetchAnthology(anth.id);
      }
      const sectionId = anth.sections[0]?.id;
      if (!sectionId) throw new Error('Anthology has no section');

      // For each accepted span, derive (start_sec, end_sec) from its snippets.
      const accepted = spanHighlights.filter((hl) => hl.status === 'accepted');
      let count = 0;
      for (const hl of accepted) {
        if (!hl.spans || hl.spans.length === 0) continue;
        const firstSnippet = transcript.original_snippets[hl.spans[0].snippet_index];
        const lastSnippet = transcript.original_snippets[hl.spans[hl.spans.length - 1].snippet_index];
        if (!firstSnippet || !lastSnippet) continue;
        await addClip({
          section_id: sectionId,
          conversation_id: convId,
          start_sec: firstSnippet.audio_start_offset || 0,
          end_sec: lastSnippet.audio_end_offset || 0,
          curator_note: hl.reasoning || '',
          source: 'pass2_span',
          source_ref: hl.id,
          tags: [],
        });
        count++;
      }
      setLiftAnthMessage(`Lifted ${count} clip(s) to "${anth.name}"`);
    } catch (e) {
      setLiftAnthMessage(`(error: ${e.message})`);
    } finally {
      setLiftingToAnth(false);
    }
  }, [selectedConv, spanHighlights, transcript]);

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

    let metadata = null;
    if (endToEnd) {
      let numBoundaryAdjusted = 0;
      let numUserCreated = 0;
      for (const hl of accepted) {
        if (hl.id.startsWith('hl_user_')) {
          numUserCreated++;
          continue;
        }
        const orig = originalSpansRef.current[hl.id];
        if (!orig) continue;
        const changed =
          orig.length !== hl.spans.length ||
          orig.some(
            (os, i) =>
              os.snippet_index !== hl.spans[i].snippet_index ||
              os.char_start !== hl.spans[i].char_start ||
              os.char_end !== hl.spans[i].char_end
          );
        if (changed) numBoundaryAdjusted++;
      }

      metadata = {
        num_rejected: rejectedIdsRef.current.size,
        num_user_created: numUserCreated,
        num_boundary_adjusted: numBoundaryAdjusted,
        pipeline_duration_seconds:
          pipelineDurationRef.current != null
            ? Math.round(pipelineDurationRef.current / 1000)
            : null,
        editing_session_duration_seconds:
          editSessionStartRef.current != null
            ? Math.round((Date.now() - editSessionStartRef.current) / 1000)
            : null,
      };
    }

    try {
      const data = await saveHighlights(selectedConv, accepted, metadata);
      setSaveMessage(`Saved ${accepted.length} highlight(s) to ${data.filename}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }, [selectedConv, spanHighlights, transcript, endToEnd]);

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
              {spanPredFiles.length > 0 && (
                <div className="sidebar-section">
                  <div className="control-group">
                    <label>Cached Highlights</label>
                    <select
                      value={selectedSpanPredFile}
                      onChange={(e) => handleSpanPredFileChange(e.target.value)}
                      disabled={!selectedConv || isDetectingAny}
                    >
                      <option value="">-- Load from cache --</option>
                      {spanPredFiles.map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

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

                    {/* {hasPending && (
                      <button
                        className="btn btn-secondary btn-full"
                        onClick={handleAcceptAll}
                      >
                        Accept All
                      </button>
                    )} */}
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
                    <button
                      className="btn btn-secondary btn-full"
                      style={{ marginTop: 8 }}
                      onClick={handleLiftAcceptedToAnthology}
                      disabled={liftingToAnth || !spanHighlights?.some((h) => h.status === 'accepted')}
                      title="Add all accepted spans as clips in an anthology"
                    >
                      {liftingToAnth ? 'Lifting…' : 'Lift accepted to anthology'}
                    </button>
                    {liftAnthMessage && (
                      <div style={{ marginTop: 6, color: '#2a7a2a', fontSize: '0.85rem' }}>
                        {liftAnthMessage}
                      </div>
                    )}
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
                    <button
                      className="btn btn-secondary btn-full"
                      style={{ marginTop: 8 }}
                      onClick={handleLiftAcceptedToAnthology}
                      disabled={liftingToAnth || !spanHighlights?.some((h) => h.status === 'accepted')}
                      title="Add all accepted spans as clips in an anthology"
                    >
                      {liftingToAnth ? 'Lifting…' : 'Lift accepted to anthology'}
                    </button>
                    {liftAnthMessage && (
                      <div style={{ marginTop: 6, color: '#2a7a2a', fontSize: '0.85rem' }}>
                        {liftAnthMessage}
                      </div>
                    )}
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
          confirmLabel="Get AI-Generated Highlights"
        />
      )}

      {showE2EConfirm && (
        <div className="modal-overlay" onClick={() => setShowE2EConfirm(false)}>
          <div className="modal-content modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Run AI Highlighting</h2>
            </div>
            <div className="modal-body">
              <p>
                This will trigger an Anthropic API call to run highlight detection using an LLM.
              </p>
              <p style={{ marginTop: 12, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                It may take between 4-8 minutes to run depending on the length of the conversation and the number of detected highlights, and will incur API usage costs.
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
                threshold {threshold}) to the Anthropic API for precise highlight boundary
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
