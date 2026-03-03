/**
 * Main controller for Discordmoji extension
 * Handles event listeners, emoji detection, and insertion
 */

// Active element tracking
let activeElement = null;
let emojiTriggerPosition = -1;
let scrollListener = null;
let debounceTimer = null;
let isInsertingEmoji = false; // Flag to prevent input handler interference
let lastInsertedEmoji = null; // Track last insertion to prevent duplicates
let lastInsertionTime = 0; // Timestamp of last insertion

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 150;

/**
 * Initialize the extension
 */
function initialize() {
  // Listen for focus events on the document
  document.addEventListener("focusin", handleFocusIn, true);
  document.addEventListener("focusout", handleFocusOut, true);

  // Listen for clicks to close dropdown
  document.addEventListener("click", handleDocumentClick, true);
}

/**
 * Handle element focus
 */
function handleFocusIn(event) {
  const element = event.target;

  if (isTextInputElement(element)) {
    attachToElement(element);
  }
}

/**
 * Handle element blur
 */
function handleFocusOut(event) {
  const element = event.target;

  if (element === activeElement) {
    // Delay cleanup to allow click events to fire
    setTimeout(() => {
      if (document.activeElement !== activeElement) {
        detachFromElement();
      }
    }, 200);
  }
}

/**
 * Handle document click to close dropdown
 */
function handleDocumentClick(event) {
  if (!isDropdownVisible()) return;

  // Don't close if clicking inside dropdown
  if (event.target.closest("#discordmoji-dropdown")) {
    return;
  }

  hideDropdown();
  resetTrigger();
}

/**
 * Attach event listeners to an input element
 */
function attachToElement(element) {
  // Detach from previous element if any
  if (activeElement && activeElement !== element) {
    detachFromElement();
  }

  activeElement = element;

  // Add input listener
  element.addEventListener("input", handleInput);
  // Use capture mode to ensure we intercept keydown before site handlers (e.g., Instagram)
  element.addEventListener("keydown", handleKeyDown, true);

  // ALSO add to document level as backup (capture mode to intercept early)
  if (!document._discordmojiKeydownAttached) {
    document.addEventListener("keydown", handleKeyDown, true);
    document._discordmojiKeydownAttached = true;
  }

  // Add scroll listener for repositioning
  setupScrollListener();
}

/**
 * Detach event listeners from the active element
 */
function detachFromElement() {
  if (!activeElement) return;

  activeElement.removeEventListener("input", handleInput);
  // Must match the capture mode used in addEventListener
  activeElement.removeEventListener("keydown", handleKeyDown, true);

  removeScrollListener();
  hideDropdown();
  resetTrigger();

  activeElement = null;
}

/**
 * Setup scroll listener for repositioning dropdown
 */
function setupScrollListener() {
  removeScrollListener();

  scrollListener = debounce(() => {
    if (isDropdownVisible() && activeElement) {
      updateDropdownPosition();
    }
  }, 50);

  window.addEventListener("scroll", scrollListener, true);
  window.addEventListener("resize", scrollListener);
}

/**
 * Remove scroll listener
 */
function removeScrollListener() {
  if (scrollListener) {
    window.removeEventListener("scroll", scrollListener, true);
    window.removeEventListener("resize", scrollListener);
    scrollListener = null;
  }
}

/**
 * Handle input events
 */
function handleInput(event) {
  // Skip processing if we're currently inserting an emoji
  if (isInsertingEmoji) {
    return;
  }

  // Clear existing debounce timer
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  // Debounce the processing
  debounceTimer = setTimeout(() => {
    processInput(event.target);
  }, DEBOUNCE_DELAY);
}

/**
 * Process input to detect emoji triggers
 */
async function processInput(element) {
  const { text, cursorPosition } = getTextAndCursor(element);

  if (text === null || cursorPosition === null) {
    hideDropdown();
    return;
  }

  // Find the last ':' before cursor
  const textBeforeCursor = text.substring(0, cursorPosition);
  const lastColonIndex = textBeforeCursor.lastIndexOf(":");

  // Check if we have a valid emoji trigger
  if (lastColonIndex === -1) {
    hideDropdown();
    resetTrigger();
    return;
  }

  // Get the query after the colon
  const query = textBeforeCursor.substring(lastColonIndex + 1);

  // Close popup if trigger text is deleted (empty query)
  if (query.trim() === "") {
    hideDropdown();
    resetTrigger();
    return;
  }

  // Validate query (no spaces, reasonable length)
  if (query.includes(" ") || query.length > 50) {
    hideDropdown();
    resetTrigger();
    return;
  }

  // Check if there's a word character before colon (avoid triggering mid-word)
  if (lastColonIndex > 0) {
    const charBeforeColon = textBeforeCursor[lastColonIndex - 1];
    if (/\w/.test(charBeforeColon)) {
      hideDropdown();
      resetTrigger();
      return;
    }
  }

  // Store trigger position
  emojiTriggerPosition = lastColonIndex;

  // Search for emojis (fetch up to 50 results, UI will show 6 visible)
  const emojis = await searchEmojis(query, 50);

  if (emojis.length > 0) {
    // Show dropdown
    renderEmojis(emojis, (emoji) => {
      insertEmoji(element, emoji);
    });

    // Position dropdown
    updateDropdownPosition();
  } else {
    hideDropdown();
  }
}

/**
 * Update dropdown position based on current caret
 */
