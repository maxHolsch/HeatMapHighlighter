const BASE = '/api';

async function request(url, options) {
  const res = await fetch(url, options);
  const body = await res.json();
  if (!res.ok) {
    const message = body?.error || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body;
}

export async function fetchConversations() {
  return request(`${BASE}/conversations`);
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

export async function saveHighlights(conversationId, highlights) {
  return request(
    `${BASE}/conversations/${conversationId}/highlights/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlights }),
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
