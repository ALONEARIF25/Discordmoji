/**
 * Utility to get the caret position coordinates in various input elements
 * Supports: <input>, <textarea>, and contenteditable elements
 */

/**
 * Get the caret position in pixels relative to viewport
 * @param {HTMLElement} element - The input element
 * @returns {{x: number, y: number, height: number} | null} Caret coordinates and height
 */
function getCaretPosition(element) {
  if (!element) return null;

  // Handle contenteditable elements
  if (element.contentEditable === "true") {
    return getCaretPositionContentEditable(element);
  }

  // Handle input and textarea elements
  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    return getCaretPositionInputTextarea(element);
  }

  return null;
}

/**
 * Get caret position for input and textarea elements
 * Uses a hidden clone div to measure position
 */
function getCaretPositionInputTextarea(element) {
  const { selectionStart } = element;

  // Create a mirror div with the same styles
  const mirror = document.createElement("div");
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  // Copy all relevant CSS properties
  mirror.style.cssText = `
    position: absolute;
    visibility: hidden;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
  `;

  // Copy computed styles
  const propertiesToCopy = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "fontStyle",
    "letterSpacing",
    "textTransform",
    "wordSpacing",
    "textIndent",
    "whiteSpace",
    "lineHeight",
    "padding",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "border",
    "borderWidth",
    "boxSizing",
  ];

  propertiesToCopy.forEach((prop) => {
    mirror.style[prop] = computed[prop];
  });

  // Set fixed width to match the element
  mirror.style.width = `${element.clientWidth}px`;

  // Get text up to caret position
  const textBeforeCaret = element.value.substring(0, selectionStart);

  // Create text nodes
  mirror.textContent = textBeforeCaret;

  // Add a span to measure the caret position
  const caretSpan = document.createElement("span");
  caretSpan.textContent = "|";
  mirror.appendChild(caretSpan);

  document.body.appendChild(mirror);

  // Get the span's position
  const spanRect = caretSpan.getBoundingClientRect();
  const mirrorRect = mirror.getBoundingClientRect();

  // Calculate position relative to viewport
  const x = rect.left + (spanRect.left - mirrorRect.left) - element.scrollLeft;
  const y = rect.top + (spanRect.top - mirrorRect.top) - element.scrollTop;
  const height = spanRect.height || parseInt(computed.fontSize);

  // Cleanup
  document.body.removeChild(mirror);

  return { x, y, height };
}

/**
 * Get caret position for contenteditable elements
 * Uses the native Selection and Range APIs
 */
function getCaretPositionContentEditable(element) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    // Caret is at the start or in an empty element
    // Create a temporary span to get position
    const tempSpan = document.createElement("span");
    tempSpan.textContent = "|";
    range.insertNode(tempSpan);
    const tempRect = tempSpan.getBoundingClientRect();
    tempSpan.remove();

    return {
      x: tempRect.left,
      y: tempRect.top,
      height: tempRect.height || 16,
    };
  }

  return {
    x: rect.left,
    y: rect.top,
    height: rect.height || 16,
  };
}

/**
 * Check if element supports text input
 * @param {HTMLElement} element
 * @returns {boolean}
 */
function isTextInputElement(element) {
  if (!element) return false;

  if (element.contentEditable === "true") {
    return true;
  }

  if (element.tagName === "TEXTAREA") {
    return true;
  }

  if (element.tagName === "INPUT") {
    const type = element.type?.toLowerCase();
    const validTypes = ["text", "search", "email", "url", "tel", "password"];
    return !type || validTypes.includes(type);
  }

  return false;
}
