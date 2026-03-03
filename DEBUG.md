# Debugging Guide for Discordmoji

## How to Debug Instagram/Messenger Issues

The extension now includes comprehensive debug logging to help identify issues with emoji insertion on complex sites like Instagram and Messenger.

### Enable Console Logging

1. Open Instagram or Messenger in Chrome
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Reload the page

### What to Look For

When you use the extension, you'll see detailed logs like:

```
[Discordmoji] Extension initialized v1.0.0
[Discordmoji] Debug logging enabled - check console for insertion details
[Discordmoji] Attached to element: {tagName, contentEditable, className...}
[Discordmoji] Searching for emojis: {query, triggerPosition...}
[Discordmoji] Search results: {count, emojis...}
[Discordmoji] Emoji selected from dropdown: smile
[Discordmoji] insertEmoji called: {element, emoji, triggerPos...}
[Discordmoji] Using contenteditable insertion
[Discordmoji] insertEmojiContentEditable start
[Discordmoji] ContentEditable state: {triggerPos, cursorPosition, queryLength...}
[Discordmoji] Deleting selected text: :smile
[Discordmoji] Inserting emoji via execCommand: 😀
[Discordmoji] Dispatched input events
```

### Common Issues and What the Logs Show

#### Issue: Emoji disappears instead of inserting on Instagram

**What to check in console:**

1. **Element Type:**

   ```
   [Discordmoji] Attached to element: {tagName: "DIV", contentEditable: "true"...}
   ```

   - Confirms we're detecting the input correctly

2. **Trigger Position:**

   ```
   [Discordmoji] ContentEditable state: {triggerPos: 5, cursorPosition: 11, queryLength: 6}
   ```

   - Make sure `queryLength` matches the length of your `:emoji:` text
   - If `triggerPos` is wrong, the deletion will remove the wrong text

3. **Deletion Success:**

   ```
   [Discordmoji] Deleting selected text: :smile
   ```

   - This should show the exact text being deleted
   - If it shows wrong text, the position calculation is off

4. **Insertion Method:**

   ```
   [Discordmoji] Inserting emoji via execCommand: 😀
   ```

   OR

   ```
   [Discordmoji] execCommand failed, trying DOM manipulation
   ```

   - First method uses `execCommand` (better for Instagram)
   - Second method is fallback via direct DOM manipulation

5. **Error Messages:**

   ```
   [Discordmoji] Error in insertEmojiContentEditable: ...
   ```

   - Any errors will be logged here

### Testing Steps for Instagram

1. Go to Instagram Direct Messages
2. Click in a message input box
3. Type `:smile`
4. Press `Shift` to select emoji
5. **Immediately check the console**

### Expected Behavior

The console should show:

1. Element attached (contentEditable div)
2. Search triggered for "smile"
3. Results found (6 emojis)
4. Emoji selected
5. Insertion started
6. Text deleted (`:smile`)
7. Emoji inserted (😀)
8. Input events dispatched

### If It's Not Working

**Share these console logs:**

- Copy the entire console output from when you attach to the element through the insertion attempt
- This will show exactly where the process is failing

**Specifically look for:**

- Any red error messages
- Whether `execCommand` succeeds or falls back to DOM manipulation
- The exact `triggerPos` and `cursorPosition` values
- What text is being deleted

### Advanced Debugging

If you want even more detail, you can modify the source:

In `src/content.js`, add breakpoints or more logging at:

- Line where `insertEmojiContentEditable` is called
- Inside the `try` block where `selection.modify` happens
- Where `document.execCommand` is called

### Known Compatibility

The extension tries two methods:

1. **execCommand method** (preferred):
   - Uses `selection.modify()` to select text
   - Uses `document.execCommand('insertText')` to insert
   - Works best with Instagram/Messenger

2. **DOM manipulation** (fallback):
   - Directly manipulates text nodes
   - Used if execCommand fails
   - More reliable on simple contenteditable

### Report Issues

When reporting issues, please include:

1. Full console log output
2. Website URL
3. Browser version
4. What text you typed (e.g., `:smile`)
5. Expected vs actual result

## Testing Discadia API Integration

The extension now integrates with the Discadia API to provide access to thousands of additional emojis beyond the local 5k emoji database.

### How It Works

When you search for an emoji, the extension:

1. Searches the local emoji database (5000+ emojis) - **PRIORITIZED FIRST**
2. Simultaneously queries the Discadia API in the background
3. Shows all matching local emojis first (by priority: exact → startsWith → contains → keywords)
4. Fills remaining slots with API results (same priority order)
5. Deduplicates results to avoid showing the same emoji twice
6. Caches API results for 5 minutes to reduce network requests

### Search Priority Order

The search results are displayed in this order:

1. **Local exact matches** - emoji names that exactly match your query
2. **Local prefix matches** - emoji names that start with your query
3. **Local substring matches** - emoji names that contain your query
4. **Local keyword matches** - emojis with matching keywords
5. **API exact matches** - only if local results didn't fill all slots
6. **API prefix matches** - and so on...

