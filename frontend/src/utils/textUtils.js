export function snapToWordBoundary(text, charIdx, direction) {
  if (charIdx <= 0) return 0;
  if (charIdx >= text.length) return text.length;
  if (direction === 'start') {
    let i = charIdx;
    while (i > 0 && text[i - 1] !== ' ') i--;
    return i;
  }
  let i = charIdx;
  while (i < text.length && text[i] !== ' ') i++;
  return i;
}

/**
 * Given a DOM mouse event and a container element with text nodes,
 * return the character offset within the container's concatenated text.
 * Returns -1 if the position cannot be resolved.
 */
export function charOffsetFromPoint(clientX, clientY, containerEl) {
  const range = document.caretRangeFromPoint(clientX, clientY);
  if (!range) return -1;
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) return -1;
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null, false);
  let offset = 0;
  let node;
  while ((node = walker.nextNode())) {
    if (node === textNode) {
      return offset + range.startOffset;
    }
    offset += node.textContent.length;
  }
  return -1;
}