function updateDropdownPosition() {
  if (!activeElement) return;

  const caretPos = getCaretPosition(activeElement);
  if (caretPos) {
    positionDropdown(caretPos.x, caretPos.y, caretPos.height);
  }
}

// Track last handled event to prevent double handling from both element and document listeners
let lastHandledEvent = null;

/**
 * Handle keyboard events
 */
function handleKeyDown(event) {
  const dropdownVisible = isDropdownVisible();

  if (!dropdownVisible) return;

  // Prevent double handling from both element and document listeners
  // Check if this exact event was just handled (within 5ms)
  if (
    lastHandledEvent &&
    lastHandledEvent.timeStamp === event.timeStamp &&
    lastHandledEvent.key === event.key
  ) {
    return;
  }

  // Flag to determine if we should stop the event
  let shouldStopEvent = false;
  let action = null;

  switch (event.key) {
    case "ArrowDown":
      shouldStopEvent = true;
      action = "selectNext";
      selectNext();
      break;

    case "ArrowUp":
      shouldStopEvent = true;
      action = "selectPrevious";
      selectPrevious();
      break;

    case "Enter":
      // Use Enter to select emoji
      shouldStopEvent = true;
      action = "selectEmoji";

      selectEmoji();
      break;

    case "Tab":
      // Tab also selects emoji
      shouldStopEvent = true;
      action = "selectEmoji";
      selectEmoji();
      break;

    case "Escape":
      shouldStopEvent = true;
      action = "hideDropdown";
      hideDropdown();
      resetTrigger();
      break;
  }

  // Mark this event as handled
  if (shouldStopEvent) {
    lastHandledEvent = event;
  }

  // Aggressively stop event propagation to prevent sites like Instagram
  // from capturing the key and sending messages prematurely
  if (shouldStopEvent) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return false;
  }
}

/**
 * Get text content and cursor position from element
 */
function getTextAndCursor(element) {
  if (element.contentEditable === "true") {
    return getTextAndCursorContentEditable(element);
  }

  if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
    return {
      text: element.value,
      cursorPosition: element.selectionStart,
    };
  }

  return { text: null, cursorPosition: null };
}

/**
 * Get text and cursor for contenteditable
 */
function getTextAndCursorContentEditable(element) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { text: null, cursorPosition: null };
  }

  const range = selection.getRangeAt(0);
  const text = element.textContent;

  // Create a range from start to cursor
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);

  const cursorPosition = preCaretRange.toString().length;

  return { text, cursorPosition };
}

/**
 * Delete the trigger text (from triggerPos to cursor)
 */
function deleteTriggerText(element, triggerPos) {
  try {
    const { text, cursorPosition } = getTextAndCursor(element);
    if (text === null || cursorPosition === null || triggerPos === -1) {
      return false;
    }

    if (element.contentEditable === "true") {
      // ContentEditable: find text nodes and delete range
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;

      element.focus();

      // Find start/end text nodes for triggerPos..cursorPosition
      let currentPos = 0;
      let startNode = null,
        startOffset = 0;
      let endNode = null,
        endOffset = 0;
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false,
      );
      let node;
      while ((node = walker.nextNode())) {
        const len = node.textContent.length;
        if (!startNode && currentPos + len > triggerPos) {
          startNode = node;
          startOffset = Math.max(0, triggerPos - currentPos);
        }
        if (!endNode && currentPos + len >= cursorPosition) {
          endNode = node;
          endOffset = Math.max(0, cursorPosition - currentPos);
          break;
        }
        currentPos += len;
      }

      if (startNode && endNode) {
        const deleteRange = document.createRange();
        deleteRange.setStart(startNode, startOffset);
        deleteRange.setEnd(endNode, endOffset);
        deleteRange.deleteContents();

        // Place cursor at triggerPos
        const caretRange = document.createRange();
        caretRange.setStart(startNode, startOffset);
        caretRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caretRange);

        // Dispatch input event
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
    } else if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      // Input/Textarea: manipulate value
      const beforeTrigger = text.substring(0, triggerPos);
      const afterCursor = text.substring(cursorPosition);
      element.value = beforeTrigger + afterCursor;
      element.setSelectionRange(triggerPos, triggerPos);

      // Dispatch input event
      element.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }
  } catch (err) {
    console.debug("[Discordmoji] deleteTriggerText error", err);
  }
  return false;
}

/**
 * Insert emoji at the trigger position
 */
