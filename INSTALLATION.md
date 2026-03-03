# Discordmoji - Installation & Testing Guide

## Quick Start

### 1. Install the Extension

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle switch in the top-right corner)
4. Click "Load unpacked" button
5. Select the `discordmoji` folder
6. The extension should now appear in your extensions list

### 2. Verify Installation

Look for the Discordmoji extension in the list. It should show:

- Name: Discordmoji - Discord-style Emoji Picker
- Version: 1.0.0
- Status: Enabled

### 3. Test the Extension

#### Option A: Use the Test Page

1. Open the `test.html` file in your browser:
   - Right-click `test.html` → "Open with" → Chrome
   - Or drag and drop the file into a Chrome window
2. Try typing in any of the input fields:
   - Type `:smile` and you should see emoji suggestions
   - Use arrow keys to navigate, Enter to select
   - Test in all different input types

#### Option B: Test on Any Website

1. Go to any website (e.g., Gmail, Twitter, GitHub)
2. Click in any text input field
3. Type `:` followed by an emoji name
4. The dropdown should appear with suggestions

## Testing Checklist

Use this checklist to verify all features work correctly:

### Basic Functionality

- [ ] Dropdown appears when typing `:` followed by text
- [ ] Dropdown shows relevant emoji suggestions
- [ ] Dropdown disappears when pressing Escape
- [ ] Clicking outside the dropdown closes it

### Keyboard Navigation

- [ ] Arrow Down selects next emoji
- [ ] Arrow Up selects previous emoji
- [ ] Enter key inserts selected emoji
- [ ] Tab key inserts selected emoji
- [ ] Selected emoji is visually highlighted

### Mouse Interaction

- [ ] Hovering over emoji highlights it
- [ ] Clicking emoji inserts it
- [ ] Scrollbar works if more than 6 emojis

### Text Insertion

- [ ] Works in `<input type="text">`
- [ ] Works in `<textarea>`
- [ ] Works in `contenteditable` elements
- [ ] Emoji replaces the `:query` text correctly
- [ ] Cursor position is correct after insertion

### Positioning

- [ ] Dropdown appears near the caret
- [ ] Dropdown stays on screen (doesn't overflow)
- [ ] Dropdown repositions when scrolling
- [ ] Works in scrollable containers

### Search Quality

- [ ] Exact matches appear first
- [ ] Prefix matches work (`:sm` finds `:smile`)
- [ ] Partial matches work (`:art` finds `:heart`)
- [ ] Keyword search works
- [ ] Case insensitive search works

### Edge Cases

- [ ] `:` at start of line works
- [ ] `:` in middle of text works
- [ ] `word:emoji` (no space before) doesn't trigger
- [ ] Very long queries don't crash
- [ ] Queries with spaces don't show dropdown
- [ ] Multiple inputs on same page work independently

## Common Issues & Solutions

### Dropdown Doesn't Appear

**Problem**: No dropdown when typing `:`

**Solutions**:

1. Check the browser console (F12) for errors
2. Verify the extension is enabled at `chrome://extensions/`
3. Reload the page and try again
4. Make sure you're typing in a valid input field

### Emojis Not Inserting

**Problem**: Selecting emoji doesn't insert it

**Solutions**:

1. Check if the site has input restrictions
2. Try on the test.html page to verify it works
3. Check browser console for JavaScript errors
4. Some sites may block content script modifications

### Position Is Wrong

**Problem**: Dropdown appears in wrong location

**Solutions**:

1. Scroll the page and try again (should reposition)
2. Some CSS transforms may affect positioning
3. Report the specific site for investigation

### Extension Not Loading

**Problem**: Extension doesn't appear in chrome://extensions/

**Solutions**:

1. Make sure you selected the correct folder
2. Verify manifest.json is in the root of the folder
3. Check for syntax errors in manifest.json
4. Refresh the extensions page

## Development & Debugging

### Enable Verbose Logging

Open the browser console (F12) and check for:

- "Discordmoji initialized" - confirms extension loaded
- Search results logging
- Error messages

### Inspect the Dropdown

1. Right-click near the dropdown
2. Select "Inspect"
3. Find the `#discordmoji-dropdown` element
4. Check the computed styles and position

### Modify the Code

1. Edit any of the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Discordmoji extension
4. Reload the test page
5. Test your changes

## Performance Testing

### Check Memory Usage

1. Open Chrome Task Manager (Shift + Esc)
2. Find your test page
3. Type emojis repeatedly
4. Memory should remain stable (no leaks)

### Check CPU Usage

1. Type rapidly in an input field
2. Trigger many emoji searches
3. CPU usage should be minimal due to debouncing

## Success Criteria

The extension is working correctly when:

1. All items in the testing checklist pass
2. No console errors appear
3. Emojis insert correctly in all input types
4. Performance is smooth and responsive
5. Dropdown positioning is accurate
6. Keyboard and mouse navigation both work

## Next Steps

### For Production

Before publishing to Chrome Web Store:

1. [ ] Create proper icon images (16px, 48px, 128px)
2. [ ] Test on multiple websites
3. [ ] Test on different screen sizes
4. [ ] Write privacy policy if needed
5. [ ] Take screenshots for store listing
6. [ ] Write compelling store description
7. [ ] Set appropriate pricing/permissions

### For Development

To enhance the extension:

1. Add more emojis to data/emoji-data.json
2. Customize theme in emoji-picker.css
3. Add configuration options
4. Implement favorites/recents
5. Add emoji categories
6. Support custom emoji sets

## Support

If you encounter issues:

1. Check the browser console for errors
2. Test on the included test.html page
3. Verify the extension is enabled
4. Try disabling other extensions
5. Check Chrome version (need 88+)

## Useful Resources

- Chrome Extension Documentation: https://developer.chrome.com/docs/extensions/
- Manifest V3 Migration: https://developer.chrome.com/docs/extensions/mv3/intro/
- Content Scripts Guide: https://developer.chrome.com/docs/extensions/mv3/content_scripts/
