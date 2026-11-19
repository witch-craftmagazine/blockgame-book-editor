# Blockgame Book Studio Improvements Plan

This document outlines the architecture, specification, and implementation details for the 8 core studio improvements across Blockgame Book Studio (`blockgame-book-editor`), aligned with [`CLAUDE.md`](../blockgame-book-viewer/CLAUDE.md) in the sibling `blockgame-book-viewer` package.

---

## Architecture Overview

The application maintains a synchronized dual-architecture:
1. **Production Standalone Bundle**:
   - [`index.html`](../index.html)
   - [`src/editor.ts`](../src/editor.ts)
   - [`src/editor.css`](../src/editor.css)
2. **Svelte 5 Runes Studio**:
   - [`src/App.svelte`](../src/App.svelte)
   - [`src/components/editor/EditorPanel.svelte`](../src/components/editor/EditorPanel.svelte)
   - [`src/components/editor/FontSwitcherPanel.svelte`](../src/components/editor/FontSwitcherPanel.svelte)
   - [`src/components/preview/PreviewPanel.svelte`](../src/components/preview/PreviewPanel.svelte)
   - [`src/components/layout/BottomDrawer.svelte`](../src/components/layout/BottomDrawer.svelte)
   - [`src/state/bookStore.svelte.ts`](../src/state/bookStore.svelte.ts)
   - [`src/state/libraryStore.svelte.ts`](../src/state/libraryStore.svelte.ts)
   - [`src/state/uiStore.svelte.ts`](../src/state/uiStore.svelte.ts)

All improvements are designed to be applied across both implementations to guarantee 100% feature and visual parity.

---

## 1. Multi-Line Shift-Click Selection Across the Whole Line

### Problem
Previously, multi-line range selection only worked when clicking directly on the `<input type="checkbox" class="line-select-check">`. Clicking anywhere else on the row (or focusing the text input) reset `selectedLineIndices` to a single row, preventing familiar OS file-manager (Finder/Explorer) or DAW (Ableton/Logic) multi-row selection.

### Implementation
- **Row & Gutter Delegation**:
  Attach `mousedown` and `click` handlers to the entire `.book-line-row` container (gutter, line numbers, badge, empty row space).
- **Input Mouse-Down Interception**:
  When clicking inside `<input class="line-input">`, intercept `mousedown`:
  ```typescript
  input.addEventListener('mousedown', (e: MouseEvent) => {
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      e.preventDefault(); // Prevents browser text-caret selection from swallowing row selection
      handleLineSelection(idx, e.shiftKey, e.metaKey || e.ctrlKey, false);
    }
  });
  ```
- **Selection Behavior**:
  - **Plain Click**: Clears previous multi-selection, selects line `idx`, sets `lastClickedLineIndex = idx`.
  - **Shift + Click**: Selects all contiguous lines between `lastClickedLineIndex` and `idx` inclusive.
  - **Cmd / Ctrl + Click**: Toggles line `idx` into or out of the current selection set without clearing other lines.

---

## 2. Unified Color for All Selected Lines

### Problem
In `src/editor.css`, `.book-line-row.active` rendered as Cyan (`rgba(83, 204, 223, 0.14)` and `var(--mc-diamond)`), whereas `.book-line-row.selected` rendered as Bright Green (`rgba(85, 255, 85, 0.14)` and `#55ff55`). When selecting multiple lines, the active line displayed a different color from the rest of the selected lines.

### Implementation
- Standardize `.book-line-row.selected` and `.book-line-row.active.selected` to share the exact same background hue and left indicator bar:
  ```css
  .book-line-row.selected,
  .book-line-row.active.selected {
    background-color: rgba(83, 204, 223, 0.16);
    box-shadow: inset 3px 0 0 var(--mc-diamond, #53ccdf);
  }

  .book-line-row.active:not(.selected) {
    background-color: rgba(255, 255, 255, 0.04);
    box-shadow: inset 3px 0 0 rgba(255, 255, 255, 0.2);
  }
  ```
- Active input text editing continues to show the blinking caret, while row backgrounds remain completely uniform across the entire selection.