async function insertEmoji(element, emoji) {
  console.debug("[Discordmoji] insertEmoji called", { emoji });

  // Prevent double insertion within 500ms
  const now = Date.now();
  if (isInsertingEmoji && now - lastInsertionTime < 500) {
    console.warn(
      "[Discordmoji] Prevented double insertion - already inserting",
    );
    return;
  }

  if (emojiTriggerPosition === -1) {
    console.warn("[Discordmoji] Trigger position is -1, aborting");
    return;
  }

  // Ensure emoji object has at least unicode or image (image-only entries allowed)
  if (!emoji || (!emoji.unicode && !emoji.image)) {
    console.error("[Discordmoji] Invalid emoji object:", emoji);
    resetTrigger();
    return;
  }

  // Set flag to prevent input handler from interfering
  isInsertingEmoji = true;
  lastInsertionTime = now;
  lastInsertedEmoji = emoji.unicode;

  // Capture the trigger position before resetting it
  const triggerPos = emojiTriggerPosition;

  // Hide dropdown immediately to prevent multiple selections
  hideDropdown();

  // If the emoji entry has an image (from discord-emojis.json), try to upload it
  // by finding a nearby file input and simulating selection.
  if (emoji.image) {
    // Delete trigger text BEFORE uploading image
    deleteTriggerText(element, triggerPos);

    try {
      const handled = await tryUploadEmojiImage(emoji, element);
      if (handled) {
        // Reset state and exit early
        resetTrigger();
        setTimeout(() => {
          element.focus();
          isInsertingEmoji = false;
        }, 10);
        return;
      }
    } catch (err) {
      console.warn("[Discordmoji] Image upload attempt failed:", err);
    }
  }

  // Perform insertion BEFORE resetting trigger
  // This ensures the text is replaced immediately
  try {
    if (element.contentEditable === "true") {
      insertEmojiContentEditable(element, emoji, triggerPos);
    } else {
      insertEmojiInputTextarea(element, emoji, triggerPos);
    }
  } catch (error) {
    console.error("[Discordmoji] Insertion failed:", error);
  }

  // Reset after insertion attempt
  resetTrigger();

  // Ensure element stays focused
  setTimeout(() => {
    element.focus();
    isInsertingEmoji = false;
  }, 10);
}

/**
 * Try to upload the emoji image by finding a nearby file input and simulating selection.
 * Returns true if handled.
 */
async function tryUploadEmojiImage(emoji, originElement) {
  console.debug("[Discordmoji] tryUploadEmojiImage", {
    image: emoji && emoji.image,
    originElement,
  });
  if (!emoji || !emoji.image) return false;

  // Fetch image and convert to File
  const fileName = (emoji.slug || emoji.title || "emoji").replace(
    /[^a-z0-9_.-]/gi,
    "_",
  );
  let file;
  try {
    file = await fetchImageAsFile(emoji.image, fileName);
  } catch (err) {
    console.warn("[Discordmoji] Failed to fetch image", err);
    return false;
  }

  // Prefer pasting into the currently-focused element (or origin) first
  try {
    const pasteTarget = document.activeElement || originElement || null;
    if (pasteTarget) {
      focusAndPlaceCaretEnd(pasteTarget);
      // Try to copy image to clipboard then paste like a real user
      const copied = await copyImageToClipboard(file);
      console.debug("[Discordmoji] copyImageToClipboard result", { copied });
      if (copied) {
        // Attempt synthetic paste (may be ignored by browser). If it doesn't attach,
        // inform the user to press Ctrl/Cmd+V to paste the copied image.
        const pasted = simulatePasteOnElement(pasteTarget, file);
        console.debug(
          "[Discordmoji] simulatePasteOnElement after copy result",
          { pasted },
        );
        if (pasted) return true;
        showCopyPasteHint(pasteTarget);
        return true;
      }
    }
  } catch (err) {
    // ignore paste failures and continue to other strategies
  }

  // Find a suitable file input near the origin element or document-wide
  const input = findFileInputNear(originElement);
  console.debug("[Discordmoji] findFileInputNear result", { input });
  if (input) {
    try {
      simulateFileInputChange(input, file);
      console.debug("[Discordmoji] simulateFileInputChange succeeded", {
        input,
      });
      return true;
    } catch (err) {
      console.warn("[Discordmoji] Failed to simulate file input change", err);
    }
  }

  // Instagram-specific: try auto-attach flow (click attach UI and inject file)
  try {
    if (isInstagram()) {
      console.debug(
        "[Discordmoji] Detected Instagram, attempting instagramAutoAttach",
      );
      const igHandled = await instagramAutoAttach(file, originElement);
      console.debug("[Discordmoji] instagramAutoAttach result", { igHandled });
      if (igHandled) return true;
    }
  } catch (err) {
    console.debug("[Discordmoji] instagramAutoAttach error", err);
  }

  // Fallback: try dispatching drag/drop events on likely drop targets
  const targets = findDropTargets(originElement);
  console.debug("[Discordmoji] findDropTargets", {
    targetsCount: targets.length,
    targets,
  });
  for (const t of targets) {
    try {
      console.debug("[Discordmoji] attempting drop on target", { target: t });
      const dropped = simulateDropOnElement(t, file);
      console.debug("[Discordmoji] drop result", { target: t, dropped });
      if (dropped) return true;
    } catch (err) {
      // ignore and continue
    }
  }

  // Try simulating paste (works on many chat apps)
  try {
    console.debug("[Discordmoji] attempting paste on originElement", {
      originElement,
    });
    const pasted = simulatePasteOnElement(originElement, file);
    console.debug("[Discordmoji] paste result", { pasted });
    if (pasted) return true;
  } catch (err) {
    // ignore
  }

  // Fallback: if the paste/drag didn't work, try inserting an <img> directly into a contenteditable target
  try {
    const pasteTarget = document.activeElement || originElement || null;
    if (pasteTarget && pasteTarget.isContentEditable) {
      console.debug(
        "[Discordmoji] attempting direct image insert into contentEditable",
        { pasteTarget },
      );
      const inserted = await insertImageIntoContentEditable(pasteTarget, file);
      console.debug("[Discordmoji] insertImageIntoContentEditable result", {
        inserted,
      });
      if (inserted) return true;
    }
  } catch (err) {
    console.debug("[Discordmoji] insertImageIntoContentEditable error", err);
  }

  // Last resort: try origin element itself with drop
  try {
    const dropped = simulateDropOnElement(originElement, file);
    if (dropped) return true;
  } catch (err) {
    // ignore
  }

  return false;
}