This ensures local emojis from `discord-emojis.json` always appear first.

### Testing API Integration

Open the browser console and type an emoji query to see both local and API results:

1. Open any text input field
2. Type `:pepe` or `:cat` or any emoji name
3. Check the console for API-related logs
4. You should see emojis from both local data and Discadia
5. **Visual indicators**: Local emojis show a "local" badge, API emojis show an "api" badge

### Expected Console Output

```
[Discordmoji] Searching for emojis: pepe
[Discordmoji] Search results: 30 emojis (local: 2, API: 28)
```

### API Response Format

The Discadia API returns data in this format:

```json
{
  "data": [
    {
      "id": 252576,
      "title": "pepe",
      "emote": "emojis/73d66c44-c29f-4b95-83af-84cf49353fc6.gif",
      "content_id": 1820825235,
      "alt_label": ["scared pepe"],
      "resized_url": "https://emoji.discadia.com/emojis/resized/73d66c44-c29f-4b95-83af-84cf49353fc6_48x48.webp"
    }
  ]
}
```

The extension uses the `emote` field and constructs the full URL as:

```
https://emoji.discadia.com/{emote}
```

For example: `https://emoji.discadia.com/emojis/73d66c44-c29f-4b95-83af-84cf49353fc6.gif`

### Testing API Cache

The API results are cached for 5 minutes:

1. Search for `:pepe` - Note the results
2. Search for `:pepe` again immediately - Should return instantly from cache
3. Check console for cache hit behavior

### Troubleshooting API Issues

If API results are not showing up:

**Check Network Tab:**

1. Open DevTools Network tab
2. Filter for `discadia.com`
3. Search for an emoji
4. You should see a request to `https://discadia.com/api/emojis?q=...`

**Check Console for Warnings:**

```
Discadia API request failed: 429
Error fetching from Discadia API: ...
```

**Common Issues:**

1. **CORS errors** - The API should allow cross-origin requests
2. **Rate limiting** - Discadia may limit requests; the extension uses caching to minimize this
3. **Network errors** - Check your internet connection
4. **Empty results** - Some queries may not have matches in the API

### Manual API Testing

You can test the API directly in your browser:

```
https://discadia.com/api/emojis?q=pepe&limit=100&page=1
```

This should return a JSON response with emoji data.

## CORS and Background Service Worker

### Why We Need a Background Worker

Content scripts run in the context of the web page (e.g., instagram.com) and are subject to CORS (Cross-Origin Resource Sharing) policies. Both the Discadia API and emoji image CDN don't include `Access-Control-Allow-Origin` headers for arbitrary origins.

**The Solution:**

- Background service workers are NOT subject to CORS when the host is in `host_permissions`
- Content script sends messages to background worker for:
  1. API requests to `discadia.com`
  2. Image fetching from `emoji.discadia.com`
- Background worker makes the requests and returns data to content script

### Architecture Flow

```
[User types :pepe]
      |
      v
[content.js]
      |
      v
[emoji-search.js] --message--> [background.js]
      ^                              |
      |                              v
      |                      [Fetch from API]
      |                              |
      <----------response-----------

[User selects emoji]
      |
      v
[content.js] --message--> [background.js]
      ^                        |
      |                        v
      |                [Fetch emoji image]
      |                        |
      <------base64 data-------
```

### Message Format

**API Request (content script → background):**

```javascript
{
  type: 'FETCH_DISCADIA_EMOJIS',
  query: 'pepe',
  limit: 100
}
```

**API Response (background → content script):**

```javascript
{
  success: true,
  data: [...emoji objects...]
}
```

**Image Request (content script → background):**

```javascript
{
  type: 'FETCH_IMAGE_AS_BLOB',
  url: 'https://emoji.discadia.com/emojis/...'
}
```

**Image Response (background → content script):**

```javascript
{
  success: true,
  data: 'data:image/gif;base64,...',
  type: 'image/gif',
  size: 12345
}
```

### Testing Background Worker

1. Open `chrome://extensions/`
2. Find Discordmoji
3. Click "service worker" link to open background console
4. You'll see: `[Discordmoji Background] Service worker initialized`
5. Type an emoji on any page
6. Watch the background console for API requests

### Common CORS Issues

**Error:** `Access to fetch at 'https://discadia.com/...' has been blocked by CORS policy`
**Error:** `Access to fetch at 'https://emoji.discadia.com/...' has been blocked by CORS policy`

**Solution:** Make sure:

1. `src/background.js` exists
2. `manifest.json` includes the background service worker
3. `host_permissions` includes both:
   - `https://discadia.com/*` (for API requests)
   - `https://emoji.discadia.com/*` (for emoji images)
4. Extension has been reloaded after changes

**Note:** Both API requests and image fetching are proxied through the background service worker to bypass CORS restrictions.
