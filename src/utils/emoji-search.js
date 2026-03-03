/**
 * Emoji search utility
 * Loads emoji data and provides efficient search functionality
 */

// Cache for emoji data
let emojiData = null;
let isLoading = false;
let loadCallbacks = [];

/**
 * Fetch emojis from Discadia API via background service worker
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of emoji objects from API
 */
async function fetchDiscadiaEmojis(query, limit = 100) {
  if (!query || query.trim() === "") {
    return [];
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: "FETCH_DISCADIA_EMOJIS",
      query: query,
      limit: limit,
    });

    if (response && response.success) {
      return response.data || [];
    } else {
      console.warn("Background API request failed:", response?.error);
      return [];
    }
  } catch (error) {
    console.warn("Error communicating with background worker:", error);
    return [];
  }
}

/**
 * Load emoji data from JSON file
 * @returns {Promise<Array>} Promise that resolves with emoji data
 */
async function loadEmojiData() {
  // Return cached data if available
  if (emojiData) {
    return emojiData;
  }

  // If already loading, wait for the existing load to complete
  if (isLoading) {
    return new Promise((resolve) => {
      loadCallbacks.push(resolve);
    });
  }

  isLoading = true;

  try {
    // Load primary emoji data (native/unicode list)
    const url = chrome.runtime.getURL("data/emoji-data.json");
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to load emoji data: ${response.status}`);
    }

    const primary = await response.json();

    // Attempt to load supplemental Discord-style image emojis and merge
    let supplemental = [];
    try {
      const discordUrl = chrome.runtime.getURL("data/discord-emojis.json");
      const discordResp = await fetch(discordUrl);
      if (discordResp && discordResp.ok) {
        supplemental = await discordResp.json();
      }
    } catch (err) {
      // Non-fatal: supplemental may not exist
      console.warn("Discord emoji supplement not loaded:", err);
    }

    // Normalize primary data: ensure { name, unicode, keywords }
    const primaryMap = new Map();
    (primary || []).forEach((e) => {
      const key = (e.name || "").toLowerCase();
      primaryMap.set(key, e);
    });

    // Merge supplemental entries that do not conflict with primary names
    const merged = [];
    // Start with primary entries (prefer native/unicode)
    (primary || []).forEach((e) => merged.push(e));

    (supplemental || []).forEach((s) => {
      // derive a search-friendly name from title/slug
      const title = s.title || s.slug || "";
      const derived = title
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "");
      if (!primaryMap.has(derived)) {
        // create an emoji record compatible with renderer/search
        merged.push({
          name: derived,
          title: s.title,
          slug: s.slug,
          image: s.image,
          keywords: [],
          source: "discord-emojis",
        });
      }
    });

    emojiData = merged;

    // Resolve all waiting callbacks
    loadCallbacks.forEach((callback) => callback(emojiData));
    loadCallbacks = [];

    return emojiData;
  } catch (error) {
    console.error("Error loading emoji data:", error);
    isLoading = false;
    throw error;
  } finally {
    isLoading = false;
  }
}

/**
 * Search emojis by query
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum number of results (default: 50)
 * @returns {Promise<Array>} Array of matching emojis
 */
async function searchEmojis(query, maxResults = 50) {
  if (!query || query.trim() === "") {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Search both local data and API in parallel
  const [localEmojis, apiEmojis] = await Promise.all([
    loadEmojiData(),
    fetchDiscadiaEmojis(normalizedQuery, 100),
  ]);

  const results = [];
  const seen = new Set();

  /**
   * Add emoji to results if not already included
   * @param {Object} emoji - Emoji object to add
   */
  function addResult(emoji) {
    if (results.length >= maxResults) return false;

    const key = emoji.image || emoji.unicode || emoji.name || emoji.title;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(emoji);
      return true;
    }
    return false;
  }

  /**
   * Check if emoji matches query at a given priority level
   * @param {Object} emoji - Emoji to check
   * @param {string} matchType - 'exact', 'startsWith', 'contains', 'keywords'
   */
  function matchesQuery(emoji, matchType) {
    const n = (emoji.name || "").toLowerCase();
    const t = (emoji.title || "").toLowerCase();

    switch (matchType) {
      case "exact":
        return n === normalizedQuery || t === normalizedQuery;
      case "startsWith":
        return n.startsWith(normalizedQuery) || t.startsWith(normalizedQuery);
      case "contains":
        return n.includes(normalizedQuery) || t.includes(normalizedQuery);
      case "keywords":
        return emoji.keywords?.some((keyword) =>
          keyword.toLowerCase().includes(normalizedQuery),
        );
      default:
        return false;
    }
  }

  // Priority-based matching - LOCAL EMOJIS FIRST
  const matchPriorities = ["exact", "startsWith", "contains", "keywords"];

  // First pass: Search local emojis with all priority levels
  for (const priority of matchPriorities) {
    if (results.length >= maxResults) break;

    for (const emoji of localEmojis) {
      if (matchesQuery(emoji, priority)) {
        if (!addResult(emoji)) break;
      }
    }
  }

  // Second pass: Fill remaining slots with API results
  if (results.length < maxResults) {
    for (const priority of matchPriorities) {
      if (results.length >= maxResults) break;

      for (const emoji of apiEmojis) {
        if (matchesQuery(emoji, priority)) {
          if (!addResult(emoji)) break;
        }
      }
    }
  }

  return results;
}

/**
 * Pre-load emoji data on initialization
 * Call this early to avoid delays on first search
 */
function preloadEmojiData() {
  loadEmojiData().catch((err) => {
    console.warn("Failed to preload emoji data:", err);
  });
}

// Auto-preload when script loads
preloadEmojiData();