---

## 3. Single Save Icon for Multi-Line Selection

### Problem
Every row rendered a `💾` button (`btn-row-save`). Selecting 5 lines rendered 5 identical floppy disk icons in a vertical column, even though clicking any one of them performed the exact same action: saving the entire selection as a single snippet.

### Implementation
- **Conditional Visibility**:
  - When `selectedLineIndices.size <= 1`: Display the save button on the active or hovered row as usual.
  - When `selectedLineIndices.size > 1`: Only display the save button on the **first selected line** (`idx === Math.min(...selectedLineIndices)`). Hide the save icon on all other selected rows.
- **Dynamic Tooltip & Accessible Title**:
  - Single line: `"Save Line X snippet to Saved Art"`
  - Multi-line: `"Save selection (Lines X–Y, N lines) to Saved Art"`

---

## 4. Fix Font Switching & Fullscreen Adaptive Font Buttons

### Root Cause
In `index.html`, `<option>` values in `#font-switcher-select` (`small`, `inverse`, `mathematical_bold_fraktur`, etc.) did not match the IDs defined in `src/data/symbolChatFonts.ts` (`small_caps`, `inverted`, `fraktur`, etc.). Some dropdown options (`negative_squared`, `mathematical_monospace`) did not exist in the font registry at all, causing `getFontById()` to fail or fall back unexpectedly.

### Implementation
- **ID Normalization**:
  Align all font identifiers across `index.html`, `src/editor.ts`, `FontSwitcherPanel.svelte`, and `symbolChatFonts.ts`:
  `['normal', 'small_caps', 'circled', 'fullwidth', 'superscript', 'subscript', 'inverted', 'fraktur', 'double_struck', 'script', 'bold_serif', 'circled_black', 'squared']`.
- **Fullscreen Adaptive Font Buttons**:
  In desktop and fullscreen viewports, fill the available ribbon space with buttons/chips for all 12 fonts (+ Normal).
  - Each chip displays the font name and styled sample:
    `[Normal] [ꜱᴍᴀʟʟ] [Ⓒⓘⓡ] [Ｆｕｌｌ] [ˢᵘᵖ] [ₜₑₓₜ] [ʇxǝʇ] [𝔉𝔯𝔞] [𝔻𝕠𝕦] [𝒮𝒸𝓇] [𝐁𝐨𝐥] [🅐🅑🅒] [🄰🄱🄲]`
  - On compact/mobile viewports, the buttons overflow smoothly into a horizontally scrollable ribbon with edge fade indicators.

---

## 5. Non-Destructive Font Typing (Only New Characters in Font)

### Problem
`onLineInput` and `handleLineInput` previously passed the entire line string (`input.value`) to `transformWithFont(input.value, activeFontId)`. Typing a single character at the end of a line forcibly converted all pre-existing text on that row into the active font.

### Implementation
- **`beforeinput` Stream Transformation**:
  Intercept text insertion before it commits to the DOM:
  ```typescript
  input.addEventListener('beforeinput', (e: InputEvent) => {
    if (activeFontId === 'normal') return;
    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault();
      const transformed = transformWithFont(e.data, activeFontId);
      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const current = input.value;
      input.value = current.slice(0, start) + transformed + current.slice(end);
      const newPos = start + transformed.length;
      input.setSelectionRange(newPos, newPos);
      onLineInput(idx); // Update metrics & line store
    }
  });
  ```
- **Surrogate Pair Safety**:
  Stylized fonts (e.g. Fraktur, Script, Double-Struck) map ASCII characters into Unicode Supplementary Multilingual Planes (SMP `> U+FFFF`). The slice and caret arithmetic respects UTF-16 surrogate pairs (`transformed.length` can be 2 code units per glyph), ensuring characters are never split.
- Existing characters in the row remain completely preserved.

---

## 6. Merge Saved Art & ASCII Pastes with History