async function fetchImageAsFile(url, filename) {
  console.debug("[Discordmoji] fetching image", { url });

  // Use background service worker to fetch images to avoid CORS issues
  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_IMAGE_AS_BLOB",
      url: url,
    });

    if (!response || !response.success) {
      throw new Error(
        response?.error || "Failed to fetch image via background worker",
      );
    }

    // Convert base64 data URL back to blob
    const base64Response = await fetch(response.data);
    const blob = await base64Response.blob();

    console.debug("[Discordmoji] fetched blob via background", {
      type: blob.type,
      size: blob.size,
    });

    const ext = (blob.type && blob.type.split("/")[1]) || "bin";
    const name = filename + "." + ext;

    try {
      const f = new File([blob], name, { type: blob.type });
      console.debug("[Discordmoji] constructed File", {
        name: f.name,
        type: f.type,
        size: f.size,
      });
      return f;
    } catch (err) {
      // Older environments might not support File constructor; fallback to Blob with name property
      blob.name = name;
      console.debug(
        "[Discordmoji] File constructor unsupported, returning blob with name",
        { name },
      );
      return blob;
    }
  } catch (error) {
    console.error("[Discordmoji] Error fetching image:", error);
    throw error;
  }
}

function ensureFileObject(file, fallbackName = "file") {
  try {
    if (file instanceof File) return file;

    // Determine type from blob if available, otherwise try to guess from name
    const type =
      (file && file.type) ||
      (typeof file === "object" && file.name && /\.gif$/i.test(file.name)
        ? "image/gif"
        : "application/octet-stream");

    // Derive extension from type when possible
    const ext = (type && type.split && type.split("/")[1]) || "bin";
    const nameFromFile = (file && file.name) || `${fallbackName}.${ext}`;

    return new File([file], nameFromFile, { type });
  } catch (err) {
    try {
      return file;
    } catch (e) {
      return file;
    }
  }
}

function findFileInputNear(originElement) {
  // Prefer inputs inside the same form or near the origin element
  try {
    if (originElement) {
      const form = originElement.closest && originElement.closest("form");
      if (form) {
        const input = form.querySelector("input[type=file]");
        if (input) return input;
      }

      // Search ancestors for a file input
      let el = originElement;
      while (el) {
        const found = el.querySelector && el.querySelector("input[type=file]");
        if (found) return found;
        el = el.parentElement;
      }
    }

    // Fallback: any visible file input in document
    const inputs = Array.from(document.querySelectorAll("input[type=file]"));
    for (const i of inputs) {
      if (i.offsetParent !== null || i.offsetWidth > 0) return i;
    }
    // Last resort: return first input even if hidden
    return inputs[0] || null;
  } catch (err) {
    console.debug("[Discordmoji] findFileInputNear error", err);
    return null;
  }
}

function findDropTargets(originElement) {
  const selectors = [
    "[data-dropzone]",
    "[data-uploader]",
    ".dropzone",
    ".uploader",
    ".attachment",
    ".attachments",
    ".upload",
    ".upload-button",
    'button[aria-label*="attach"]',
    'button[title*="Attach"]',
    'button[aria-label*="photo"]',
    '[role="button"][aria-label*="attach"]',
  ];

  const found = new Set();

  try {
    // 1) Search ancestors of originElement for likely targets
    if (originElement) {
      let el = originElement;
      while (el) {
        for (const sel of selectors) {
          const q = el.querySelector && el.querySelector(sel);
          if (q) found.add(q);
        }
        el = el.parentElement;
      }
    }

    // 2) Global search for common upload areas
    for (const sel of selectors) {
      const nodes = Array.from(document.querySelectorAll(sel));
      for (const n of nodes) found.add(n);
    }

    // 3) Heuristic: buttons with paperclip/icons near origin
    const iconButtons = Array.from(document.querySelectorAll("button")).filter(
      (b) =>
        /attach|clip|photo|image|upload|file/i.test(
          (b.getAttribute("aria-label") || "") +
            (b.title || "") +
            (b.className || ""),
        ),
    );
    iconButtons.forEach((b) => found.add(b));
  } catch (err) {
    console.debug("[Discordmoji] findDropTargets error", err);
  }

  // Return array with originElement first, then found elements
  const arr = [];
  if (originElement) arr.push(originElement);
  for (const el of found) {
    if (el && el !== originElement) arr.push(el);
  }
  return arr;
}

function isInstagram() {
  try {
    return location && location.host && location.host.includes("instagram.com");
  } catch (err) {
    return false;
  }
}

