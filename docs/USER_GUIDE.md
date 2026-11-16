# Blockgame Book Studio — User Guide

Welcome to **Blockgame Book Studio**, a dedicated web application for authoring, styling, and formatting Minecraft written books with authentic pixel-perfect rendering.

---

## Table of Contents
1. [Interface Overview](#interface-overview)
2. [Dual Editing Modes](#dual-editing-modes)
3. [Formatting Palette & Swatches](#formatting-palette--swatches)
4. [Utility Tools & Pixel Alignment](#utility-tools--pixel-alignment)
5. [Unicode Matrix Selector & Character Sets](#unicode-matrix-selector--character-sets)
6. [Live Book Preview & Page Navigation](#live-book-preview--page-navigation)
7. [Saved Art & ASCII Pastes Deck](#saved-art--ascii-pastes-deck)
8. [Page & Line Gallery](#page--line-gallery)
9. [Import & Export](#import--export)
10. [Theme & Sound Settings](#theme--sound-settings)

---

## 1. Interface Overview

The interface is structured into three primary areas:
- **Top Header:** Inline editable book title (max 32 chars), Studio Tools Menu (`⚙ Menu ▾`), full-width Unicode Matrix ribbon, and Gallery/Theme toggles.
- **Main 2-Pane Studio:**
  - **Left Pane (Markup Editor):** Line-by-line editor with pixel progress indicators, color swatches, and formatting tools.
  - **Right Pane (Book Preview):** Interactive parchment book renderer with page-flipping buttons, zoom controls, and single/spread view options.
- **Bottom Dock (Saved Art Deck):** Quick-stamp ASCII art presets, borders, and custom saved lines.

---

## 2. Dual Editing Modes

Click **`[Mode: 14 Lines]`** in the editor header to toggle between:
1. **14-Line Book View (Default):**
   - Displays 14 distinct input rows matching the exact 14 lines of a Minecraft book page.
   - Each row features an inline pixel meter showing advance width up to 114px.
   - Pressing <kbd>Enter</kbd> advances to the next row; pressing <kbd>Backspace</kbd> on an empty row retreats to the previous row.
   - Typing long lines automatically cascades text down through subsequent rows without page overflow.
2. **Raw Text View:**
   - A freeform textarea displaying the raw string with `\n` linebreaks and raw formatting codes (`§6`, `§l`).
   - Ideal for pasting multi-line ASCII art, external book text, or bulk editing.

---

## 3. Formatting Palette & Swatches

### 16 Minecraft Colors
Click any numbered color swatch (`0` to `f`) to insert or wrap selected text with Minecraft color codes:
- `§0` Black, `§1` Dark Blue, `§2` Dark Green, `§3` Dark Aqua
- `§4` Dark Red, `§5` Dark Purple, `§6` Gold, `§7` Gray
- `§8` Dark Gray, `§9` Blue, `§a` Green, `§b` Aqua
- `§c` Red, `§d` Light Purple, `§e` Yellow, `§f` White

### Text Styles
- **`B` (Bold - `§l`):** Makes characters bold (+1px glyph advance).
- **`I` (Italic - `§o`):** Slants text horizontally.
- **`U` (Underline - `§n`):** Adds a 1px baseline underline.
- **`S` (Strikethrough - `§m`):** Adds a horizontal center strike line.
- **`?` (Obfuscated - `§k`):** Generates animated shuffling text.
- **`§r` (Reset):** Clears all styles and resets text color.

---

## 4. Utility Tools & Pixel Alignment

Located directly beneath the color swatches:

| Tool | Icon / Name | Function |
|---|---|---|
| **Center Line** | `[≡ Center]` | Prepend optimal spaces to center text within the 114px line. Combines 4px standard spaces and 5px bold spaces (`§l §r`) to balance margins within 1px. Re-clicking automatically re-trims and re-centers. |
| **Fill Margin** | `[⇤⇥ Margin]` | Pads the active line with spaces until it reaches the right margin (114px). |
| **Clean Codes** | `[🧹 Clean]` | Deduplicates redundant formatting codes (e.g. `§6§6` $\to$ `§6`) without breaking intentional line resets. |
| **Copy Page** | `[📋 Copy Page]` | Copies the active page to clipboard (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd>) ready to paste into Minecraft Book &amp; Quill (<kbd>Ctrl</kbd>+<kbd>V</kbd>). Includes dropdown `▾` for Single-Page `/give` command, `&` color codes, or plain text. Also accessible directly in the Book Preview bar and Gallery cards! |
| **Clear Page** | `[🗑 Clear Page]` | Wipes all 14 lines of the current page with 1 click. Safe and non-destructive: press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo anytime. |
| **Save Page/Lines** | `[💾 Save]` | Opens the Save Dialog to store the active line or page layout into your Library and bottom Presets Deck. |

---

## 5. Unicode Matrix Selector & Character Sets

Located in the top bar, the **Matrix Selector** allows you to browse and insert symbols:

### Curated Character Sets
Click any set chip to populate the ribbon:
- **`★ Favs`**: Your personal starred favorites (persisted across sessions).
- **`━ Borders`**: Authentic box-drawing characters for book borders and tables.
- **`⚔ RPG`**: Weapons, armor, tools, and magic symbols.
- **`➔ Arrows`**: Directional arrows and indicators.
- **`█ Blocks`**: Shading tiles, half-blocks, and geometric patterns.
- **`✨ Decor`**: Sparkles, stars, card suits, and flourishes.

### Star / Favorite Any Character
- **Right-click** or **Shift-click** any glyph in the ribbon to toggle it in/out of your `★ Favs` list.

### Pixel Width Stepper
- Use **`▲`** and **`▼`** to filter glyphs by their exact pixel advance width (from 1px up to 12px).
- Use **`◀`** and **`▶`** to page through glyphs of that width.

---

## 6. Live Book Preview & Page Navigation

The right pane provides a live book preview rendered by `blockgame-book-viewer`:
- **Single / Double Spread:** Defaults to focused single-page mode; switch to two-page spread view anytime.
- **Engine Switcher:** Choose **Java (114px)** or **Bedrock (122px)** line wrapping.
- **Page Navigation Toolbar:**
  - `◀`: Retreat to previous page.
  - `Page X / Y`: Displays current page index and total pages.
  - `▶`: Advance to next page. When on the last page, clicking `▶` appends a blank page (up to the Minecraft limit of 100 pages), exactly like vanilla `BookEditScreen`.
- **Zoom Controls:** Zoom in (`+`), zoom out (`−`), or fit to container (`⛶`).
- **Sound Toggle:** Turn authentic vanilla page-turn audio on or off (`🔊` / `🔇`).

---

## 7. Saved Art & ASCII Pastes Deck

Located at the bottom of the screen as a non-intrusive floating drawer:
- **Zero-Resize Drawer:** Expanding or collapsing the deck floats upward without shrinking or resizing the book preview.
- **1-Click Stamping:** Click any preset card or `[📥 Stamp]` to insert it directly into your active page.
- **Filter Chips:** Quickly filter between `[All]`, `[Pages]`, `[Lines]`, and `[My Saves]`.
- **Delete / Hide Controls:**
  - Custom templates can be deleted via `[🗑 Delete]`.
  - Built-in templates can be hidden via `[✕ Hide]`.
  - Hidden defaults can be restored at any time via `[↺ Reset Presets]` in the Gallery modal.

---

## 8. Page & Line Gallery

Click **`[📑 Gallery]`** in the header to open the full organizer:
- **Tab 1: Book Pages:**
  - Visual miniature parchment cards for all pages in your book.
  - Reorder pages with `◀` and `▶` move buttons.
  - Duplicate any page with `[⎘ Dup]`.
  - Copy any page directly to clipboard with `[📋 Copy]`.
  - Delete or clear pages with `[🗑]`.
- **Tab 2: Saved Library:**
  - View all saved templates and snippets.
  - Export entire library to a `.json` backup file.
  - Import external template libraries.
- **Tab 3: Save Current:**
  - Save full pages, active line snippets, or non-empty lines with a custom title.

---

## 9. Import & Export

Click **`[⚙ Menu ▾]`** in the header to access import and export tools:

### Supported Import Formats
- **Stendhal (`.stendhal`)**
- **Modern `/give` Command (SNBT Components)**
- **Legacy `/give` Command**
- **JSON-Pages Command**
- **Scribble JSON**
- **BookCopy JSON**
- **CMI Book Text**

### Supported Export Formats
- **Modern `/give` (Minecraft 1.20.5+ SNBT components)**
- **JSON-Pages `/give` Command**
- **Legacy `/give` Command**
- **Stendhal File (`.stendhal`)**
- **Scribble JSON**
- **BookCopy JSON**
- **CMI Text File**
- **Bedrock JSON**

---

## 10. Theme & Sound Settings

- **Dark & Light Themes:** Click `🌙` / `☀️` in the header to toggle between:
  - **Dark Obsidian (Default):** Soothing dark slate GUI with high legibility and zero glare.
  - **Light Parchment & Stone:** Warm parchment stone GUI resembling classic Minecraft interfaces.
  - Your theme preference is saved automatically in `localStorage`.
- **Sound Effects:** Inlined vanilla Minecraft book open, page turn, and UI click sounds. Toggle anytime with `🔊`.

---

## 11. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> | **Copy Active Page** to clipboard (ready for Minecraft paste) |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>Z</kbd> | **Undo** last change |
| <kbd>Ctrl</kbd> / <kbd>Cmd</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | **Redo** last change |
| <kbd>←</kbd> / <kbd>→</kbd> (when not typing in an input) | **Previous / Next Page** |
| <kbd>Escape</kbd> | Close active dropdown flyouts or modals |
