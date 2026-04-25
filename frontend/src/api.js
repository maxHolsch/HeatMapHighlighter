const BASE = '/api';

async function request(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    const message = body?.detail || body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

// ---- Corpus / heatmap ----

export async function fetchCorpora() {
  return request(`${BASE}/corpora`);
}

export async function fetchCorpusConversations(corpusId) {
  return request(`${BASE}/corpora/${corpusId}/conversations`);
}

export async function fetchCorpusSnippets(corpusId) {
  return request(`${BASE}/corpora/${corpusId}/snippets`);
}

export async function fetchCorpusValence(corpusId) {
  return request(`${BASE}/corpora/${corpusId}/valence`);
}

export async function runCorpusQuery(corpusId, payload) {
  return request(`${BASE}/corpora/${corpusId}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function runCorpusSimilar(corpusId, snippetIds) {
  return request(`${BASE}/corpora/${corpusId}/similar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ snippet_ids: snippetIds }),
  });
}

export async function fetchSnippetDetail(snippetId) {
  return request(`${BASE}/snippets/${snippetId}`);
}

export async function explainSnippet(snippetId, payload) {
  return request(`${BASE}/snippets/${snippetId}/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function audioUrl(conversationId, start, end) {
  const params = new URLSearchParams();
  if (start != null) params.set('start', start);
  if (end != null) params.set('end', end);
  const q = params.toString();
  return `${BASE}/conversations/${conversationId}/audio${q ? `?${q}` : ''}`;
}

// ---- Anthology ----

export async function fetchAnthologies() {
  return request(`${BASE}/anthologies`);
}

export async function createAnthology(name, preface = '') {
  return request(`${BASE}/anthologies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, preface }),
  });
}

export async function fetchAnthology(id) {
  return request(`${BASE}/anthologies/${id}`);
}

export async function updateAnthology(id, patch) {
  return request(`${BASE}/anthologies/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function upsertSection(anthId, payload) {
  return request(`${BASE}/anthologies/${anthId}/sections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteSection(sectionId) {
  return request(`${BASE}/sections/${sectionId}`, { method: 'DELETE' });
}

export async function addClip(payload) {
  return request(`${BASE}/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateClip(clipId, patch) {
  return request(`${BASE}/clips/${clipId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export async function deleteClip(clipId) {
  return request(`${BASE}/clips/${clipId}`, { method: 'DELETE' });
}

export async function reorderClips(sectionId, clipIds) {
  return request(`${BASE}/sections/${sectionId}/reorder-clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clip_ids: clipIds }),
  });
}

export function anthologyExportUrl(anthId, format = 'both', embed = false) {
  const params = new URLSearchParams({ format });
  if (embed) params.set('embed', 'true');
  return `${BASE}/anthologies/${anthId}/export?${params.toString()}`;
}

export async function fetchKaraokeManifest(anthId) {
  return request(`${BASE}/anthologies/${anthId}/karaoke`);
}

export async function fetchTranscript(conversationId) {
  return request(`${BASE}/conversations/${conversationId}/transcript`);
}

export async function fetchPredictionFiles(conversationId) {
  return request(`${BASE}/conversations/${conversationId}/predictions`);
}

export async function fetchPrediction(conversationId, filename) {
  return request(
    `${BASE}/conversations/${conversationId}/predictions/${filename}`
  );
}

export async function fetchPreviewPrompt(conversationId, promptTemplate) {
  return request(
    `${BASE}/conversations/${conversationId}/preview-prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_template: promptTemplate }),
    }
  );
}

export async function runDetectHighlights(conversationId, promptTemplate) {
  return request(
    `${BASE}/conversations/${conversationId}/detect-highlights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_template: promptTemplate }),
    }
  );
}

export async function saveHighlights(conversationId, highlights, metadata = null) {
  return request(
    `${BASE}/conversations/${conversationId}/highlights/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlights, metadata }),
    }
  );
}

export async function fetchDefaultPrompt() {
  return request(`${BASE}/default-prompt`);
}

export async function runDetectSpans(conversationId, predictionsFile, threshold) {
  return request(
    `${BASE}/conversations/${conversationId}/detect-spans`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        predictions_file: predictionsFile,
        threshold,
      }),
    }
  );
}

export async function fetchSpanPredictionFiles(conversationId) {
  return request(
    `${BASE}/conversations/${conversationId}/span-predictions`
  );
}

export async function fetchSpanPrediction(conversationId, filename) {
  return request(
    `${BASE}/conversations/${conversationId}/span-predictions/${filename}`
  );
}

export async function fetchConfig() {
  return request(`${BASE}/config`);
}

export async function fetchPricing() {
  return request(`${BASE}/pricing`);
}

export async function estimateRunCost(conversationId, components) {
  return request(
    `${BASE}/conversations/${conversationId}/cost-estimate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(components),
    }
  );
}

export async function fetchPromptComponents() {
  return request(`${BASE}/prompt-components`);
}

export async function previewModularPrompt(conversationId, components) {
  return request(
    `${BASE}/conversations/${conversationId}/preview-prompt-modular`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(components),
    }
  );
}

export async function runEndToEndPipeline(conversationId, components) {
  return request(
    `${BASE}/conversations/${conversationId}/detect-highlights-e2e`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(components),
    }
  );
}