async function instagramAutoAttach(file, originElement) {
  try {
    // 1) Quick check: any visible input[type=file] already on the page
    const inputs = Array.from(document.querySelectorAll("input[type=file]"));
    for (const i of inputs) {
      if (i.accept && /image|video/.test(i.accept)) {
        console.debug("[Discordmoji][Insta] found existing file input", i);
        simulateFileInputChange(i, file);
        return true;
      }
    }

    // 2) Try to find attach buttons that Instagram uses in DM composer
    // Target the exact 'Add Photo or Video' control first (SVG with aria-label)
    const candidates = new Set();
    try {
      const svgAdd = Array.from(
        document.querySelectorAll('svg[aria-label="Add Photo or Video"]'),
      );
      for (const s of svgAdd) {
        const parent = s.closest && s.closest('[role="button"]');
        if (parent) candidates.add(parent);
        else candidates.add(s);
      }

      // Also match elements that include the title text or aria-label variants
      const more = Array.from(
        document.querySelectorAll(
          '[title="Add Photo or Video"], button[aria-label="Add Photo or Video"]',
        ),
      );
      more.forEach((n) => candidates.add(n));

      // Broader match: elements with svg child that has title or aria-label containing Add/Photo
      const svgs = Array.from(document.querySelectorAll("svg")).filter((s) => {
        try {
          const a = s.getAttribute("aria-label") || "";
          const t =
            s.querySelector &&
            ((s.querySelector("title") &&
              s.querySelector("title").textContent) ||
              "");
          return /add photo|add video|photo|image/i.test(a + " " + t);
        } catch (e) {
          return false;
        }
      });
      for (const s of svgs) {
        const p = s.closest && s.closest('[role="button"]');
        if (p) candidates.add(p);
      }

      // Fallback: icon-like buttons
      const iconButtons = Array.from(
        document.querySelectorAll("button"),
      ).filter((b) =>
        /photo|image|attach|camera|gallery|paperclip|add photo/i.test(
          (b.getAttribute("aria-label") || "") +
            (b.title || "") +
            (b.className || ""),
        ),
      );
      iconButtons.forEach((b) => candidates.add(b));

      // If no candidates, try parent areas near originElement
      if (candidates.size === 0 && originElement) {
        const found = originElement.closest && originElement.closest("form");
        if (found) {
          const local = found.querySelectorAll("button");
          local.forEach((b) => candidates.add(b));
        }
      }
    } catch (err) {
      console.debug("[Discordmoji][Insta] candidate discovery error", err);
    }

    // Try clicking each candidate and wait for a newly inserted input[type=file]
    for (const btn of candidates) {
      try {
        console.debug(
          "[Discordmoji][Insta] attempting user-like click on candidate",
          btn,
        );
        simulateUserClick(btn);

        // Wait longer for file input to appear in DOM (Instagram may take time)
        const input = await waitForFileInput(3500);
        if (input) {
          console.debug(
            "[Discordmoji][Insta] found file input after click",
            input,
          );
          simulateFileInputChange(input, file);
          return true;
        }
      } catch (err) {
        console.debug("[Discordmoji][Insta] candidate click error", err);
      }
    }

    // 3) As last attempt, try to blur originElement to reveal attach UI (Instagram may hide while typing)
    if (originElement && document.activeElement === originElement) {
      try {
        originElement.blur && originElement.blur();
        await new Promise((r) => setTimeout(r, 250));
        const input = await waitForFileInput(1200);
        if (input) {
          simulateFileInputChange(input, file);
          return true;
        }
      } catch (err) {
        // ignore
      } finally {
        originElement.focus && originElement.focus();
      }
    }

    return false;
  } catch (err) {
    console.debug("[Discordmoji][Insta] instagramAutoAttach error", err);
    return false;
  }
}

function waitForFileInput(timeout = 2000) {
  return new Promise((resolve) => {
    // Check existing quickly
    const existing = Array.from(
      document.querySelectorAll("input[type=file]"),
    ).find((i) => i.accept && /image|video/.test(i.accept));
    if (existing) return resolve(existing);

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of Array.from(m.addedNodes || [])) {
          try {
            if (node.nodeType === 1) {
              if (
                node.matches &&
                node.matches("input[type=file]") &&
                node.accept &&
                /image|video/.test(node.accept)
              ) {
                obs.disconnect();
                return resolve(node);
              }
              const nested =
                node.querySelector && node.querySelector("input[type=file]");
              if (
                nested &&
                nested.accept &&
                /image|video/.test(nested.accept)
              ) {
                obs.disconnect();
                return resolve(nested);
              }
            }
          } catch (err) {
            // ignore
          }
        }
      }
    });

    obs.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => {
      obs.disconnect();
      resolve(null);
    }, timeout);
  });
}

function simulateUserClick(el) {
  try {
    if (!el) return;
    const rect = el.getBoundingClientRect && el.getBoundingClientRect();
    const cx = rect ? rect.left + rect.width / 2 : 0;
    const cy = rect ? rect.top + rect.height / 2 : 0;

    const props = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: cx,
      clientY: cy,
    };

    el.dispatchEvent(new PointerEvent("pointerdown", props));
    el.dispatchEvent(new MouseEvent("mousedown", props));
    el.dispatchEvent(new MouseEvent("mouseup", props));
    el.dispatchEvent(new MouseEvent("click", props));
    el.focus && el.focus();
  } catch (err) {
    try {
      el.click && el.click();
    } catch (e) {
      /* ignore */
    }
  }
}