### Architectural Scope Separation
Line and multi-line snippets previously saved into `blockgame_book_history_v1` as `createHistorySnapshot('snippet', ...)`, polluting temporal book and page version history.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LIBRARY & RESTORE HUB                         │
├────────────────────────────────────┬───────────────────────────────────┤
│    🎨 SAVED ART & ASCII PASTES     │      ⏱ BOOK & PAGE HISTORY        │
│    (Reusable Content Blocks)       │      (Temporal Rollback State)    │
├────────────────────────────────────┼───────────────────────────────────┤
│ • Presets (Banners, Boxes, Stars)  │ • Full Book Snapshots (All pages) │
│ • Custom Saved Line Snippets       │ • Page State Snapshots (14 lines) │
│ • Custom Saved Page Templates      │ • Autosave Timeline               │
│ • Insert / Stamp into current book │ • Revert / Restore whole page     │
└────────────────────────────────────┴───────────────────────────────────┘
```

### Implementation
1. **Reroute Saved Snippets**:
   - When clicking `💾` on a line or multi-line selection, save directly to `libraryStore.addCustomTemplate()` (and `savedTemplates` in `editor.ts`) with `scope: 'lines'` and `category: 'Snippet'`.
   - Toast message: `Saved "Snippet: Lines X-Y" to Saved Art`.
   - The snippet immediately renders in the **Saved Art & ASCII Pastes** deck under the **Lines** and **My Saves** tabs.
2. **Purify History**:
   - Restrict History snapshots exclusively to `'book'` (title, author, pages array) and `'page'` (14 lines of current page, autosave checkpoints).
   - Migrate any existing `'snippet'` records from `blockgame_book_history_v1` into `blockgame_saved_art`.
3. **Unified Navigation**:
   - Bottom Drawer / Deck: Quick-insert modular snippets, ASCII art, and page presets.
   - History Modal: Revert or compare book and page revision checkpoints.

---

## 7. Hide Single/Double Page View Toggle to Fix Copy Page Overflow

### Problem
The preview panel toolbar packed Single/Double view toggles, rendering engine selector, page navigation, `📋 Copy Page` split button, and zoom controls into a single row. On standard desktop displays, this forced the Copy Page button to overflow or clip.

### Implementation
- Hide the Single/Double page toggle buttons in `index.html` and `PreviewPanel.svelte` (`display: none`).
- Default view mode remains standard 1-page (`single`), which aligns with the 14-line editor view.
- Hiding this control recovers ~120px of horizontal toolbar space, providing ample room for `📋 Copy Page` and its dropdown menu options (`Minecraft Book & Quill paste`, `Modern /give`, `& formatting codes`).

---

## 8. Remove "Transform Lines" from Font Switcher Panel

### Justification
As detailed in [`CLAUDE.md`](../blockgame-book-viewer/CLAUDE.md), Minecraft text layout resolves glyph pixel advances with strict provider precedence:
- Standard ASCII / Unifont glyphs: 2–6px advance.
- Fullwidth glyphs: 8–9px advance.
- Small Caps / Subscripts: 3–5px advance.
- SMP stylized glyphs: 6–9px advance.

Retroactively converting a formatted line alters character advances, causing lines that were calibrated to 110–114px to overflow past the 114px boundary into phantom wrapped lines.

### Implementation
- Remove `#btn-font-apply-selection` ("⚡ Transform Lines") from `index.html` and `FontSwitcherPanel.svelte`.
- Remove `applyFontToSelection()` logic and event listeners from `src/editor.ts` and `FontSwitcherPanel.svelte`.
- Update test cases in `tests/editor.test.ts`.

---

## Testing & Quality Assurance

- **Unit Tests (`bun test`)**:
  - Shift-click selection range calculations across line rows.
  - `beforeinput` font character transformation without mutating surrounding text.
  - Snippet persistence strictly into `libraryStore` (`SavedTemplate`, `scope: 'lines'`).
  - History snapshots restricted to `page` and `book` scopes.
  - Complete parity of all 12 fonts in `SYMBOL_CHAT_FONTS`.
- **Minecraft Mechanics Parity**:
  - Strict 114px line boundary (Java) and 122px (Bedrock).
  - Exact 14 lines per page and 1024 character limits.
