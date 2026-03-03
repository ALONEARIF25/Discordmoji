/**
 * UI Renderer for emoji picker dropdown
 * Manages the creation, positioning, and updating of the suggestion UI
 */

// Singleton dropdown element
let dropdownElement = null;
let selectedIndex = 0;
let currentEmojis = [];
let onSelectCallback = null;

/**
 * Create the dropdown container element
 * @returns {HTMLElement} The dropdown element
 */
function createDropdown() {
  const dropdown = document.createElement("div");
  dropdown.id = "discordmoji-dropdown";
  dropdown.className = "discordmoji-dropdown";
  dropdown.setAttribute("role", "listbox");
  dropdown.setAttribute("aria-label", "Emoji suggestions");

  return dropdown;
}

/**
 * Render emoji suggestions in the dropdown
 * @param {Array} emojis - Array of emoji objects to display
 * @param {Function} onSelect - Callback when an emoji is selected
 */
function renderEmojis(emojis, onSelect) {
  if (!dropdownElement) {
    dropdownElement = createDropdown();
    document.body.appendChild(dropdownElement);
  }

  currentEmojis = emojis;
  selectedIndex = 0;
  onSelectCallback = onSelect;

  // Clear existing content
  dropdownElement.innerHTML = "";

  if (emojis.length === 0) {
    hideDropdown();
    return;
  }

  // Create emoji items
  emojis.forEach((emoji, index) => {
    const item = document.createElement("div");
    item.className = "discordmoji-item";
    item.setAttribute("role", "option");
    item.setAttribute("data-index", index);

    if (index === 0) {
      item.classList.add("selected");
      item.setAttribute("aria-selected", "true");
    }

    // Create emoji span (unicode or image)
    const emojiSpan = document.createElement("span");
    emojiSpan.className = "discordmoji-emoji";
    if (emoji.image) {
      const img = document.createElement("img");
      img.className = "discordmoji-emoji-img";
      img.src = emoji.image;
      img.alt = emoji.title || emoji.name || "emoji";
      emojiSpan.appendChild(img);
    } else {
      emojiSpan.textContent = emoji.unicode || emoji.unicodeChar || "";
    }

    // Create name span
    const nameSpan = document.createElement("span");
    nameSpan.className = "discordmoji-name";
    // Use available title/name/slug
    const displayName = emoji.name || emoji.title || emoji.slug || "";
    nameSpan.textContent = displayName ? `:${displayName}:` : "";

    // Create source badge if applicable
    let sourceBadge = null;
    if (emoji.source === "discord-emojis") {
      sourceBadge = document.createElement("span");
      sourceBadge.className = "discordmoji-source-badge";
      sourceBadge.textContent = "local";
    } else if (emoji.source === "discadia-api") {
      sourceBadge = document.createElement("span");
      sourceBadge.className = "discordmoji-source-badge discordmoji-source-api";
      sourceBadge.textContent = "api";
    }

    item.appendChild(emojiSpan);
    item.appendChild(nameSpan);
    if (sourceBadge) {
      item.appendChild(sourceBadge);
    }

    // Click handler
    item.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      selectEmoji(index);
    });

    // Mouse hover handler
    item.addEventListener("mouseenter", () => {
      setSelectedIndex(index);
    });

    dropdownElement.appendChild(item);
  });

  dropdownElement.style.display = "block";
}

/**
 * Position the dropdown near the caret
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @param {number} height - Height of caret/line
 */
function positionDropdown(x, y, height) {
  if (!dropdownElement) return;

  const padding = 4;
  const dropdownHeight = dropdownElement.offsetHeight;
  const dropdownWidth = dropdownElement.offsetWidth;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  let top = y + height + padding;
  let left = x;

  // Check if dropdown would go off bottom of screen
  if (top + dropdownHeight > viewportHeight) {
    // Position above caret instead
    top = y - dropdownHeight - padding;
  }

  // Check if dropdown would go off right of screen
  if (left + dropdownWidth > viewportWidth) {
    left = viewportWidth - dropdownWidth - padding;
  }

  // Ensure not off left of screen
  if (left < padding) {
    left = padding;
  }

  // Ensure not off top of screen
  if (top < padding) {
    top = padding;
  }

  dropdownElement.style.left = `${left}px`;
  dropdownElement.style.top = `${top}px`;
}

/**
 * Update the selected index and visual highlight
 * @param {number} index - New selected index
 */
function setSelectedIndex(index) {
  if (!dropdownElement || currentEmojis.length === 0) return;

  // Clamp index to valid range
  selectedIndex = Math.max(0, Math.min(index, currentEmojis.length - 1));

  // Update visual selection
  const items = dropdownElement.querySelectorAll(".discordmoji-item");
  items.forEach((item, i) => {
    if (i === selectedIndex) {
      item.classList.add("selected");
      item.setAttribute("aria-selected", "true");
      // Scroll into view if needed
      item.scrollIntoView({ block: "nearest" });
    } else {
      item.classList.remove("selected");
      item.setAttribute("aria-selected", "false");
    }
  });
}

/**
 * Move selection up
 */
function selectPrevious() {
  if (selectedIndex > 0) {
    setSelectedIndex(selectedIndex - 1);
  }
}

/**
 * Move selection down
 */
function selectNext() {
  if (selectedIndex < currentEmojis.length - 1) {
    setSelectedIndex(selectedIndex + 1);
  }
}

/**
 * Select the emoji at the given index
 * @param {number} index - Index to select (defaults to current)
 */
function selectEmoji(index = selectedIndex) {
  if (currentEmojis.length === 0) return;

  const emoji = currentEmojis[index];
  if (emoji && onSelectCallback) {
    onSelectCallback(emoji);
  }

  hideDropdown();
}

/**
 * Hide the dropdown
 */
function hideDropdown() {
  if (dropdownElement) {
    dropdownElement.style.display = "none";
    dropdownElement.innerHTML = "";
  }

  currentEmojis = [];
  selectedIndex = 0;
  onSelectCallback = null;
}

/**
 * Check if dropdown is currently visible
 * @returns {boolean}
 */
function isDropdownVisible() {
  return dropdownElement && dropdownElement.style.display !== "none";
}

/**
 * Destroy the dropdown and clean up
 */
function destroy() {
  if (dropdownElement && dropdownElement.parentNode) {
    dropdownElement.parentNode.removeChild(dropdownElement);
  }
  dropdownElement = null;
  currentEmojis = [];
  selectedIndex = 0;
  onSelectCallback = null;
}