function simulateFileInputChange(input, file) {
  // Use DataTransfer to build a FileList
  const dt = new DataTransfer();
  const f = ensureFileObject(
    file,
    file && file.name ? file.name.replace(/\.[^.]+$/, "") : "file",
  );
  dt.items.add(f instanceof Blob ? new File([f], f.name, { type: f.type }) : f);

  // Some frameworks check input.files, which is read-only, so redefine it temporarily
  try {
    Object.defineProperty(input, "files", {
      value: dt.files,
      writable: false,
    });
  } catch (err) {
    console.debug("[Discordmoji] Unable to redefine input.files", err);
  }

  // Dispatch events
  console.debug("[Discordmoji] dispatching input/change on", {
    input,
    files: dt.files,
  });
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function simulateDropOnElement(target, file) {
  try {
    console.debug("[Discordmoji] simulateDropOnElement", { target });
    const dt = new DataTransfer();
    const f = ensureFileObject(
      file,
      file && file.name ? file.name.replace(/\.[^.]+$/, "") : "file",
    );
    dt.items.add(
      f instanceof Blob ? new File([f], f.name, { type: f.type }) : f,
    );

    const eventInit = {
      bubbles: true,
      cancelable: true,
      dataTransfer: dt,
    };

    const dragEnter = new DragEvent("dragenter", eventInit);
    const dragOver = new DragEvent("dragover", eventInit);
    const drop = new DragEvent("drop", eventInit);

    try {
      target.dispatchEvent(dragEnter);
    } catch (e) {
      console.debug("dragenter failed", e);
    }
    try {
      target.dispatchEvent(dragOver);
    } catch (e) {
      console.debug("dragover failed", e);
    }
    try {
      target.dispatchEvent(drop);
    } catch (e) {
      console.debug("drop failed", e);
    }

    return true;
  } catch (err) {
    console.debug("[Discordmoji] simulateDropOnElement error", err);
    return false;
  }
}

function simulatePasteOnElement(target, file) {
  try {
    console.debug("[Discordmoji] simulatePasteOnElement", { target });
    const dt = new DataTransfer();
    const f = ensureFileObject(
      file,
      file && file.name ? file.name.replace(/\.[^.]+$/, "") : "file",
    );
    dt.items.add(
      f instanceof Blob ? new File([f], f.name, { type: f.type }) : f,
    );

    const eventInit = {
      bubbles: true,
      cancelable: true,
      clipboardData: dt,
    };

    let pasteEvent;
    try {
      pasteEvent = new ClipboardEvent("paste", eventInit);
    } catch (err) {
      // Some browsers restrict ClipboardEvent constructor; fallback to generic Event and attach clipboardData
      pasteEvent = new Event("paste", { bubbles: true, cancelable: true });
      try {
        pasteEvent.clipboardData = dt;
      } catch (e) {
        /* ignore */
      }
    }

    const el = target || document.activeElement || document.body;
    try {
      el.dispatchEvent(pasteEvent);
      console.debug("[Discordmoji] paste event dispatched", { el });
      return true;
    } catch (err) {
      console.debug("[Discordmoji] paste dispatch failed", err);
      return false;
    }
  } catch (err) {
    console.debug("[Discordmoji] simulatePasteOnElement error", err);
    return false;
  }
}

async function copyImageToClipboard(blob) {
  try {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.ClipboardItem) {
      console.debug("[Discordmoji] attempting navigator.clipboard.write");
      const item = new ClipboardItem({ [blob.type]: blob });
      await navigator.clipboard.write([item]);
      console.debug("[Discordmoji] navigator.clipboard.write succeeded");
      return true;
    }
  } catch (err) {
    console.debug("[Discordmoji] navigator.clipboard.write failed", err);
  }

  // Fallback: create an off-screen contenteditable, insert image, select it, execCommand('copy')
  try {
    console.debug("[Discordmoji] attempting execCommand copy fallback");
    const dataUrl = await blobToDataURL(blob);
    const holder = document.createElement("div");
    holder.contentEditable = "true";
    holder.style.position = "fixed";
    holder.style.left = "-9999px";
    holder.style.width = "1px";
    holder.style.height = "1px";
    holder.style.overflow = "hidden";
    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "emoji";
    holder.appendChild(img);
    document.body.appendChild(holder);

    const range = document.createRange();
    range.selectNodeContents(img);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const ok = document.execCommand("copy");
    sel.removeAllRanges();
    document.body.removeChild(holder);
    console.debug("[Discordmoji] execCommand(copy) result", { ok });
    return !!ok;
  } catch (err) {
    console.debug("[Discordmoji] execCommand copy fallback failed", err);
    return false;
  }
}

function focusAndPlaceCaretEnd(el) {
  try {
    console.debug("[Discordmoji] focusAndPlaceCaretEnd", { el });
    if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
      const len = el.value ? el.value.length : 0;
      el.focus();
      el.setSelectionRange && el.setSelectionRange(len, len);
      return;
    }

    if (el.isContentEditable) {
      el.focus();
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return;
    }

    // Fallback: focus element
    el.focus && el.focus();
  } catch (err) {
    console.debug("[Discordmoji] focusAndPlaceCaretEnd error", err);
  }
}

async function insertImageIntoContentEditable(target, fileOrBlob) {
  try {
    // Convert blob/file to data URL
    const dataUrl = await blobToDataURL(fileOrBlob);
    if (!dataUrl) return false;

    const img = document.createElement("img");
    img.src = dataUrl;
    img.alt = "emoji";
    img.style.maxWidth = "240px";
    img.style.maxHeight = "240px";

    const sel = window.getSelection();
    if (!sel) {
      target.appendChild(img);
      return true;
    }

    // Insert at caret (or at end)
    let range = sel.rangeCount ? sel.getRangeAt(0) : null;
    if (!range || !isOrContains(target, range.commonAncestorContainer)) {
      range = document.createRange();
      range.selectNodeContents(target);
      range.collapse(false);
    }

    range.deleteContents();
    const node = range.insertNode(img);

    // Move caret after the inserted node
    range.setStartAfter(img);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Dispatch input events so frameworks pick up the change
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  } catch (err) {
    console.debug("[Discordmoji] insertImageIntoContentEditable error", err);
    return false;
  }
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(blob instanceof Blob ? blob : new Blob([blob]));
    } catch (err) {
      reject(err);
    }
  });
}

