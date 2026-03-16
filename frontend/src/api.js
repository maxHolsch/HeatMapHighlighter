const BASE = '/api';

export async function fetchConversations() {
  const res = await fetch(`${BASE}/conversations`);
  return res.json();
}

export async function fetchTranscript(conversationId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/transcript`);
  return res.json();
}

export async function fetchPredictionFiles(conversationId) {
  const res = await fetch(`${BASE}/conversations/${conversationId}/predictions`);
  return res.json();
}

export async function fetchPrediction(conversationId, filename) {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/predictions/${filename}`
  );
  return res.json();
}

export async function fetchPreviewPrompt(conversationId, promptTemplate) {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/preview-prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_template: promptTemplate }),
    }
  );
  return res.json();
}

export async function runDetectHighlights(conversationId, promptTemplate) {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/detect-highlights`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_template: promptTemplate }),
    }
  );
  return res.json();
}

export async function saveHighlights(conversationId, highlights) {
  const res = await fetch(
    `${BASE}/conversations/${conversationId}/highlights/save`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ highlights }),
    }
  );
  return res.json();
}

export async function fetchDefaultPrompt() {
  const res = await fetch(`${BASE}/default-prompt`);
  return res.json();
}
