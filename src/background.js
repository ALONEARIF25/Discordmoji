/**
 * Background Service Worker for Discordmoji
 * Handles API requests to avoid CORS issues in content scripts
 */

// Cache for Discadia API results
const apiCache = new Map();
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch emojis from Discadia API
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of emoji objects from API
 */
async function fetchDiscadiaEmojis(query, limit = 100) {
  if (!query || query.trim() === "") {
    return [];
  }

  const cacheKey = `${query.toLowerCase()}_${limit}`;
  const cached = apiCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < API_CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `https://discadia.com/api/emojis?q=${encodeURIComponent(query)}&limit=${limit}&page=1`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Discadia API request failed: ${response.status}`);
      return [];
    }

    const result = await response.json();
    const emojis = (result.data || []).map((item) => ({
      name: item.title || "",
      title: item.title || "",
      image: item.emote ? `https://emoji.discadia.com/${item.emote}` : "",
      keywords: item.alt_label || [],
      id: item.id,
      source: "discadia-api",
    }));

    apiCache.set(cacheKey, {
      data: emojis,
      timestamp: Date.now(),
    });

    return emojis;
  } catch (error) {
    console.warn("Error fetching from Discadia API:", error);
    return [];
  }
}

/**
 * Fetch an image as a blob (for CORS-restricted images)
 * @param {string} url - Image URL to fetch
 * @returns {Promise<Object>} Object with blob data and type
 */
async function fetchImageAsBlob(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "image/*",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    const blob = await response.blob();

    // Convert blob to base64 to send via message passing
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          success: true,
          data: reader.result,
          type: blob.type,
          size: blob.size,
        });
      };
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Error fetching image:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Message listener for content script requests
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "FETCH_DISCADIA_EMOJIS") {
    fetchDiscadiaEmojis(request.query, request.limit)
      .then((emojis) => {
        sendResponse({ success: true, data: emojis });
      })
      .catch((error) => {
        console.error("Background fetch error:", error);
        sendResponse({ success: false, data: [], error: error.message });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }

  if (request.type === "FETCH_IMAGE_AS_BLOB") {
    fetchImageAsBlob(request.url)
      .then((result) => {
        sendResponse(result);
      })
      .catch((error) => {
        console.error("Background image fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate we'll respond asynchronously
    return true;
  }
});

console.log("[Discordmoji Background] Service worker initialized");