function isOrContains(parent, node) {
  try {
    if (!parent || !node) return false;
    return (
      parent === node ||
      (parent.compareDocumentPosition &&
        parent.compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_CONTAINED_BY)
    );
  } catch (err) {
    return false;
  }
}

function showCopyPasteHint(target) {
  try {
    const hint = document.createElement("div");
    hint.id = "discordmoji-copy-hint";
    hint.textContent = "Image copied — press Ctrl/Cmd+V to paste";
    hint.style.position = "fixed";
    hint.style.zIndex = 999999;
    hint.style.background = "rgba(0,0,0,0.85)";
    hint.style.color = "#fff";
    hint.style.padding = "8px 10px";
    hint.style.borderRadius = "8px";
    hint.style.fontSize = "12px";
    hint.style.boxShadow = "0 4px 16px rgba(0,0,0,0.5)";

    // Position near target if possible
    let x = window.innerWidth - 20;
    let y = window.innerHeight - 80;
    try {
      const rect =
        target &&
        target.getBoundingClientRect &&
        target.getBoundingClientRect();
      if (rect) {
        x = Math.min(
          window.innerWidth - 20,
          rect.left + rect.width / 2 + window.scrollX,
        );
        y = rect.top + window.scrollY - 40;
        if (y < 10) y = rect.bottom + 10;
      }
    } catch (err) {
      // ignore positioning errors
    }

    hint.style.left = `${Math.max(10, x - 140)}px`;
    hint.style.top = `${Math.max(10, y)}px`;

    document.body.appendChild(hint);
    setTimeout(() => {
      hint.style.transition = "opacity 200ms ease";
      hint.style.opacity = "0";
      setTimeout(() => hint.remove(), 300);
    }, 2200);
  } catch (err) {
    console.debug("[Discordmoji] showCopyPasteHint error", err);
  }
}

function showPasteNowButton(target) {
  try {
    // Remove existing
    const existing = document.getElementById("discordmoji-paste-btn");
    if (existing) existing.remove();

    const btn = document.createElement("button");
    btn.id = "discordmoji-paste-btn";
    btn.textContent = "Paste image";
    btn.style.position = "fixed";
    btn.style.zIndex = 999999;
    btn.style.background = "#5865F2";
    btn.style.color = "#fff";
    btn.style.padding = "8px 10px";
    btn.style.border = "none";
    btn.style.borderRadius = "6px";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "13px";

    // Position near target
    let x = window.innerWidth - 120;
    let y = window.innerHeight - 80;
    try {
      const rect =
        target &&
        target.getBoundingClientRect &&
        target.getBoundingClientRect();
      if (rect) {
        x = rect.left + rect.width / 2 + window.scrollX - 60;
        y = rect.top + window.scrollY - 44;
        if (y < 10) y = rect.bottom + 10;
      }
    } catch (err) {}

    btn.style.left = `${Math.max(8, x)}px`;
    btn.style.top = `${Math.max(8, y)}px`;

    btn.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      try {
        console.debug("[Discordmoji] paste button clicked, reading clipboard");
        const ok = await pasteFromClipboardAndInsert(target);
        console.debug("[Discordmoji] pasteFromClipboardAndInsert result", {
          ok,
        });
      } catch (err) {
        console.debug("[Discordmoji] paste button handler error", err);
      } finally {
        btn.remove();
      }
    });

    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 8000);
  } catch (err) {
    console.debug("[Discordmoji] showPasteNowButton error", err);
  }
}

async function pasteFromClipboardAndInsert(target) {
  try {
    if (!navigator.clipboard || !navigator.clipboard.read) {
      console.debug("[Discordmoji] clipboard.read not supported");
      return false;
    }

    const items = await navigator.clipboard.read();
    console.debug("[Discordmoji] clipboard.read items", {
      itemsCount: items.length,
    });
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith("image/")) {
          const blob = await item.getType(type);
          console.debug("[Discordmoji] clipboard image blob", {
            type: blob.type,
            size: blob.size,
          });
          // Try to insert into contenteditable
          if (target && target.isContentEditable) {
            return await insertImageIntoContentEditable(target, blob);
          }
          // fallback: attempt paste event
          try {
            const dt = new DataTransfer();
            dt.items.add(
              new File([blob], "pasted." + (blob.type.split("/")[1] || "png"), {
                type: blob.type,
              }),
            );
            const ev = new ClipboardEvent("paste", {
              bubbles: true,
              cancelable: true,
              clipboardData: dt,
            });
            (target || document.activeElement || document.body).dispatchEvent(
              ev,
            );
            return true;
          } catch (err) {
            console.debug(
              "[Discordmoji] pasteFromClipboard fallback dispatch error",
              err,
            );
          }
        }
      }
    }
    return false;
  } catch (err) {
    console.debug("[Discordmoji] pasteFromClipboardAndInsert error", err);
    return false;
  }
}

/**
 * Insert emoji in input/textarea
 */
function insertEmojiInputTextarea(element, emoji, triggerPos) {
  const { text, cursorPosition } = getTextAndCursor(element);

  // Calculate the end of the emoji query
  const beforeEmoji = text.substring(0, triggerPos);
  const afterCursor = text.substring(cursorPosition);

  // Build new text with emoji
  const newText = beforeEmoji + emoji.unicode + afterCursor;

  // Set new value
  element.value = newText;

  // Set cursor position after emoji
  const newCursorPos = triggerPos + emoji.unicode.length;
  element.setSelectionRange(newCursorPos, newCursorPos);

  // Trigger input events for frameworks (React, Vue, etc.) that listen to them
  // Use InputEvent for better compatibility
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
    inputType: "insertText",
    data: emoji.unicode,
  });
  element.dispatchEvent(inputEvent);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

/**
 * Insert emoji in contenteditable
 */
function insertEmojiContentEditable(element, emoji, triggerPos) {
  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.warn("[Discordmoji] No selection or range");
      return;
    }

    const range = selection.getRangeAt(0);

    // Get current text and cursor position
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(element);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    const cursorPosition = preCaretRange.toString().length;

    const queryLength = cursorPosition - triggerPos;

    // capture fullText and beforeTrigger for deterministic cursor placement
    const fullText = element.textContent;
    const beforeTrigger = fullText.substring(0, triggerPos);

    // Robust Range-based deletion + insert
    // 1) Find the exact start/end text nodes for triggerPos..cursorPosition
    // 2) Delete the contents via Range.deleteContents()
    // 3) Insert the emoji node at that spot
    // 4) Dispatch strong input events so React/Instagram pick up the change

    element.focus();

    // Find start/end text nodes
    let currentPos = 0;
    let startNode = null,
      startOffset = 0;
    let endNode = null,
      endOffset = 0;
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );
    let node;
    while ((node = walker.nextNode())) {
      const len = node.textContent.length;
      if (!startNode && currentPos + len > triggerPos) {
        startNode = node;
        startOffset = Math.max(0, triggerPos - currentPos);
      }
      if (!endNode && currentPos + len >= cursorPosition) {
        endNode = node;
        endOffset = Math.max(0, cursorPosition - currentPos);
        break;
      }
      currentPos += len;
    }

    if (startNode && endNode) {
      const deleteRange = document.createRange();
      deleteRange.setStart(startNode, startOffset);
      deleteRange.setEnd(endNode, endOffset);

      // Select the deleteRange and use execCommand('insertText') to replace selection
      selection.removeAllRanges();
      selection.addRange(deleteRange);

      // Try to replace selection with emoji using execCommand (keeps frameworks happy)
      const replaced = document.execCommand("insertText", false, emoji.unicode);

      if (replaced) {
        // Compute new cursor absolute position
        const newCursorPos = beforeTrigger.length + emoji.unicode.length;

        // Find node+offset for newCursorPos
        let pos = 0;
        const walker2 = document.createTreeWalker(
          element,
          NodeFilter.SHOW_TEXT,
          null,
          false,
        );
        let n;
        let foundNode = null,
          foundOffset = 0;
        while ((n = walker2.nextNode())) {
          const l = n.textContent.length;
          if (pos + l >= newCursorPos) {
            foundNode = n;
            foundOffset = newCursorPos - pos;
            break;
          }
          pos += l;
        }

        const caretRange = document.createRange();
        if (foundNode) {
          caretRange.setStart(foundNode, foundOffset);
        } else {
          caretRange.selectNodeContents(element);
          caretRange.collapse(false);
        }
        caretRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(caretRange);
      } else {
        // Fallback: insert node directly
        const emojiNode = document.createTextNode(emoji.unicode);
        deleteRange.insertNode(emojiNode);
        const afterRange = document.createRange();
        afterRange.setStartAfter(emojiNode);
        afterRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(afterRange);

        setTimeout(() => {
          try {
            element.dispatchEvent(
              new InputEvent("input", {
                bubbles: true,
                inputType: "insertText",
                data: emoji.unicode,
              }),
            );
          } catch (e) {
            element.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }, 0);
      }
    } else {
      console.warn(
        "[Discordmoji] Could not find start/end nodes - falling back to selection.modify",
      );
      // Fallback: try previous selection.modify approach
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      for (let i = 0; i < queryLength; i++)
        selection.modify("extend", "backward", "character");
      if (!selection.isCollapsed) document.execCommand("delete", false, null);
      document.execCommand("insertText", false, emoji.unicode);
      setTimeout(
        () =>
          element.dispatchEvent(
            new InputEvent("input", {
              bubbles: true,
              inputType: "insertText",
              data: emoji.unicode,
            }),
          ),
        0,
      );
    }

    // Trigger input events for frameworks
    setTimeout(() => {
      const inputEvent = new InputEvent("input", {
        bubbles: true,
        cancelable: false,
        inputType: "insertText",
        data: emoji.unicode,
      });
      element.dispatchEvent(inputEvent);
    }, 0);
  } catch (error) {
    console.error("[Discordmoji] Error in insertEmojiContentEditable:", error);
  }
}

/**
 * Reset emoji trigger state
 */
function resetTrigger() {
  emojiTriggerPosition = -1;
}

/**
 * Debounce utility
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize);
} else {
  initialize();
}
