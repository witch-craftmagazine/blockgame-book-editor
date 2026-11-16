/**
 * Blockgame Book Studio — Main Editor Application
 *
 * Built with blockgame-book-viewer
 */

import 'blockgame-book-viewer/style.css';
import {
  BlockgameBookViewer,
  parseBook,
  exportToStendhal,
  exportToGiveCommandModern,
  exportToGiveCommandJsonPages,
  exportToGiveCommandLegacy,
  exportToScribbleJson,
  exportToBookCopyJson,
  exportToCmiText,
  exportToBedrockJson,
  measureLineWidth,
  BOOK_TEXT_WIDTH,
  BEDROCK_BOOK_TEXT_WIDTH,
  parseFormattedText,
  stripFormatting,
  soundManager,
  MINECRAFT_LINES_PER_PAGE,
  MINECRAFT_PAGE_MAX_CHARS,
  MINECRAFT_MAX_PAGES,
  JAVA_MAX_CHARS_PER_PAGE,
  BEDROCK_MAX_CHARS_PER_PAGE,
  detectUnsupportedMinecraftChars,
  solveBoldSpaces,
  centerLineText,
  formatSinglePage,
  type SinglePageExportFormat,
  type BlockgameBook,
  type BookEngine,
  type ViewMode,
} from 'blockgame-book-viewer';
import {
  ALL_GLYPHS,
  GLYPHS_BY_CATEGORY,
  findGlyphItem,
  type GlyphCategory,
  type GlyphItem,
} from './data/symbolChatDataset';
import {
  SYMBOL_CHAT_FONTS,
  getFontById,
} from './data/symbolChatFonts';
import {
  ensureAtlasLoaded,
  renderGlyphToCanvas,
  getCharPixelAdvance,
} from './components/glyphs/glyphRenderer';

// Re-export canonical constants for backwards compatibility with tests and callers
export {
  MINECRAFT_LINES_PER_PAGE,
  MINECRAFT_PAGE_MAX_CHARS,
  MINECRAFT_MAX_PAGES,
  JAVA_MAX_CHARS_PER_PAGE,
  BEDROCK_MAX_CHARS_PER_PAGE,
  detectUnsupportedMinecraftChars,
  centerLineText,
};

const AUTOSAVE_KEY = 'blockgame-book-studio:autosave';
const MAX_UNDO_HISTORY = 40;

// ─── App State ────────────────────────────────────────────────────────────────

interface UndoSnapshot {
  book: BlockgameBook;
  pageIndex: number;
}

let book: BlockgameBook = {
  title: 'My Book',
  author: 'Author',
  pages: ['§6§lWelcome to the Book!§r\n\nEdit this page using the toolbar or type §-codes directly.'],
};

let currentPageIndex = 0;
let currentLines: string[] = Array(MINECRAFT_LINES_PER_PAGE).fill('');
let activeLineIndex = 0;
let isRawMode = false;

let engine: BookEngine = 'java';
let viewMode: ViewMode = 'single';
let currentZoom = 1.0;
let soundEnabled = true;

let viewer: BlockgameBookViewer | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

// Undo / Redo Stacks
const undoStack: UndoSnapshot[] = [];
const redoStack: UndoSnapshot[] = [];
let isApplyingHistory = false;

// ─── Line Calculation & Serialization Helpers ─────────────────────────────────

/**
 * Serializes lines into the book page text string.
 * Retains empty lines from index 0 up to the last non-empty line as '\n'.
 * For instance, typing on Row 5 (index 4) with rows 1-4 blank outputs:
 * "\n\n\n\nRow 5 text", ensuring the first 4 lines in Minecraft are blank.
 */
export function getPageTextFromLines(lines: string[]): string {
  const sliced = lines.slice(0, MINECRAFT_LINES_PER_PAGE);
  let lastNonEmpty = -1;
  for (let i = sliced.length - 1; i >= 0; i--) {
    if (sliced[i] && sliced[i].length > 0) {
      lastNonEmpty = i;
      break;
    }
  }
  if (lastNonEmpty === -1) {
    return '';
  }
  return sliced.slice(0, lastNonEmpty + 1).join('\n');
}

/**
 * Deserializes book page text into an array of exactly 14 lines.
 * Leading newlines produce blank lines in their respective line slots.
 */
export function getLinesFromPageText(pageText: string): string[] {
  const lines: string[] = Array(MINECRAFT_LINES_PER_PAGE).fill('');
  if (!pageText) return lines;
  const raw = pageText.split('\n');
  for (let i = 0; i < Math.min(MINECRAFT_LINES_PER_PAGE, raw.length); i++) {
    lines[i] = raw[i];
  }
  return lines;
}

export type PageCopyFormat = SinglePageExportFormat;

/**
 * Formats a single page's lines for copying into Minecraft or external tools.
 * Delegated to blockgame-book-viewer engine.
 */
export function formatPageForClipboard(
  pageLines: string[],
  format: PageCopyFormat = 'raw',
  bookMeta: { title?: string; author?: string } = {}
): string {
  const pageText = getPageTextFromLines(pageLines);
  return formatSinglePage(pageText, format, bookMeta);
}

/**
 * Robust clipboard writer supporting navigator.clipboard with fallback to document.execCommand.
 */
export async function writeTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
  }
  if (typeof document !== 'undefined') {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.pointerEvents = 'none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const success = document.execCommand('copy');
      document.body.removeChild(ta);
      return success;
    } catch {}
  }
  return false;
}

/**
 * Copies the active page in the requested format to the clipboard with toast feedback.
 */
export async function copyPageToClipboard(
  format: PageCopyFormat = 'raw',
  showNotification = true
): Promise<boolean> {
  saveCurrentPageToBook();
  const text = formatPageForClipboard(currentLines, format, {
    title: book.title || 'Page Preview',
    author: book.author || 'Player',
  });

  if (!text) {
    if (showNotification) showToast(`Page ${currentPageIndex + 1} is empty`, 'info');
    return false;
  }

  const ok = await writeTextToClipboard(text);
  if (ok && showNotification) {
    const labels: Record<PageCopyFormat, string> = {
      raw: 'Book & Quill text (§ codes)',
      ampersand: 'Plugin text (& codes)',
      give: 'Single-page /give command',
      plain: 'Plain text (no formatting)',
    };
    showToast(`Copied Page ${currentPageIndex + 1} (${labels[format]}) to clipboard!`, 'success');
  } else if (!ok && showNotification) {
    showToast('Failed to copy to clipboard', 'warn');
  }
  return ok;
}

/**
 * Computes carried formatting styles across lines up to targetLineIdx.
 */
export function getCarriedStyleForLine(lines: string[], targetLineIdx: number) {
  const style = {
    color: '#000000',
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false,
  };
  for (let l = 0; l < Math.min(lines.length, targetLineIdx); l++) {
    parseFormattedText(lines[l] ?? '', style);
  }
  return style;
}

/**
 * Returns total serialized character count of the page.
 */
export function getTotalPageChars(lines: string[]): number {
  return getPageTextFromLines(lines).length;
}

/**
 * Finds the optimal break point for a line exceeding maxWidth.
 * Breaks at the last whitespace before maxWidth, or at the character boundary
 * if a single non-space word exceeds maxWidth by itself.
 */
export function splitLineAtOverflow(
  text: string,
  initialStyle = { color: '#000000', bold: false, italic: false, underlined: false, strikethrough: false, obfuscated: false },
  maxWidth = BOOK_TEXT_WIDTH
): { head: string; tail: string; brokeAtSpace: boolean } {
  let lastSpaceIdx = -1;
  let bestFitIdx = 0;

  for (let i = 1; i <= text.length; i++) {
    const sub = text.slice(0, i);
    const subStyle = { ...initialStyle };
    const w = measureLineWidth(parseFormattedText(sub, subStyle));
    if (w <= maxWidth) {
      bestFitIdx = i;
      if (text[i - 1] === ' ') {
        lastSpaceIdx = i - 1;
      }
    } else {
      break;
    }
  }

  if (lastSpaceIdx > 0) {
    return {
      head: text.slice(0, lastSpaceIdx),
      tail: text.slice(lastSpaceIdx + 1),
      brokeAtSpace: true,
    };
  }

  return {
    head: text.slice(0, bestFitIdx),
    tail: text.slice(bestFitIdx),
    brokeAtSpace: false,
  };
}

/**
 * Reflows lines starting from startLineIdx down to line 14.
 * When a line exceeds maxWidth, its overflow moves to the next line.
 * If line 14 exceeds maxWidth, excess is truncated to prevent exceeding 14 lines.
 */
export function reflowPageLines(
  rawLines: string[],
  startLineIdx = 0,
  maxWidth = BOOK_TEXT_WIDTH,
  maxLines = MINECRAFT_LINES_PER_PAGE
): { lines: string[]; truncated: boolean } {
  const lines = rawLines.slice(0, maxLines);
  while (lines.length < maxLines) lines.push('');
  let truncated = false;

  const carried = getCarriedStyleForLine(lines, startLineIdx);

  for (let i = startLineIdx; i < maxLines; i++) {
    const lineStyle = { ...carried };
    const w = measureLineWidth(parseFormattedText(lines[i] ?? '', lineStyle));
    if (w > maxWidth) {
      const { head, tail } = splitLineAtOverflow(lines[i] ?? '', carried, maxWidth);
      lines[i] = head;
      if (i + 1 < maxLines) {
        lines[i + 1] = tail + (lines[i + 1] ? (lines[i + 1].startsWith(' ') ? '' : ' ') + lines[i + 1] : '');
      } else {
        truncated = true;
      }
    }
    parseFormattedText(lines[i] ?? '', carried);
  }

  return { lines, truncated };
}

// ─── Page & Line Gallery Models and Templates ────────────────────────────────

export interface SavedTemplate {
  id: string;
  title: string;
  scope: 'page' | 'lines';
  category: string;
  lines: string[];
  createdAt: number;
  isPreset?: boolean;
}

const GALLERY_STORAGE_KEY = 'blockgame_book_gallery_templates';

export const DEFAULT_PRESETS: SavedTemplate[] = [
  {
    id: 'preset-chapter-header',
    title: 'Chapter Header Banner',
    scope: 'lines',
    category: 'Header',
    lines: [
      '§6§l━━━━━━━━━━━━━━━',
      '§r§0§l   CHAPTER I',
      '§3§o  The Awakening',
      '§6§l━━━━━━━━━━━━━━━',
    ],
    createdAt: 1700000000000,
    isPreset: true,
  },
  {
    id: 'preset-toc-page',
    title: 'Table of Contents Page',
    scope: 'page',
    category: 'Table of Contents',
    lines: [
      '§0§lTABLE OF CONTENTS',
      '§8§m                 ',
      '§01. Introduction....§801',
      '§02. The Journey.....§804',
      '§03. Enchantments....§812',
      '§04. Nether Secrets..§818',
      '§05. Epilogue........§824',
      '',
      '',
      '',
      '',
      '',
      '',
      '§8§o-- Continued on p.2 --',
    ],
    createdAt: 1700000000001,
    isPreset: true,
  },
  {
    id: 'preset-boxed-border',
    title: 'Parchment Box Border',
    scope: 'lines',
    category: 'Divider / Border',
    lines: [
      '§1╔═════════════╗',
      '§1║ §0Official Notice§1║',
      '§1╚═════════════╝',
    ],
    createdAt: 1700000000002,
    isPreset: true,
  },
  {
    id: 'preset-decorative-star',
    title: 'Decorative Star Divider',
    scope: 'lines',
    category: 'Divider / Border',
    lines: [
      '§6§l---✦ ★ ✦---',
    ],
    createdAt: 1700000000003,
    isPreset: true,
  },
  {
    id: 'preset-signature-block',
    title: 'Author Signature Block',
    scope: 'lines',
    category: 'Signature',
    lines: [
      '',
      '§8§oRecorded by:',
      '§0§lThe Grand Archivist',
      '§8§oRealm of Craft',
    ],
    createdAt: 1700000000004,
    isPreset: true,
  },
  {
    id: 'preset-rules-page',
    title: 'Server Rules & Codex',
    scope: 'page',
    category: 'Page Layout',
    lines: [
      '§4§l   SERVER CODEX',
      '§8§m                 ',
      '§0§l1. §r§0No griefing',
      '§0§l2. §r§0Respect builds',
      '§0§l3. §r§0Fair trading',
      '§0§l4. §r§0Keep chat clean',
      '§0§l5. §r§0PvP in arenas only',
      '',
      '',
      '',
      '',
      '',
      '§8§oViolations lead to ban.',
      '§8Signed by: §0Staff',
    ],
    createdAt: 1700000000005,
    isPreset: true,
  },
];

export let savedTemplates: SavedTemplate[] = [];
export let activeGalleryTab: 'pages' | 'library' | 'save' = 'pages';
export let activeLibraryFilter: 'all' | 'page' | 'lines' | 'preset' | 'custom' = 'all';

export function loadSavedTemplates(): SavedTemplate[] {
  if (typeof localStorage === 'undefined') return [...DEFAULT_PRESETS];
  try {
    const raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return [...DEFAULT_PRESETS];
    const userItems: SavedTemplate[] = JSON.parse(raw);
    return [...DEFAULT_PRESETS, ...userItems];
  } catch {
    return [...DEFAULT_PRESETS];
  }
}

export function saveUserTemplates(templates: SavedTemplate[]): void {
  if (typeof localStorage === 'undefined') return;
  const userItems = templates.filter(t => !t.isPreset);
  localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(userItems));
}

export function renderFormattedMiniLine(rawText: string): HTMLElement {
  const lineDiv = document.createElement('div');
  lineDiv.className = 'parchment-mini-line';
  if (!rawText || !rawText.trim()) {
    lineDiv.classList.add('empty-line');
    lineDiv.textContent = '·';
    return lineDiv;
  }
  const spans = parseFormattedText(rawText);
  for (const span of spans) {
    const s = document.createElement('span');
    s.textContent = span.text;
    if (span.color) s.style.color = span.color;
    if (span.bold) s.style.fontWeight = 'bold';
    if (span.italic) s.style.fontStyle = 'italic';
    if (span.underlined) s.style.textDecoration = 'underline';
    if (span.strikethrough) s.style.textDecoration = 'line-through';
    lineDiv.appendChild(s);
  }
  return lineDiv;
}

export function updateGalleryCounts(): void {
  if (galleryTabPageCount) galleryTabPageCount.textContent = book.pages.length.toString();
  if (galleryTabLibCount) galleryTabLibCount.textContent = savedTemplates.length.toString();
}

// ─── Preset & Hidden Presets Management ──────────────────────────────────────

const HIDDEN_PRESETS_KEY = 'blockgame_hidden_presets';

export function getHiddenPresetIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(HIDDEN_PRESETS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveHiddenPresetIds(ids: Set<string>): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(HIDDEN_PRESETS_KEY, JSON.stringify(Array.from(ids)));
}

// ─── Minecraft Unicode & Emoji Compatibility Checker ─────────────────────────

// ─── Unicode Pixel-Width Matrix Catalog & Character Sets ─────────────────────

export interface GlyphSet {
  id: string;
  name: string;
  glyphs: string[];
}

export const CHARACTER_SETS: Record<string, GlyphSet> = {
  fav: {
    id: 'fav',
    name: '★ Favs',
    glyphs: ['★', '✦', '✧', '═', '║', '╔', '╗', '╚', '╝', '─', '│', '⚔', '⛏', '⚒', '⚖', '⚜', '⚡', '☕', '☠', '☘', '❄', '✓', '✕', '•'],
  },
  borders: {
    id: 'borders',
    name: '━ Borders',
    glyphs: ['━', '┃', '┏', '┓', '┗', '┛', '═', '║', '╔', '╗', '╚', '╝', '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼', '╂', '╫', '╬', '╒', '╕', '╘', '╛'],
  },
  rpg: {
    id: 'rpg',
    name: '⚔ RPG',
    glyphs: ['⚔', '⛏', '⚒', '⚖', '⚗', '⚙', '⚚', '⚛', '⚜', '⚡', '☕', '☠', '⚰', '⚱', '☘', '❄', '♟', '♔', '♕', '⛨', '♈', '✡', '☯', '☸', '⚓', '⌛'],
  },
  arrows: {
    id: 'arrows',
    name: '➔ Arrows',
    glyphs: ['➔', '➜', '◄', '►', '▲', '▼', '◀', '▶', '←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '⇦', '⇨', '↺', '↻', '⇄', '⇅', '↞', '↠'],
  },
  blocks: {
    id: 'blocks',
    name: '█ Blocks',
    glyphs: ['█', '▓', '▒', '░', '▀', '▄', '▌', '▐', '■', '□', '▪', '▫', '▬', '▭', '▮', '▯', '▰', '▱', '◆', '◇', '◈', '◉', '◊', '○', '●', '◐', '◑'],
  },
  decor: {
    id: 'decor',
    name: '✨ Decor',
    glyphs: ['✨', '★', '☆', '✦', '✧', '✪', '✫', '✯', '☄', '☽', '☾', '☉', '♨', '☕', '✉', '✂', '✎', '✒', '✓', '✕', '•', '·', '°', '※', '❦', '❧'],
  },
};

const USER_FAV_GLYPHS_KEY = 'blockgame_user_fav_glyphs';

export function loadUserFavoriteGlyphs(): string[] {
  if (typeof localStorage === 'undefined') return [...CHARACTER_SETS.fav.glyphs];
  try {
    const raw = localStorage.getItem(USER_FAV_GLYPHS_KEY);
    if (!raw) return [...CHARACTER_SETS.fav.glyphs];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [...CHARACTER_SETS.fav.glyphs];
  } catch {
    return [...CHARACTER_SETS.fav.glyphs];
  }
}

export function saveUserFavoriteGlyphs(glyphs: string[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(USER_FAV_GLYPHS_KEY, JSON.stringify(glyphs));
}

export let userFavoriteGlyphs: string[] = loadUserFavoriteGlyphs();

// Authentic Minecraft Java BMP Glyphs (All <= 0xFFFF, 100% renderable in vanilla Java Edition)
export const GLYPH_CATALOG_BY_WIDTH: Record<number, string[]> = {
  1: ['\u200A', '\u200B'],
  2: ['!', '\'', '|', 'l', 'i', '.', ',', ';', ':', '`', '¦', '¡', '│', '╵', '╷'],
  3: [' ', '[', ']', 'I', 't', '°', '·', '¹', '²', '³', '‹', '›', 'ᛏ'],
  4: ['"', '*', '(', ')', '<', '>', '{', '}', 'k', '«', '»', '•', '¤', '†', '‡', 'ᚲ'],
  5: ['f', 'r', 'x', '~', '=', '+', '^', '-', '¬', '±', 'µ', '§', '¢', '£', '¥', '€', 'ᛋ', 'ᛚ'],
  6: [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'g', 'h', 'j', 'm', 'n', 'o', 'p', 'q',
    's', 'u', 'v', 'w', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    '?', '$', '#', '&', '@', '%', '/', '\\', '_',
    '©', '®', '¶', '¿', 'ᛃ', 'ᛈ'
  ],
  7: ['—', '–', '≈', '≠', '≤', '≥', '¿', '‰', 'ᛞ', 'ᛟ'],
  8: [
    '★', '☆', '✦', '✧', '✪', '✫', '✯', '⚡', '☄', '☽', '☾', '☉', '♨', '☕',
    '☠', '⚰', '⚱', '☘', '❄', '⚔', '⛏', '⚒', '⚖', '⚗', '⚙', '⚚', '⚛', '⚜', '⚓',
    '▲', '▼', '◄', '►', '◆', '◇', '○', '●', '■', '□', '♠', '♣', '♥', '♦'
  ],
  9: [
    '─', '│', '┌', '┐', '└', '┘', '├', '┤', '┬', '┴', '┼',
    '═', '║', '╒', '╓', '╔', '╕', '╖', '╗', '╘', '╙', '╚', '╛', '╜', '╝',
    '╞', '╟', '╠', '╡', '╢', '╣', '╤', '╥', '╦', '╧', '╨', '╩', '╪', '╫', '╬',
    '━', '┃', '┏', '┓', '┗', '┛',
    '▀', ' ', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▉', '▊', '▋', '▌', '▍', '▎', '▏', '▐', '░', '▒', '▓'
  ],
  10: ['←', '→', '↑', '↓', '↔', '↕', '↖', '↗', '↘', '↙', '↚', '↛', '↜', '↝', '↞', '↠', '↢', '↣', '➔', '➜'],
  12: ['【', '】', '『', '』', '「', '」', '《', '》', '〈', '〉', '〔', '〕'],
};

export const FAVORITES_LIST = ['★', '✦', '✧', '═', '║', '╔', '╗', '╚', '╝', '⚔', '⛏', '⚒', '⚜', '─', '│', '☘', '•', '✓', '✕'];
export const WIDTH_STEPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];

export type MatrixMode = { type: 'set'; setId: string } | { type: 'width'; px: number };
export let currentMatrixMode: MatrixMode = { type: 'set', setId: 'fav' };
export let currentMatrixPage = 0;
export const MATRIX_PAGE_SIZE = 14;

export function getGlyphsForCurrentSelection(): string[] {
  if (currentMatrixMode.type === 'set') {
    if (currentMatrixMode.setId === 'fav') return userFavoriteGlyphs;
    return CHARACTER_SETS[currentMatrixMode.setId]?.glyphs || [];
  }
  return GLYPH_CATALOG_BY_WIDTH[currentMatrixMode.px] || [];
}

export function renderMatrixSlots(): void {
  if (!matrixSlotsRibbon) return;
  matrixSlotsRibbon.innerHTML = '';

  const list = getGlyphsForCurrentSelection();
  const totalPages = Math.max(1, Math.ceil(list.length / MATRIX_PAGE_SIZE));
  if (currentMatrixPage >= totalPages) currentMatrixPage = 0;

  if (matrixPxValue) {
    if (currentMatrixMode.type === 'set') {
      const activeSet = CHARACTER_SETS[currentMatrixMode.setId];
      matrixPxValue.textContent = activeSet ? activeSet.name.split(' ')[0]! : '★';
    } else {
      matrixPxValue.textContent = currentMatrixMode.px.toString();
    }
  }

  const matrixUnit = document.querySelector('.matrix-unit') as HTMLElement;
  if (matrixUnit) {
    matrixUnit.textContent = currentMatrixMode.type === 'set' ? 'set' : 'px';
  }

  if (matrixPageLabel) {
    matrixPageLabel.textContent = `${currentMatrixPage + 1}/${totalPages}`;
  }

  const startIdx = currentMatrixPage * MATRIX_PAGE_SIZE;
  const pageItems = list.slice(startIdx, startIdx + MATRIX_PAGE_SIZE);

  pageItems.forEach((ch) => {
    const slot = document.createElement('div');
    slot.className = 'matrix-glyph-slot';
    slot.textContent = ch === '\u200A' ? '␠' : ch;
    const pxAdvance = measureLineWidth(parseFormattedText(ch));
    slot.title = `Char: "${ch}" (${pxAdvance}px advance) • Click to insert • Right-click to toggle Favorite`;

    if (userFavoriteGlyphs.includes(ch)) {
      slot.classList.add('slot-starred');
    }

    slot.addEventListener('click', () => {
      insertAtCursor(ch);
      soundManager.playButtonClick();
      showToast(`Inserted "${ch}" (${pxAdvance}px)`, 'info');
    });

    slot.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      toggleFavoriteGlyph(ch);
    });

    matrixSlotsRibbon.appendChild(slot);
  });
}

export function toggleFavoriteGlyph(glyph: string): void {
  const idx = userFavoriteGlyphs.indexOf(glyph);
  if (idx !== -1) {
    userFavoriteGlyphs.splice(idx, 1);
    showToast(`Removed "${glyph}" from Favorites`, 'info');
  } else {
    userFavoriteGlyphs.push(glyph);
    showToast(`Added "${glyph}" to Favorites`, 'success');
  }
  saveUserFavoriteGlyphs(userFavoriteGlyphs);
  renderMatrixSlots();
}

// ─── DOM References ──────────────────────────────────────────────────────────

let textarea: HTMLTextAreaElement;
let bookLinesList: HTMLElement;
let lineRowEls: HTMLElement[] = [];
let lineInputEls: HTMLInputElement[] = [];
let lineGutterNumEls: HTMLElement[] = [];
let lineGutterFillEls: HTMLElement[] = [];
let lineGutterBadgeEls: HTMLElement[] = [];
let btnToggleEditorMode: HTMLButtonElement;

let metaTitle: HTMLInputElement;
let metaAuthor: HTMLInputElement;
let metaTitleCount: HTMLElement;
let metaAuthorCount: HTMLElement;
let pageBadge: HTMLElement;
let previewIndicator: HTMLElement | null = null;
let zoomLabel: HTMLElement;
let statChars: HTMLElement;
let statWords: HTMLElement;
let statLines: HTMLElement;
let statPixelsLeft: HTMLElement;
let diagSummary: HTMLElement;
let rulerTargetWidth: HTMLElement;
let viewerContainer: HTMLElement;
let autosaveText: HTMLElement;
let autosaveDot: HTMLElement;
let toastContainer: HTMLElement;

// Buttons
let btnUndo: HTMLButtonElement;
let btnRedo: HTMLButtonElement;
let btnOpenGallery: HTMLButtonElement;
let btnSaveGallery: HTMLButtonElement;
let btnOpenGalleryTool: HTMLButtonElement;
let btnCenterLine: HTMLButtonElement;
let btnFillMargin: HTMLButtonElement;
let btnDedupCodes: HTMLButtonElement;
let btnClearPage: HTMLButtonElement;
let btnCopyPage: HTMLButtonElement;
let btnCopyPageOpts: HTMLButtonElement;
let copyPageWrapper: HTMLElement | null;
let copyPageMenu: HTMLElement | null;
let btnPreviewCopyPage: HTMLButtonElement | null;
let btnPrevPage: HTMLButtonElement;
let btnNextPage: HTMLButtonElement;
let btnZoomIn: HTMLButtonElement;
let btnZoomOut: HTMLButtonElement;
let btnZoomFit: HTMLButtonElement;
let btnSoundToggle: HTMLButtonElement;
let viewModeSingle: HTMLButtonElement;
let viewModeDouble: HTMLButtonElement;
let engineSelect: HTMLSelectElement;

// Dialogs & Gallery
let importDialog: HTMLDialogElement;
let importTextarea: HTMLTextAreaElement;
let exportDialog: HTMLDialogElement;
let exportFormatsEl: HTMLElement;
let glyphDialog: HTMLDialogElement;
let glyphGrid: HTMLElement;
let glyphSearch: HTMLInputElement;
let glyphTabs: HTMLElement;
let glyphCustomInput: HTMLInputElement;
let glyphCustomWidth: HTMLElement;
let glyphCustomInsertBtn: HTMLButtonElement;

// Gallery Modal Elements
let galleryDialog: HTMLDialogElement;
let galleryTabsNav: HTMLElement;
let galleryTabPageCount: HTMLElement;
let galleryTabLibCount: HTMLElement;
let galleryPanePages: HTMLElement;
let galleryPaneLibrary: HTMLElement;
let galleryPaneSave: HTMLElement;
let btnGalleryAddBlank: HTMLButtonElement;
let btnGalleryDupActive: HTMLButtonElement;
let galleryPagesGrid: HTMLElement;
let galleryFilterChips: HTMLElement;
let btnGallerySwitchSave: HTMLButtonElement;
let btnGalleryExportLib: HTMLButtonElement;
let btnGalleryImportLib: HTMLButtonElement;
let galleryImportFileInput: HTMLInputElement;
let galleryTemplatesGrid: HTMLElement;
let saveItemTitle: HTMLInputElement;
let saveItemCategory: HTMLSelectElement;
let gallerySavePreview: HTMLElement;
let btnCancelSaveGallery: HTMLButtonElement;
let btnConfirmSaveGallery: HTMLButtonElement;

// Top Matrix Selector & Hub
let btnStudioTools: HTMLButtonElement;
let studioToolsFlyout: HTMLElement;
let btnCloseToolsFlyout: HTMLButtonElement;
let matrixPxUp: HTMLButtonElement;
let matrixPxDown: HTMLButtonElement;
let matrixPxValue: HTMLElement;
let matrixPagePrev: HTMLButtonElement;
let matrixPageNext: HTMLButtonElement;
let matrixPageLabel: HTMLElement;
let matrixSlotsRibbon: HTMLElement;
let matrixQuickWidths: HTMLElement;

// Collapsible Saved Art Deck
let savedArtDeck: HTMLElement;
let btnDeckToggle: HTMLButtonElement;
let deckToggleIcon: HTMLElement;
let deckToggleText: HTMLElement;
let deckTitleToggle: HTMLElement;
let deckPastesStrip: HTMLElement;
let btnDeckSaveRow: HTMLButtonElement;
let btnDeckSavePage: HTMLButtonElement;
let btnDeckOpenGallery: HTMLButtonElement;

function initDOM(): void {
  if (typeof document === 'undefined') return;

  textarea            = document.getElementById('page-textarea')         as HTMLTextAreaElement;
  bookLinesList       = document.getElementById('book-lines-list')       as HTMLElement;
  btnToggleEditorMode = document.getElementById('btn-toggle-editor-mode') as HTMLButtonElement;

  metaTitle           = document.getElementById('meta-title')            as HTMLInputElement;
  metaAuthor          = document.getElementById('meta-author')           as HTMLInputElement;
  metaTitleCount      = document.getElementById('meta-title-count')!;
  metaAuthorCount     = document.getElementById('meta-author-count')!;
  pageBadge           = document.getElementById('page-badge')!;
  previewIndicator    = document.getElementById('preview-page-indicator');
  zoomLabel           = document.getElementById('zoom-label')!;
  statChars           = document.getElementById('stat-chars')!;
  statWords           = document.getElementById('stat-words')!;
  statLines           = document.getElementById('stat-lines')!;
  statPixelsLeft      = document.getElementById('stat-pixels-left')!;
  diagSummary         = document.getElementById('diag-summary')!;
  rulerTargetWidth    = document.getElementById('ruler-target-width')!;
  viewerContainer     = document.getElementById('viewer-container')      as HTMLElement;
  autosaveText        = document.getElementById('autosave-text')!;
  autosaveDot         = document.querySelector('.status-dot')            as HTMLElement;
  toastContainer      = document.getElementById('toast-container')!;

  btnUndo             = document.getElementById('btn-undo')              as HTMLButtonElement;
  btnRedo             = document.getElementById('btn-redo')              as HTMLButtonElement;
  btnOpenGallery      = document.getElementById('btn-open-gallery')      as HTMLButtonElement;
  btnSaveGallery      = document.getElementById('btn-save-gallery')      as HTMLButtonElement;
  btnOpenGalleryTool  = document.getElementById('btn-open-gallery-tool') as HTMLButtonElement;
  btnCenterLine       = document.getElementById('btn-center-line')       as HTMLButtonElement;
  btnFillMargin       = document.getElementById('btn-fill-margin')       as HTMLButtonElement;
  btnDedupCodes       = document.getElementById('btn-dedup-codes')       as HTMLButtonElement;
  btnClearPage        = document.getElementById('btn-clear-page')        as HTMLButtonElement;
  btnCopyPage         = document.getElementById('btn-copy-page')         as HTMLButtonElement;
  btnCopyPageOpts     = document.getElementById('btn-copy-page-opts')     as HTMLButtonElement;
  copyPageWrapper     = document.getElementById('copy-page-wrapper');
  copyPageMenu        = document.getElementById('copy-page-menu');
  btnPreviewCopyPage  = document.getElementById('btn-preview-copy-page')  as HTMLButtonElement | null;
  btnPrevPage         = document.getElementById('prev-page-btn')         as HTMLButtonElement;
  btnNextPage         = document.getElementById('next-page-btn')         as HTMLButtonElement;
  btnZoomIn           = document.getElementById('btn-zoom-in')           as HTMLButtonElement;
  btnZoomOut          = document.getElementById('btn-zoom-out')          as HTMLButtonElement;
  btnZoomFit          = document.getElementById('btn-zoom-fit')          as HTMLButtonElement;
  btnSoundToggle      = document.getElementById('btn-sound-toggle')      as HTMLButtonElement;
  viewModeSingle      = document.getElementById('view-mode-single')      as HTMLButtonElement;
  viewModeDouble      = document.getElementById('view-mode-double')      as HTMLButtonElement;
  engineSelect        = document.getElementById('engine-select')         as HTMLSelectElement;

  importDialog        = document.getElementById('import-dialog')         as HTMLDialogElement;
  importTextarea      = document.getElementById('import-textarea')       as HTMLTextAreaElement;
  exportDialog        = document.getElementById('export-dialog')         as HTMLDialogElement;
  exportFormatsEl     = document.getElementById('export-formats')!;
  glyphDialog         = document.getElementById('glyph-dialog')          as HTMLDialogElement;
  glyphGrid           = document.getElementById('glyph-grid')!;
  glyphSearch         = document.getElementById('glyph-search')          as HTMLInputElement;
  glyphTabs           = document.getElementById('glyph-tabs')!;
  glyphCustomInput    = document.getElementById('glyph-custom-input')   as HTMLInputElement;
  glyphCustomWidth    = document.getElementById('glyph-custom-width')!;
  glyphCustomInsertBtn = document.getElementById('glyph-custom-insert-btn') as HTMLButtonElement;

  // Gallery Modal
  galleryDialog       = document.getElementById('gallery-dialog')         as HTMLDialogElement;
  galleryTabsNav      = document.getElementById('gallery-tabs-nav')       as HTMLElement;
  galleryTabPageCount = document.getElementById('gallery-tab-page-count') as HTMLElement;
  galleryTabLibCount  = document.getElementById('gallery-tab-lib-count')  as HTMLElement;
  galleryPanePages    = document.getElementById('gallery-pane-pages')     as HTMLElement;
  galleryPaneLibrary  = document.getElementById('gallery-pane-library')   as HTMLElement;
  galleryPaneSave     = document.getElementById('gallery-pane-save')      as HTMLElement;
  btnGalleryAddBlank  = document.getElementById('btn-gallery-add-blank')  as HTMLButtonElement;
  btnGalleryDupActive = document.getElementById('btn-gallery-dup-active') as HTMLButtonElement;
  galleryPagesGrid    = document.getElementById('gallery-pages-grid')     as HTMLElement;
  galleryFilterChips  = document.getElementById('gallery-filter-chips')   as HTMLElement;
  btnGallerySwitchSave = document.getElementById('btn-gallery-switch-save') as HTMLButtonElement;
  btnGalleryExportLib = document.getElementById('btn-gallery-export-lib') as HTMLButtonElement;
  btnGalleryImportLib = document.getElementById('btn-gallery-import-lib') as HTMLButtonElement;
  galleryImportFileInput = document.getElementById('gallery-import-file-input') as HTMLInputElement;
  galleryTemplatesGrid = document.getElementById('gallery-templates-grid') as HTMLElement;
  saveItemTitle       = document.getElementById('save-item-title')       as HTMLInputElement;
  saveItemCategory    = document.getElementById('save-item-category')    as HTMLSelectElement;
  gallerySavePreview  = document.getElementById('gallery-save-preview')  as HTMLElement;
  btnCancelSaveGallery = document.getElementById('btn-cancel-save-gallery') as HTMLButtonElement;
  btnConfirmSaveGallery = document.getElementById('btn-confirm-save-gallery') as HTMLButtonElement;

  // Top Matrix Selector & Hub
  btnStudioTools      = document.getElementById('btn-studio-tools')       as HTMLButtonElement;
  studioToolsFlyout   = document.getElementById('studio-tools-flyout')    as HTMLElement;
  btnCloseToolsFlyout = document.getElementById('btn-close-tools-flyout') as HTMLButtonElement;
  matrixPxUp          = document.getElementById('matrix-px-up')           as HTMLButtonElement;
  matrixPxDown        = document.getElementById('matrix-px-down')         as HTMLButtonElement;
  matrixPxValue       = document.getElementById('matrix-px-value')        as HTMLElement;
  matrixPagePrev      = document.getElementById('matrix-page-prev')       as HTMLButtonElement;
  matrixPageNext      = document.getElementById('matrix-page-next')       as HTMLButtonElement;
  matrixPageLabel     = document.getElementById('matrix-page-label')      as HTMLElement;
  matrixSlotsRibbon   = document.getElementById('matrix-slots-ribbon')    as HTMLElement;
  matrixQuickWidths   = document.getElementById('matrix-quick-widths')    as HTMLElement;

  // Collapsible Saved Art Deck
  savedArtDeck        = document.getElementById('saved-art-deck')         as HTMLElement;
  btnDeckToggle       = document.getElementById('btn-deck-toggle')        as HTMLButtonElement;
  deckToggleIcon      = document.getElementById('deck-toggle-icon')       as HTMLElement;
  deckToggleText      = document.getElementById('deck-toggle-text')       as HTMLElement;
  deckTitleToggle     = document.getElementById('deck-title-toggle')      as HTMLElement;
  deckPastesStrip     = document.getElementById('deck-pastes-strip')      as HTMLElement;
  btnDeckSaveRow      = document.getElementById('btn-deck-save-row')      as HTMLButtonElement;
  btnDeckSavePage     = document.getElementById('btn-deck-save-page')     as HTMLButtonElement;
  btnDeckOpenGallery  = document.getElementById('btn-deck-open-gallery')  as HTMLButtonElement;

  // Build the 14 Line Rows in the 14-Line Book View
  build14LineRows();
}

function build14LineRows(): void {
  if (!bookLinesList) return;
  bookLinesList.innerHTML = '';
  lineRowEls = [];
  lineInputEls = [];
  lineGutterNumEls = [];
  lineGutterFillEls = [];
  lineGutterBadgeEls = [];

  for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
    const row = document.createElement('div');
    row.className = `book-line-row${i === activeLineIndex ? ' active' : ''}`;
    row.dataset.lineIndex = String(i);

    const gutter = document.createElement('div');
    gutter.className = 'book-line-gutter';
    gutter.title = `Click to focus Line ${i + 1}`;

    const numSpan = document.createElement('span');
    numSpan.className = 'gutter-num';
    numSpan.textContent = String(i + 1);

    const barWrap = document.createElement('div');
    barWrap.className = 'gutter-bar-wrap';

    const barFill = document.createElement('div');
    barFill.className = 'gutter-bar-fill';
    barWrap.appendChild(barFill);

    const badge = document.createElement('span');
    badge.className = 'gutter-badge';
    badge.textContent = '0px';

    gutter.appendChild(numSpan);
    gutter.appendChild(barWrap);
    gutter.appendChild(badge);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'book-line-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'book-line-input';
    input.dataset.lineIndex = String(i);
    input.placeholder = `Line ${i + 1}…`;
    input.spellcheck = false;
    input.autocomplete = 'off';
    inputWrap.appendChild(input);

    row.appendChild(gutter);
    row.appendChild(inputWrap);
    bookLinesList.appendChild(row);

    lineRowEls.push(row);
    lineInputEls.push(input);
    lineGutterNumEls.push(numSpan);
    lineGutterFillEls.push(barFill);
    lineGutterBadgeEls.push(badge);

    // Gutter click focuses input
    gutter.addEventListener('click', () => {
      activeLineIndex = i;
      updateActiveRowClass();
      input.focus();
    });

    // Input Events
    input.addEventListener('focus', () => {
      activeLineIndex = i;
      updateActiveRowClass();
      updateGutterAndStats();
    });

    input.addEventListener('input', () => {
      onLineInput(i);
    });

    input.addEventListener('keydown', (e) => {
      onLineKeyDown(e, i);
    });

    input.addEventListener('paste', (e) => {
      onLinePaste(e, i);
    });
  }
}

function updateActiveRowClass(): void {
  lineRowEls.forEach((r, idx) => {
    r.classList.toggle('active', idx === activeLineIndex);
  });
}

function onLineInput(lineIdx: number): void {
  const input = lineInputEls[lineIdx];
  if (!input) return;

  const prevVal = currentLines[lineIdx];
  currentLines[lineIdx] = input.value;

  // Enforce Minecraft 1024 character limit
  const totalChars = getTotalPageChars(currentLines);
  if (totalChars > MINECRAFT_PAGE_MAX_CHARS) {
    currentLines[lineIdx] = prevVal;
    input.value = prevVal;
    showToast(`Minecraft character limit reached (${MINECRAFT_PAGE_MAX_CHARS} max per page)`, 'warn');
    updateAll();
    return;
  }

  // Handle auto word-wrapping onto subsequent lines when exceeding 114px
  handleLineAutoWrap(lineIdx);
  pushUndoSnapshot();
  updateAll();
}

function handleLineAutoWrap(lineIdx: number): void {
  const mw = maxWidth();
  let idx = lineIdx;

  while (idx < MINECRAFT_LINES_PER_PAGE) {
    const input = lineInputEls[idx];
    const lineText = currentLines[idx] ?? '';
    const carried = getCarriedStyleForLine(currentLines, idx);
    const lineW = measureLineWidth(parseFormattedText(lineText, carried));

    if (lineW <= mw) {
      break;
    }

    const { head, tail } = splitLineAtOverflow(lineText, carried, mw);
    currentLines[idx] = head;
    if (input) input.value = head;

    if (idx + 1 < MINECRAFT_LINES_PER_PAGE) {
      const nextInput = lineInputEls[idx + 1];
      const nextExisting = currentLines[idx + 1] ?? '';
      const separator = nextExisting.length > 0 && !nextExisting.startsWith(' ') ? ' ' : '';
      currentLines[idx + 1] = tail + separator + nextExisting;
      if (nextInput) nextInput.value = currentLines[idx + 1];

      // If active line was wrapped, move focus and cursor to the wrapped text
      if (idx === activeLineIndex) {
        activeLineIndex = idx + 1;
        updateActiveRowClass();
        if (nextInput) {
          nextInput.focus();
          const newCursorPos = tail.length;
          nextInput.setSelectionRange(newCursorPos, newCursorPos);
        }
      }
      idx++;
    } else {
      // Line 14 is the maximum line in Minecraft - excess cannot wrap to a 15th line
      if (idx === activeLineIndex && input) {
        input.setSelectionRange(head.length, head.length);
      }
      showToast('Line 14 full: stopped typing to prevent page overflow', 'warn');
      break;
    }
  }
}

function onLineKeyDown(e: KeyboardEvent, lineIdx: number): void {
  const input = lineInputEls[lineIdx];
  if (!input) return;

  if (e.key === 'Enter') {
    e.preventDefault();
    if (lineIdx >= MINECRAFT_LINES_PER_PAGE - 1) {
      showToast('Page limit reached: Minecraft books have exactly 14 lines', 'warn');
      return;
    }

    const pos = input.selectionStart ?? input.value.length;
    const head = currentLines[lineIdx].slice(0, pos);
    const tail = currentLines[lineIdx].slice(pos);

    currentLines[lineIdx] = head;
    input.value = head;

    // Shift lines below down by 1
    for (let l = MINECRAFT_LINES_PER_PAGE - 1; l > lineIdx + 1; l--) {
      currentLines[l] = currentLines[l - 1];
      if (lineInputEls[l]) lineInputEls[l].value = currentLines[l];
    }

    currentLines[lineIdx + 1] = tail;
    if (lineInputEls[lineIdx + 1]) lineInputEls[lineIdx + 1].value = tail;

    activeLineIndex = lineIdx + 1;
    updateActiveRowClass();
    lineInputEls[lineIdx + 1]?.focus();
    lineInputEls[lineIdx + 1]?.setSelectionRange(0, 0);

    pushUndoSnapshot();
    updateAll();
    return;
  }

  if (e.key === 'Backspace') {
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;

    if (start === 0 && end === 0 && lineIdx > 0) {
      e.preventDefault();
      const prevLen = currentLines[lineIdx - 1].length;

      if (currentLines[lineIdx].length === 0) {
        // Line is blank: delete line by shifting all lines below up
        for (let l = lineIdx; l < MINECRAFT_LINES_PER_PAGE - 1; l++) {
          currentLines[l] = currentLines[l + 1];
          if (lineInputEls[l]) lineInputEls[l].value = currentLines[l];
        }
        currentLines[MINECRAFT_LINES_PER_PAGE - 1] = '';
        if (lineInputEls[MINECRAFT_LINES_PER_PAGE - 1]) {
          lineInputEls[MINECRAFT_LINES_PER_PAGE - 1].value = '';
        }

        activeLineIndex = lineIdx - 1;
        updateActiveRowClass();
        const prevInput = lineInputEls[lineIdx - 1];
        if (prevInput) {
          prevInput.focus();
          prevInput.setSelectionRange(prevLen, prevLen);
        }
      } else {
        // Line has text: check if it fits into preceding line
        const style = getCarriedStyleForLine(currentLines, lineIdx - 1);
        const needsSpace = currentLines[lineIdx - 1].length > 0 &&
          !currentLines[lineIdx - 1].endsWith(' ') &&
          !currentLines[lineIdx].startsWith(' ');
        const merged = currentLines[lineIdx - 1] + (needsSpace ? ' ' : '') + currentLines[lineIdx];

        if (measureLineWidth(parseFormattedText(merged, style)) <= maxWidth()) {
          currentLines[lineIdx - 1] = merged;
          if (lineInputEls[lineIdx - 1]) lineInputEls[lineIdx - 1].value = merged;

          for (let l = lineIdx; l < MINECRAFT_LINES_PER_PAGE - 1; l++) {
            currentLines[l] = currentLines[l + 1];
            if (lineInputEls[l]) lineInputEls[l].value = currentLines[l];
          }
          currentLines[MINECRAFT_LINES_PER_PAGE - 1] = '';
          if (lineInputEls[MINECRAFT_LINES_PER_PAGE - 1]) {
            lineInputEls[MINECRAFT_LINES_PER_PAGE - 1].value = '';
          }

          activeLineIndex = lineIdx - 1;
          updateActiveRowClass();
          const prevInput = lineInputEls[lineIdx - 1];
          if (prevInput) {
            prevInput.focus();
            const mergePos = prevLen + (needsSpace ? 1 : 0);
            prevInput.setSelectionRange(mergePos, mergePos);
          }
        } else {
          // Exceeds width to merge: simply jump cursor to end of previous line
          activeLineIndex = lineIdx - 1;
          updateActiveRowClass();
          const prevInput = lineInputEls[lineIdx - 1];
          if (prevInput) {
            prevInput.focus();
            prevInput.setSelectionRange(prevLen, prevLen);
          }
        }
      }

      pushUndoSnapshot();
      updateAll();
      return;
    }
  }

  if (e.key === 'ArrowUp' && lineIdx > 0) {
    e.preventDefault();
    activeLineIndex = lineIdx - 1;
    updateActiveRowClass();
    const prevInput = lineInputEls[lineIdx - 1];
    if (prevInput) {
      const pos = Math.min(input.selectionStart ?? 0, currentLines[lineIdx - 1].length);
      prevInput.focus();
      prevInput.setSelectionRange(pos, pos);
    }
    return;
  }

  if (e.key === 'ArrowDown' && lineIdx < MINECRAFT_LINES_PER_PAGE - 1) {
    e.preventDefault();
    activeLineIndex = lineIdx + 1;
    updateActiveRowClass();
    const nextInput = lineInputEls[lineIdx + 1];
    if (nextInput) {
      const pos = Math.min(input.selectionStart ?? 0, currentLines[lineIdx + 1].length);
      nextInput.focus();
      nextInput.setSelectionRange(pos, pos);
    }
    return;
  }
}

function onLinePaste(e: ClipboardEvent, lineIdx: number): void {
  e.preventDefault();
  const pastedText = e.clipboardData?.getData('text') ?? '';
  if (!pastedText) return;

  const rawParagraphs = pastedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const flattenedWords: string[] = [];
  rawParagraphs.forEach((para, pIdx) => {
    if (pIdx > 0) flattenedWords.push('\n');
    para.split(' ').forEach((w) => {
      if (w.length > 0) flattenedWords.push(w);
    });
  });

  const input = lineInputEls[lineIdx];
  const start = input?.selectionStart ?? 0;
  const before = currentLines[lineIdx].slice(0, start);
  const after = currentLines[lineIdx].slice(input?.selectionEnd ?? start);

  // Rebuild lines with reflow
  const newLines = [...currentLines];
  newLines[lineIdx] = before + (before.length > 0 && !before.endsWith(' ') ? ' ' : '') + pastedText + (after.length > 0 && !after.startsWith(' ') ? ' ' : '') + after;

  const { lines: reflowed, truncated } = reflowPageLines(newLines, lineIdx, maxWidth(), MINECRAFT_LINES_PER_PAGE);
  for (let l = 0; l < MINECRAFT_LINES_PER_PAGE; l++) {
    currentLines[l] = reflowed[l] ?? '';
    if (lineInputEls[l]) lineInputEls[l].value = currentLines[l];
  }

  if (truncated) {
    showToast('Pasted text reflowed across 14 lines (excess truncated to fit book)', 'info');
  }

  pushUndoSnapshot();
  updateAll();
}

// ─── Utility Helpers ──────────────────────────────────────────────────────────

function maxWidth(): number {
  return engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
}

function showToast(message: string, type: 'success' | 'info' | 'warn' = 'info'): void {
  if (!toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

/** Insert text at cursor position (active line input or raw textarea). */
function insertAtCursor(text: string): void {
  if (isRawMode) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;
    const currentVal = textarea.value;

    textarea.value = currentVal.slice(0, start) + text + currentVal.slice(end);
    const pos = start + text.length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const input = lineInputEls[activeLineIndex];
  if (!input) return;

  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  const currentVal = currentLines[activeLineIndex] ?? '';

  currentLines[activeLineIndex] = currentVal.slice(0, start) + text + currentVal.slice(end);
  input.value = currentLines[activeLineIndex];
  const pos = start + text.length;
  input.setSelectionRange(pos, pos);
  input.focus();

  handleLineAutoWrap(activeLineIndex);
  pushUndoSnapshot();
  updateAll();
}

/** Wraps current selection with a formatting code or inserts code at cursor */
function applyFormatting(code: string): void {
  if (isRawMode) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end   = textarea.selectionEnd   ?? textarea.value.length;
    const currentVal = textarea.value;

    if (start === end) {
      insertAtCursor(code);
      return;
    }

    const selectedText = currentVal.slice(start, end);
    const replacement = code === '§r' ? `${selectedText}§r` : `${code}${selectedText}§r`;
    textarea.value = currentVal.slice(0, start) + replacement + currentVal.slice(end);
    const pos = start + replacement.length;
    textarea.setSelectionRange(pos, pos);
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }

  const input = lineInputEls[activeLineIndex];
  if (!input) return;

  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  const currentVal = currentLines[activeLineIndex] ?? '';

  if (start === end) {
    insertAtCursor(code);
    return;
  }

  const selectedText = currentVal.slice(start, end);
  const replacement = code === '§r' ? `${selectedText}§r` : `${code}${selectedText}§r`;
  currentLines[activeLineIndex] = currentVal.slice(0, start) + replacement + currentVal.slice(end);
  input.value = currentLines[activeLineIndex];
  const pos = start + replacement.length;
  input.setSelectionRange(pos, pos);
  input.focus();

  handleLineAutoWrap(activeLineIndex);
  pushUndoSnapshot();
  updateAll();
}

// ─── Undo / Redo System ───────────────────────────────────────────────────────

function pushUndoSnapshot(): void {
  if (isApplyingHistory) return;
  const snapshot: UndoSnapshot = {
    book: {
      title: book.title,
      author: book.author,
      pages: [...book.pages],
    },
    pageIndex: currentPageIndex,
  };

  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0;
  updateUndoRedoButtons();
}

function undo(): void {
  if (undoStack.length === 0) return;
  isApplyingHistory = true;

  redoStack.push({
    book: { title: book.title, author: book.author, pages: [...book.pages] },
    pageIndex: currentPageIndex,
  });

  const prev = undoStack.pop()!;
  book = {
    title: prev.book.title,
    author: prev.book.author,
    pages: [...prev.book.pages],
  };
  metaTitle.value = book.title;
  metaAuthor.value = book.author;
  currentPageIndex = Math.min(prev.pageIndex, book.pages.length - 1);

  loadPageIntoEditor(currentPageIndex);
  syncViewerToBook();

  isApplyingHistory = false;
  updateUndoRedoButtons();
  triggerAutosave();
  showToast('Undo', 'info');
}

function redo(): void {
  if (redoStack.length === 0) return;
  isApplyingHistory = true;

  undoStack.push({
    book: { title: book.title, author: book.author, pages: [...book.pages] },
    pageIndex: currentPageIndex,
  });

  const next = redoStack.pop()!;
  book = {
    title: next.book.title,
    author: next.book.author,
    pages: [...next.book.pages],
  };
  metaTitle.value = book.title;
  metaAuthor.value = book.author;
  currentPageIndex = Math.min(next.pageIndex, book.pages.length - 1);

  loadPageIntoEditor(currentPageIndex);
  syncViewerToBook();

  isApplyingHistory = false;
  updateUndoRedoButtons();
  triggerAutosave();
  showToast('Redo', 'info');
}

function updateUndoRedoButtons(): void {
  if (!btnUndo || !btnRedo) return;
  btnUndo.disabled = undoStack.length === 0;
  btnRedo.disabled = redoStack.length === 0;
}

// ─── LocalStorage Autosave & Restore ──────────────────────────────────────────

function triggerAutosave(): void {
  if (!autosaveDot || !autosaveText) return;
  autosaveDot.classList.add('saving');
  autosaveText.textContent = 'Saving…';

  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      const data = {
        book,
        timestamp: Date.now(),
        currentPageIndex,
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      autosaveText.textContent = `Saved ${timeStr}`;
    } catch {
      autosaveText.textContent = 'Autosave error';
    } finally {
      autosaveDot.classList.remove('saving');
    }
  }, 400);
}

function restoreAutosave(): boolean {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.book && Array.isArray(parsed.book.pages) && parsed.book.pages.length > 0) {
      book = parsed.book;
      currentPageIndex = Math.max(0, Math.min(parsed.currentPageIndex || 0, book.pages.length - 1));
      return true;
    }
  } catch {
    // Ignore corrupt storage
  }
  return false;
}

// ─── Formatting-Code Deduplication ───────────────────────────────────────────

/**
 * Deduplicates consecutive redundant formatting codes without stripping intentional
 * line resets (§r before \n is needed to reset styles for subsequent lines in Minecraft):
 * - Consecutive duplicate styles: §l§l -> §l, §o§o -> §o, etc.
 * - Consecutive duplicate resets: §r§r -> §r
 * - Consecutive overridden color codes: §a§b -> §b
 */
export function deduplicateCodes(text: string): { cleaned: string; removedCount: number } {
  let cleaned = text;
  const prevLength = cleaned.length;

  // 1. Remove consecutive identical codes (§l§l -> §l, §r§r -> §r)
  cleaned = cleaned.replace(/(§[0-9a-fklmnor])\1+/gi, '$1');

  // 2. Remove overridden color codes (e.g. §a§b -> §b)
  cleaned = cleaned.replace(/§[0-9a-f](§[0-9a-f])/gi, '$1');

  // 3. Repeated reset strings
  cleaned = cleaned.replace(/(§r)+/g, '§r');

  const removedCount = Math.max(0, Math.floor((prevLength - cleaned.length) / 2));
  return { cleaned, removedCount };
}

// ─── Pixel-fill Alignment Helper ("Fill to Margin") ───────────────────────────

export function calculateMarginFillSpaces(currentLineWidth: number, targetWidth: number): string {
  const remaining = Math.floor(targetWidth - currentLineWidth);
  const { regular, bold } = solveBoldSpaces(remaining);
  let result = '';
  if (regular > 0) {
    result += ' '.repeat(regular);
  }
  if (bold > 0) {
    result += `§l${' '.repeat(bold)}§r`;
  }
  return result;
}

// ─── Page Management ──────────────────────────────────────────────────────────

function saveCurrentPageToBook(): void {
  if (isRawMode) {
    book.pages[currentPageIndex] = textarea.value;
    currentLines = getLinesFromPageText(textarea.value);
  } else {
    book.pages[currentPageIndex] = getPageTextFromLines(currentLines);
    textarea.value = book.pages[currentPageIndex];
  }
  book.title  = metaTitle.value.trim()  || 'Untitled';
  book.author = metaAuthor.value.trim() || 'Author';
}

function loadPageIntoEditor(index: number): void {
  currentPageIndex = Math.max(0, Math.min(index, book.pages.length - 1));
  const pageText = book.pages[currentPageIndex] ?? '';
  currentLines = getLinesFromPageText(pageText);
  textarea.value = pageText;

  for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
    if (lineInputEls[i]) {
      lineInputEls[i].value = currentLines[i] ?? '';
    }
  }

  pageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  if (previewIndicator) {
    previewIndicator.textContent = `${currentPageIndex + 1} / ${book.pages.length}`;
  }

  updateAll();
}

function syncViewerToBook(): void {
  if (viewer) {
    viewer.setBook({ ...book }, true);
    viewer.setPage(currentPageIndex);
  }
}

// ─── 14-Line Pixel Counter Gutter & Stats ─────────────────────────────────────

function updateGutterAndStats(): void {
  const mw = maxWidth();
  rulerTargetWidth.textContent = `Target: ${mw} px/line`;

  // Update Gutter Meters across all 14 Lines
  for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
    const lineText = currentLines[i] ?? '';
    const style = getCarriedStyleForLine(currentLines, i);
    const lineW = Math.round(measureLineWidth(parseFormattedText(lineText, style)));
    const pct = Math.min(100, (lineW / mw) * 100);
    const isFull = lineW >= mw;
    const isWarn = pct > 90 && !isFull;

    if (lineGutterFillEls[i]) {
      lineGutterFillEls[i].style.width = `${pct}%`;
      lineGutterFillEls[i].className = `gutter-bar-fill${isFull ? ' full' : isWarn ? ' warn' : ''}`;
    }
    if (lineGutterBadgeEls[i]) {
      lineGutterBadgeEls[i].textContent = `${lineW}px`;
      lineGutterBadgeEls[i].className = `gutter-badge${isFull ? ' full' : isWarn ? ' warn' : ''}`;
    }
  }

  // Footer Stats
  const pageText = isRawMode ? textarea.value : getPageTextFromLines(currentLines);
  const totalChars = pageText.length;
  const words = pageText.trim() ? pageText.trim().split(/\s+/).length : 0;
  const activeStyle = getCarriedStyleForLine(currentLines, activeLineIndex);
  const activeW = Math.round(measureLineWidth(parseFormattedText(currentLines[activeLineIndex] ?? '', activeStyle)));
  const pxLeft = Math.max(0, mw - activeW);

  statLines.textContent = `14 lines (L${activeLineIndex + 1} active)`;
  statChars.textContent = `${totalChars} / ${MINECRAFT_PAGE_MAX_CHARS} chars`;
  statWords.textContent = `${words} words`;
  statPixelsLeft.textContent = `${pxLeft} px left on L${activeLineIndex + 1}`;

  const isOverChars = totalChars > MINECRAFT_PAGE_MAX_CHARS;
  statChars.classList.toggle('stat-warn', isOverChars);

  const unsupported = detectUnsupportedMinecraftChars(pageText);

  if (isOverChars) {
    diagSummary.textContent = `⚠ Page char limit (${MINECRAFT_PAGE_MAX_CHARS}) exceeded`;
    diagSummary.className = 'badge stat-warn';
    diagSummary.title = 'Page exceeds Minecraft 1024-character maximum.';
  } else if (unsupported.count > 0) {
    diagSummary.textContent = `⚠ ${unsupported.count} SMP char(s) >U+FFFF (${unsupported.chars.slice(0, 3).join('')}) render as [] in MC`;
    diagSummary.className = 'badge stat-warn';
    diagSummary.title = 'Vanilla Minecraft Java Edition font only supports BMP characters up to U+FFFF. Characters outside BMP (like modern emojis) render as missing glyph boxes ([])';
  } else if (totalChars >= 950) {
    diagSummary.textContent = '⚠ Near 1024-char limit';
    diagSummary.className = 'badge stat-warn';
    diagSummary.title = 'Close to Minecraft 1024 character limit.';
  } else {
    diagSummary.textContent = '✓ 14 Lines • Valid';
    diagSummary.className = 'badge badge-ok';
    diagSummary.title = 'All lines and characters are valid Minecraft book text.';
  }

  metaTitleCount.textContent = `${metaTitle.value.length}/32`;
  metaAuthorCount.textContent = `${metaAuthor.value.length}/16`;
}

// ─── Master Update ────────────────────────────────────────────────────────────

function updateAll(immediate = false): void {
  updateGutterAndStats();

  // Sync state
  if (isRawMode) {
    book.pages[currentPageIndex] = textarea.value;
  } else {
    const pageText = getPageTextFromLines(currentLines);
    book.pages[currentPageIndex] = pageText;
    textarea.value = pageText;
  }
  book.title  = metaTitle.value.trim()  || 'Untitled';
  book.author = metaAuthor.value.trim() || 'Author';

  if (immediate) {
    syncViewerToBook();
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncViewerToBook();
    }, 60);
  }

  pageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  if (previewIndicator) {
    previewIndicator.textContent = `${currentPageIndex + 1} / ${book.pages.length}`;
  }
  triggerAutosave();
}

// ─── Viewer Initialization ────────────────────────────────────────────────────

async function initViewer(): Promise<void> {
  viewer = new BlockgameBookViewer(viewerContainer, {
    book,
    defaultViewMode: viewMode,
    engine,
    controls: false,
    editable: true,
    maxPages: MINECRAFT_MAX_PAGES,
    onAddPage: (newPageIndex, updatedBook) => {
      book = updatedBook;
      currentPageIndex = newPageIndex;
      loadPageIntoEditor(currentPageIndex);
      updateGalleryCounts();
      showToast(`Added Page ${currentPageIndex + 1}`, 'success');
    },
    onPageChange: (page) => {
      if (page >= book.pages.length && book.pages.length < MINECRAFT_MAX_PAGES) {
        book.pages.push('');
      }
      if (page !== currentPageIndex && page >= 0 && page < book.pages.length) {
        saveCurrentPageToBook();
        loadPageIntoEditor(page);
        updateGalleryCounts();
      }
    },
  });
  await viewer.init();
}

// ─── Symbol Chat-Inspired Unicode Glyph Browser & Font Engine ─────────────────

const RECENTS_KEY = 'blockgame_user_recent_glyphs';
let activeGlyphCat: GlyphCategory = 'all';
let activeGlyphTint: string = '#FFFFFF';
let activeFontId: string = 'small_caps';
let recentGlyphs: string[] = [];

try {
  const rawRecents = localStorage.getItem(RECENTS_KEY);
  if (rawRecents) {
    const parsed = JSON.parse(rawRecents);
    if (Array.isArray(parsed)) recentGlyphs = parsed;
  }
} catch {}

function saveRecentGlyphs(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(recentGlyphs));
  } catch {}
}

function addRecentGlyph(char: string): void {
  recentGlyphs = [char, ...recentGlyphs.filter((c) => c !== char)].slice(0, 36);
  saveRecentGlyphs();
}

function toggleUserFavoriteGlyph(char: string): boolean {
  if (userFavoriteGlyphs.includes(char)) {
    userFavoriteGlyphs = userFavoriteGlyphs.filter((c) => c !== char);
    saveUserFavoriteGlyphs(userFavoriteGlyphs);
    return false;
  } else {
    userFavoriteGlyphs = [char, ...userFavoriteGlyphs];
    saveUserFavoriteGlyphs(userFavoriteGlyphs);
    return true;
  }
}

function updateGlyphInspector(item: GlyphItem): void {
  const inspectorCanvas = document.getElementById('glyph-inspector-canvas') as HTMLCanvasElement | null;
  const inspectorName = document.getElementById('glyph-inspector-name');
  const inspectorChar = document.getElementById('glyph-inspector-char');
  const inspectorCp = document.getElementById('glyph-inspector-cp');
  const inspectorWidth = document.getElementById('glyph-inspector-width');
  const inspectorCompat = document.getElementById('glyph-inspector-compat');

  if (inspectorCanvas) {
    renderGlyphToCanvas(inspectorCanvas, item.char, activeGlyphTint, 3);
  }
  if (inspectorName) inspectorName.textContent = item.name;
  if (inspectorChar) inspectorChar.textContent = item.char;
  if (inspectorCp) inspectorCp.textContent = item.codepoint;
  const advance = getCharPixelAdvance(item.char);
  if (inspectorWidth) inspectorWidth.textContent = `${advance}px`;
  if (inspectorCompat) {
    if (item.isSmp) {
      inspectorCompat.textContent = '⚠️ SMP (>U+FFFF) - Vanilla Java renders []';
      inspectorCompat.className = 'badge stat-warn';
    } else {
      inspectorCompat.textContent = '✓ Vanilla Java BMP Compatible';
      inspectorCompat.className = 'badge badge-ok';
    }
  }
}

function renderQuickFavsBar(): void {
  const container = document.getElementById('glyph-quick-favs-list');
  if (!container) return;
  container.innerHTML = '';

  const favsToShow = userFavoriteGlyphs.slice(0, 20);
  favsToShow.forEach((char) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'quick-fav-btn';
    btn.textContent = char;
    btn.title = `Quick insert "${char}"`;
    btn.addEventListener('click', () => {
      insertAtCursor(char);
      addRecentGlyph(char);
      showToast(`Inserted "${char}"`, 'info');
    });
    container.appendChild(btn);
  });
}

function renderFontReplacementPanel(): void {
  const chipsBar = document.getElementById('font-chips-bar');
  const convertInput = document.getElementById('font-convert-input') as HTMLInputElement | null;
  const convertPreview = document.getElementById('font-convert-preview');
  const alphabetGrid = document.getElementById('font-alphabet-grid');
  if (!chipsBar || !convertPreview || !alphabetGrid) return;

  chipsBar.innerHTML = '';
  SYMBOL_CHAT_FONTS.forEach((font) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `font-chip${font.id === activeFontId ? ' active' : ''}`;
    chip.innerHTML = `<span>${font.name}</span> <small style="opacity:0.75;">${font.sample}</small>`;
    chip.title = `${font.description} ${font.isSmp ? '(SMP >U+FFFF)' : '(Vanilla BMP)'}`;
    chip.addEventListener('click', () => {
      activeFontId = font.id;
      renderFontReplacementPanel();
    });
    chipsBar.appendChild(chip);
  });

  const font = getFontById(activeFontId);
  const rawText = convertInput?.value || 'Minecraft Book Studio 123';
  convertPreview.textContent = font.transform(rawText);

  // Populate alphabet grid of the chosen font
  alphabetGrid.innerHTML = '';
  const entries = Object.entries(font.charMap);
  entries.forEach(([origChar, fontChar]) => {
    const card = document.createElement('div');
    card.className = 'glyph-card';
    card.title = `${font.name}: ${origChar} → ${fontChar} (Click to insert)`;

    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    canvas.className = 'glyph-canvas';
    renderGlyphToCanvas(canvas, fontChar, activeGlyphTint, 2);

    const advance = getCharPixelAdvance(fontChar);
    const metaEl = document.createElement('span');
    metaEl.className = `glyph-card-meta${font.isSmp ? ' smp' : ''}`;
    metaEl.textContent = font.isSmp ? 'SMP' : `${advance}px`;

    card.appendChild(canvas);
    card.appendChild(metaEl);

    card.addEventListener('mouseenter', () => {
      updateGlyphInspector({
        char: fontChar,
        name: `${font.name}: "${origChar}"`,
        category: 'fonts',
        codepoint: `U+${(fontChar.codePointAt(0) || 0).toString(16).toUpperCase().padStart(4, '0')}`,
        isSmp: (fontChar.codePointAt(0) || 0) > 0xFFFF,
      });
    });

    card.addEventListener('click', () => {
      insertAtCursor(fontChar);
      addRecentGlyph(fontChar);
      showToast(`Inserted "${fontChar}"`, 'info');
    });

    alphabetGrid.appendChild(card);
  });
}

function renderGlyphs(): void {
  ensureAtlasLoaded();
  renderQuickFavsBar();

  const fontPanel = document.getElementById('glyph-font-panel');
  if (activeGlyphCat === 'fonts') {
    if (fontPanel) fontPanel.style.display = 'flex';
    glyphGrid.style.display = 'none';
    renderFontReplacementPanel();
    return;
  }

  if (fontPanel) fontPanel.style.display = 'none';
  glyphGrid.style.display = 'grid';

  const query = glyphSearch.value.trim().toLowerCase();
  glyphGrid.innerHTML = '';

  let itemsToRender: GlyphItem[] = [];

  if (query) {
    itemsToRender = ALL_GLYPHS.filter((item) => {
      const hex = (item.char.codePointAt(0) || 0).toString(16).toLowerCase();
      return (
        item.char.includes(query) ||
        item.name.toLowerCase().includes(query) ||
        hex.includes(query.replace(/^u\+?/i, ''))
      );
    });
  } else if (activeGlyphCat === 'all') {
    // One large unified continuous grid of all symbols (Symbol Chat style)
    itemsToRender = ALL_GLYPHS;
  } else if (activeGlyphCat === 'fav') {
    itemsToRender = userFavoriteGlyphs.map((c) => findGlyphItem(c));
  } else if (activeGlyphCat === 'recent') {
    itemsToRender = recentGlyphs.map((c) => findGlyphItem(c));
  } else {
    itemsToRender = (GLYPHS_BY_CATEGORY as any)[activeGlyphCat] || [];
  }

  if (itemsToRender.length > 0) {
    updateGlyphInspector(itemsToRender[0]);
  }

  itemsToRender.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'glyph-card';
    card.title = `${item.name} (${item.char}) • ${item.codepoint} • Click to insert, Right-click to star`;

    // Star favorite button
    const starBtn = document.createElement('button');
    starBtn.type = 'button';
    const isFav = userFavoriteGlyphs.includes(item.char);
    starBtn.className = `glyph-star-btn${isFav ? ' starred' : ''}`;
    starBtn.textContent = isFav ? '★' : '☆';
    starBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    starBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const starred = toggleUserFavoriteGlyph(item.char);
      starBtn.textContent = starred ? '★' : '☆';
      starBtn.className = `glyph-star-btn${starred ? ' starred' : ''}`;
      renderQuickFavsBar();
      if (activeGlyphCat === 'fav') renderGlyphs();
    });

    // Minecraft Bitmap Canvas (crisp pixelated monochrome rendering)
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    canvas.className = 'glyph-canvas';
    renderGlyphToCanvas(canvas, item.char, activeGlyphTint, 2);

    const advance = getCharPixelAdvance(item.char);
    const metaEl = document.createElement('span');
    metaEl.className = `glyph-card-meta${item.isSmp ? ' smp' : ''}`;
    metaEl.textContent = item.isSmp ? 'SMP' : `${advance}px`;

    card.appendChild(starBtn);
    card.appendChild(canvas);
    card.appendChild(metaEl);

    card.addEventListener('mouseenter', () => {
      updateGlyphInspector(item);
    });

    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const starred = toggleUserFavoriteGlyph(item.char);
      starBtn.textContent = starred ? '★' : '☆';
      starBtn.className = `glyph-star-btn${starred ? ' starred' : ''}`;
      renderQuickFavsBar();
      if (activeGlyphCat === 'fav') renderGlyphs();
    });

    card.addEventListener('click', () => {
      insertAtCursor(item.char);
      addRecentGlyph(item.char);
      showToast(`Inserted "${item.char}" (${advance}px)`, 'info');
    });

    glyphGrid.appendChild(card);
  });

  if (itemsToRender.length === 0) {
    if (activeGlyphCat === 'fav') {
      glyphGrid.innerHTML = '<p class="ruler-empty" style="grid-column: 1/-1;">No favorites yet! Click the star ☆ on any glyph tile to add it here.</p>';
    } else if (activeGlyphCat === 'recent') {
      glyphGrid.innerHTML = '<p class="ruler-empty" style="grid-column: 1/-1;">No recent glyphs yet. Click any symbol to insert it.</p>';
    } else {
      glyphGrid.innerHTML = '<p class="ruler-empty" style="grid-column: 1/-1;">No matching glyphs found</p>';
    }
  }
}

// ─── Export & Import Handlers ─────────────────────────────────────────────────

function downloadFile(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function renderExportFormats(): void {
  saveCurrentPageToBook();

  const formats: Array<{
    name: string;
    sub: string;
    filename: string;
    mime: string;
    fn: () => string;
    canDownload: boolean;
  }> = [
    {
      name: 'Modern /give Command',
      sub: 'Minecraft Java 1.21.5+ and 26.x (SNBT Components)',
      filename: 'give_modern.txt',
      mime: 'text/plain',
      fn: () => exportToGiveCommandModern(book),
      canDownload: false,
    },
    {
      name: 'JSON-Pages /give Command',
      sub: 'Minecraft Java 1.20.5–1.21.4 (JSON String Components)',
      filename: 'give_json_pages.txt',
      mime: 'text/plain',
      fn: () => exportToGiveCommandJsonPages(book),
      canDownload: false,
    },
    {
      name: 'Legacy /give Command',
      sub: 'Minecraft Java 1.13–1.20.4 (Classic NBT JSON Strings)',
      filename: 'give_legacy.txt',
      mime: 'text/plain',
      fn: () => exportToGiveCommandLegacy(book),
      canDownload: false,
    },
    {
      name: 'Minecraft Function File (.mcfunction)',
      sub: 'For long books exceeding chat line limits',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}.mcfunction`,
      mime: 'text/plain',
      fn: () => `give @p ${exportToGiveCommandModern(book).replace(/^\/give\s+@p\s+/, '')}`,
      canDownload: true,
    },
    {
      name: 'Stendhal (.stendhal)',
      sub: 'Human-readable YAML frontmatter with #- page markers',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}.stendhal`,
      mime: 'text/yaml',
      fn: () => exportToStendhal(book),
      canDownload: true,
    },
    {
      name: 'Scribble JSON',
      sub: 'Modern JSON schema for Scribble mod',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}_scribble.json`,
      mime: 'application/json',
      fn: () => exportToScribbleJson(book),
      canDownload: true,
    },
    {
      name: 'BookCopy JSON',
      sub: 'Record format with generation and page array',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}_bookcopy.json`,
      mime: 'application/json',
      fn: () => exportToBookCopyJson(book),
      canDownload: true,
    },
    {
      name: 'CMI BookExport (.txt)',
      sub: 'Server book format with <AutoPage> / <NextPage> markers',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}_cmi.txt`,
      mime: 'text/plain',
      fn: () => exportToCmiText(book),
      canDownload: true,
    },
    {
      name: 'Bedrock JSON',
      sub: 'Bedrock Edition raw book schema',
      filename: `${(book.title || 'book').toLowerCase().replace(/\s+/g, '_')}_bedrock.json`,
      mime: 'application/json',
      fn: () => exportToBedrockJson(book),
      canDownload: true,
    },
  ];

  exportFormatsEl.innerHTML = '';
  formats.forEach((fmt) => {
    const card = document.createElement('div');
    card.className = 'export-card';

    const info = document.createElement('div');
    info.className = 'export-info';

    const title = document.createElement('span');
    title.className = 'export-name';
    title.textContent = fmt.name;

    const sub = document.createElement('span');
    sub.className = 'export-sub';
    sub.textContent = fmt.sub;

    info.appendChild(title);
    info.appendChild(sub);

    const btns = document.createElement('div');
    btns.className = 'export-btns';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-xs btn-outline';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', async () => {
      try {
        const text = fmt.fn();
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = '✓ Copied';
        setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
        showToast(`Copied ${fmt.name} to clipboard!`, 'success');
      } catch {
        showToast('Failed to copy to clipboard', 'warn');
      }
    });
    btns.appendChild(copyBtn);

    if (fmt.canDownload) {
      const dlBtn = document.createElement('button');
      dlBtn.className = 'btn btn-xs btn-primary';
      dlBtn.textContent = 'Download';
      dlBtn.addEventListener('click', () => {
        try {
          const content = fmt.fn();
          downloadFile(content, fmt.filename, fmt.mime);
          showToast(`Downloaded ${fmt.filename}`, 'success');
        } catch {
          showToast('Failed to download file', 'warn');
        }
      });
      btns.appendChild(dlBtn);
    }

    card.appendChild(info);
    card.appendChild(btns);
    exportFormatsEl.appendChild(card);
  });
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function wireEvents(): void {
  // 1. Mode Toggle (14 Lines vs Raw Textarea)
  if (btnToggleEditorMode) {
    btnToggleEditorMode.addEventListener('click', () => {
      isRawMode = !isRawMode;
      if (isRawMode) {
        textarea.value = getPageTextFromLines(currentLines);
        bookLinesList.style.display = 'none';
        textarea.style.display = 'block';
        btnToggleEditorMode.textContent = 'Mode: Raw Text';
        showToast('Switched to Raw Textarea View', 'info');
      } else {
        currentLines = getLinesFromPageText(textarea.value);
        for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
          if (lineInputEls[i]) lineInputEls[i].value = currentLines[i] ?? '';
        }
        textarea.style.display = 'none';
        bookLinesList.style.display = 'flex';
        btnToggleEditorMode.textContent = 'Mode: 14 Lines';
        showToast('Switched to 14-Line Book View', 'info');
      }
      updateAll(true);
    });
  }

  // 2. Textarea (Raw mode) & Meta Inputs
  textarea.addEventListener('input', () => {
    if (isRawMode) {
      currentLines = getLinesFromPageText(textarea.value);
    }
    pushUndoSnapshot();
    updateAll();
  });

  metaTitle.addEventListener('input', () => {
    pushUndoSnapshot();
    updateAll();
  });

  metaAuthor.addEventListener('input', () => {
    pushUndoSnapshot();
    updateAll();
  });

  // 3. Undo / Redo
  btnUndo.addEventListener('click', () => undo());
  btnRedo.addEventListener('click', () => redo());

  // 4. 16 Color Swatches
  document.querySelectorAll<HTMLButtonElement>('.color-swatches .color-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = btn.dataset.code;
      if (!code) return;
      applyFormatting(code);
    });
  });

  // 5. Style Buttons
  document.querySelectorAll<HTMLButtonElement>('.style-tools .tag-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const code = btn.dataset.code;
      if (!code) return;
      if (code === '\\n') {
        if (!isRawMode && activeLineIndex < MINECRAFT_LINES_PER_PAGE - 1) {
          activeLineIndex++;
          updateActiveRowClass();
          lineInputEls[activeLineIndex]?.focus();
          lineInputEls[activeLineIndex]?.setSelectionRange(0, 0);
        } else {
          insertAtCursor('\n');
        }
      } else {
        applyFormatting(code);
      }
    });
  });

  // 5b. Center Line (Balance Left and Right Margins with Spaces)
  btnCenterLine?.addEventListener('click', (e) => {
    e.preventDefault();
    if (isRawMode) {
      const pos = textarea.selectionStart ?? textarea.value.length;
      const text = textarea.value;
      const lines = text.split('\n');
      let charCount = 0;
      let targetLineIdx = 0;
      for (let i = 0; i < lines.length; i++) {
        const nextCount = charCount + lines[i]!.length + 1;
        if (pos <= nextCount) {
          targetLineIdx = i;
          break;
        }
        charCount = nextCount;
      }
      const rawTarget = lines[targetLineIdx] ?? '';
      if (!rawTarget.trim()) {
        showToast('Line is empty', 'info');
        return;
      }
      pushUndoSnapshot();
      lines[targetLineIdx] = centerLineText(rawTarget, maxWidth());
      textarea.value = lines.join('\n');
      currentLines = getLinesFromPageText(textarea.value);
      updateAll(true);
      showToast(`Centered line ${targetLineIdx + 1}`, 'success');
    } else {
      const rawTarget = currentLines[activeLineIndex] ?? '';
      if (!rawTarget.trim()) {
        showToast(`Line ${activeLineIndex + 1} is empty`, 'info');
        return;
      }
      pushUndoSnapshot();
      const style = getCarriedStyleForLine(currentLines, activeLineIndex);
      const centered = centerLineText(rawTarget, maxWidth(), style);
      currentLines[activeLineIndex] = centered;
      if (lineInputEls[activeLineIndex]) {
        lineInputEls[activeLineIndex].value = centered;
      }
      updateAll(true);
      showToast(`Centered Line ${activeLineIndex + 1}`, 'success');
    }
  });

  // 6. Fill to Margin
  btnFillMargin.addEventListener('click', (e) => {
    e.preventDefault();
    const currentLine = isRawMode
      ? (textarea.value.slice(0, textarea.selectionStart ?? textarea.value.length).split('\n').pop() ?? '')
      : (currentLines[activeLineIndex] ?? '');

    const style = getCarriedStyleForLine(currentLines, activeLineIndex);
    const currentW = measureLineWidth(parseFormattedText(currentLine, style));
    const targetW = maxWidth();
    const spaces = calculateMarginFillSpaces(currentW, targetW);

    if (spaces) {
      insertAtCursor(spaces);
      showToast(`Padded line with spaces to reach margin`, 'info');
    } else {
      showToast('Line is already close to or over margin', 'warn');
    }
  });

  // 7. Deduplicate Codes (Clean)
  btnDedupCodes.addEventListener('click', (e) => {
    e.preventDefault();
    if (isRawMode) {
      const currentVal = textarea.value;
      const { cleaned, removedCount } = deduplicateCodes(currentVal);
      if (removedCount > 0) {
        pushUndoSnapshot();
        textarea.value = cleaned;
        currentLines = getLinesFromPageText(cleaned);
        updateAll(true);
        showToast(`Cleaned ${removedCount} duplicate formatting code(s)`, 'success');
      } else {
        showToast('No redundant duplicate formatting codes found', 'info');
      }
    } else {
      let totalRemoved = 0;
      for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
        const { cleaned, removedCount } = deduplicateCodes(currentLines[i] ?? '');
        if (removedCount > 0) {
          currentLines[i] = cleaned;
          if (lineInputEls[i]) lineInputEls[i].value = cleaned;
          totalRemoved += removedCount;
        }
      }
      if (totalRemoved > 0) {
        pushUndoSnapshot();
        updateAll(true);
        showToast(`Cleaned ${totalRemoved} duplicate formatting code(s)`, 'success');
      } else {
        showToast('No redundant duplicate formatting codes found', 'info');
      }
    }
  });

  async function triggerCopyPageFeedback(format: PageCopyFormat = 'raw', triggerBtn?: HTMLElement | null): Promise<void> {
    const ok = await copyPageToClipboard(format);
    if (ok && triggerBtn) {
      const origText = triggerBtn.textContent;
      triggerBtn.textContent = '✓ Copied!';
      setTimeout(() => {
        triggerBtn.textContent = origText;
      }, 1500);
    }
  }

  // 7b. Copy Page (Quick single page export for Minecraft paste)
  btnCopyPage?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerCopyPageFeedback('raw', btnCopyPage);
  });

  btnCopyPage?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (copyPageMenu) {
      copyPageMenu.style.display = copyPageMenu.style.display !== 'none' ? 'none' : 'flex';
    }
  });

  btnPreviewCopyPage?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerCopyPageFeedback('raw', btnPreviewCopyPage);
  });

  btnCopyPageOpts?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (copyPageMenu) {
      const isVisible = copyPageMenu.style.display !== 'none';
      copyPageMenu.style.display = isVisible ? 'none' : 'flex';
    }
  });

  copyPageMenu?.querySelectorAll<HTMLButtonElement>('.copy-option-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const fmt = (item.dataset.format as PageCopyFormat) || 'raw';
      if (copyPageMenu) copyPageMenu.style.display = 'none';
      triggerCopyPageFeedback(fmt, btnCopyPage);
    });
  });

  // 7c. Clear Page (Instant reset of current page with Undo history)
  btnClearPage?.addEventListener('click', (e) => {
    e.preventDefault();
    const isCurrentlyEmpty = isRawMode
      ? textarea.value.length === 0
      : currentLines.every((l) => !l || l.trim().length === 0);

    if (isCurrentlyEmpty) {
      showToast(`Page ${currentPageIndex + 1} is already empty`, 'info');
      return;
    }

    pushUndoSnapshot();
    currentLines = Array(MINECRAFT_LINES_PER_PAGE).fill('');
    for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
      if (lineInputEls[i]) lineInputEls[i].value = '';
    }
    textarea.value = '';
    book.pages[currentPageIndex] = '';
    updateAll(true);
    triggerAutosave();
    showToast(`Cleared Page ${currentPageIndex + 1} (Ctrl+Z to Undo)`, 'info');
  });

  // 7. Page Navigation Controls (Minecraft-exact advance to add page)
  function retreatPage(): void {
    saveCurrentPageToBook();
    if (currentPageIndex > 0) {
      loadPageIntoEditor(currentPageIndex - 1);
      viewer?.prevPage();
      updateGalleryCounts();
    }
  }

  function advancePage(): void {
    saveCurrentPageToBook();
    if (currentPageIndex < book.pages.length - 1) {
      loadPageIntoEditor(currentPageIndex + 1);
      viewer?.nextPage();
      updateGalleryCounts();
    } else if (book.pages.length < MINECRAFT_MAX_PAGES) {
      // Minecraft BookEditScreen behavior: advance on last page appends blank page
      pushUndoSnapshot();
      book.pages.push('');
      loadPageIntoEditor(book.pages.length - 1);
      syncViewerToBook();
      viewer?.setPage(currentPageIndex);
      updateGalleryCounts();
      showToast(`Added & advanced to Page ${book.pages.length}`, 'success');
    } else {
      showToast(`Maximum ${MINECRAFT_MAX_PAGES} pages reached`, 'warn');
    }
  }

  btnPrevPage.addEventListener('click', retreatPage);
  btnNextPage.addEventListener('click', advancePage);

  // 8. Page & Line Gallery Wire Events
  savedTemplates = loadSavedTemplates();
  updateGalleryCounts();

  function updateGalleryCounts(): void {
    if (galleryTabPageCount) galleryTabPageCount.textContent = book.pages.length.toString();
    if (galleryTabLibCount) galleryTabLibCount.textContent = savedTemplates.length.toString();
  }

  function renderGalleryPages(): void {
    if (!galleryPagesGrid) return;
    galleryPagesGrid.innerHTML = '';
    const statusEl = document.getElementById('gallery-current-status');
    if (statusEl) {
      statusEl.textContent = `Editing Page ${currentPageIndex + 1} of ${book.pages.length}`;
    }

    if (btnGalleryAddBlank) {
      btnGalleryAddBlank.disabled = book.pages.length >= MINECRAFT_MAX_PAGES;
    }

    book.pages.forEach((pageContent, idx) => {
      const card = document.createElement('div');
      card.className = `gallery-page-card${idx === currentPageIndex ? ' active-page-card' : ''}`;

      const lines = getLinesFromPageText(pageContent);
      const nonEmptyCount = lines.filter(l => l.trim().length > 0).length;
      const charCount = pageContent.length;

      // Header
      const header = document.createElement('div');
      header.className = 'gallery-card-header';
      header.innerHTML = `
        <span class="gallery-card-title">
          Page ${idx + 1}
          ${idx === currentPageIndex ? '<span class="badge badge-ok">Active</span>' : ''}
        </span>
        <span class="gallery-card-meta">${nonEmptyCount}/14 lines • ${charCount}c</span>
      `;
      card.appendChild(header);

      // Miniature Parchment Preview
      const preview = document.createElement('div');
      preview.className = 'parchment-preview-slot';
      preview.title = 'Click to open and edit this page';
      for (let lineIdx = 0; lineIdx < MINECRAFT_LINES_PER_PAGE; lineIdx++) {
        preview.appendChild(renderFormattedMiniLine(lines[lineIdx] ?? ''));
      }
      preview.addEventListener('click', () => {
        saveCurrentPageToBook();
        loadPageIntoEditor(idx);
        viewer?.setPage(idx);
        galleryDialog.close();
      });
      card.appendChild(preview);

      // Actions Footer
      const actions = document.createElement('div');
      actions.className = 'gallery-card-actions';

      const leftGroup = document.createElement('div');
      leftGroup.className = 'card-btn-group';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-card-action btn-card-primary';
      editBtn.textContent = '✏️ Edit';
      editBtn.title = 'Edit this page';
      editBtn.addEventListener('click', () => {
        saveCurrentPageToBook();
        loadPageIntoEditor(idx);
        viewer?.setPage(idx);
        galleryDialog.close();
      });

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'btn-card-action';
      dupBtn.textContent = '⎘ Dup';
      dupBtn.title = 'Duplicate this page';
      dupBtn.addEventListener('click', () => {
        if (book.pages.length >= MINECRAFT_MAX_PAGES) {
          showToast(`Maximum ${MINECRAFT_MAX_PAGES} pages reached`, 'warn');
          return;
        }
        pushUndoSnapshot();
        saveCurrentPageToBook();
        book.pages.splice(idx + 1, 0, book.pages[idx] ?? '');
        loadPageIntoEditor(idx + 1);
        syncViewerToBook();
        viewer?.setPage(idx + 1);
        renderGalleryPages();
        updateGalleryCounts();
        showToast(`Duplicated to Page ${idx + 2}`, 'success');
      });

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn-card-action';
      saveBtn.textContent = '💾 Save';
      saveBtn.title = 'Save this page layout to library';
      saveBtn.addEventListener('click', () => {
        switchGalleryTab('save');
        saveItemTitle.value = `${book.title || 'Book'} - Page ${idx + 1}`;
        const radioPage = document.querySelector<HTMLInputElement>('input[name="save-scope"][value="page"]');
        if (radioPage) radioPage.checked = true;
        updateSavePreview(getLinesFromPageText(book.pages[idx] ?? ''));
      });

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'btn-card-action';
      copyBtn.textContent = '📋 Copy';
      copyBtn.title = 'Copy this page to clipboard for Minecraft paste';
      copyBtn.addEventListener('click', async () => {
        const pageText = book.pages[idx] ?? '';
        const lines = getLinesFromPageText(pageText);
        const text = formatPageForClipboard(lines, 'raw', { title: book.title, author: book.author });
        if (!text) {
          showToast(`Page ${idx + 1} is empty`, 'info');
          return;
        }
        const ok = await writeTextToClipboard(text);
        if (ok) {
          copyBtn.textContent = '✓ Copied';
          setTimeout(() => { copyBtn.textContent = '📋 Copy'; }, 1500);
          showToast(`Copied Page ${idx + 1} to clipboard! Paste directly into Book & Quill (Ctrl+V)`, 'success');
        } else {
          showToast('Failed to copy to clipboard', 'warn');
        }
      });

      leftGroup.appendChild(editBtn);
      leftGroup.appendChild(dupBtn);
      leftGroup.appendChild(saveBtn);
      leftGroup.appendChild(copyBtn);

      const rightGroup = document.createElement('div');
      rightGroup.className = 'card-btn-group';

      if (idx > 0) {
        const moveLeftBtn = document.createElement('button');
        moveLeftBtn.type = 'button';
        moveLeftBtn.className = 'btn-card-action';
        moveLeftBtn.textContent = '◀';
        moveLeftBtn.title = 'Move page earlier';
        moveLeftBtn.addEventListener('click', () => {
          pushUndoSnapshot();
          saveCurrentPageToBook();
          const tmp = book.pages[idx];
          book.pages[idx] = book.pages[idx - 1] ?? '';
          book.pages[idx - 1] = tmp ?? '';
          if (currentPageIndex === idx) currentPageIndex = idx - 1;
          else if (currentPageIndex === idx - 1) currentPageIndex = idx;
          loadPageIntoEditor(currentPageIndex);
          syncViewerToBook();
          viewer?.setPage(currentPageIndex);
          renderGalleryPages();
        });
        rightGroup.appendChild(moveLeftBtn);
      }

      if (idx < book.pages.length - 1) {
        const moveRightBtn = document.createElement('button');
        moveRightBtn.type = 'button';
        moveRightBtn.className = 'btn-card-action';
        moveRightBtn.textContent = '▶';
        moveRightBtn.title = 'Move page later';
        moveRightBtn.addEventListener('click', () => {
          pushUndoSnapshot();
          saveCurrentPageToBook();
          const tmp = book.pages[idx];
          book.pages[idx] = book.pages[idx + 1] ?? '';
          book.pages[idx + 1] = tmp ?? '';
          if (currentPageIndex === idx) currentPageIndex = idx + 1;
          else if (currentPageIndex === idx + 1) currentPageIndex = idx;
          loadPageIntoEditor(currentPageIndex);
          syncViewerToBook();
          viewer?.setPage(currentPageIndex);
          renderGalleryPages();
        });
        rightGroup.appendChild(moveRightBtn);
      }

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-card-action btn-card-danger';
      delBtn.textContent = '🗑';
      delBtn.title = 'Delete this page';
      delBtn.addEventListener('click', () => {
        pushUndoSnapshot();
        if (book.pages.length <= 1) {
          book.pages[0] = '';
          loadPageIntoEditor(0);
          syncViewerToBook();
          renderGalleryPages();
          updateGalleryCounts();
          showToast('Cleared Page 1', 'info');
          return;
        }
        book.pages.splice(idx, 1);
        const newIdx = Math.min(currentPageIndex >= idx ? Math.max(0, currentPageIndex - 1) : currentPageIndex, book.pages.length - 1);
        loadPageIntoEditor(newIdx);
        syncViewerToBook();
        viewer?.setPage(newIdx);
        renderGalleryPages();
        updateGalleryCounts();
        showToast(`Deleted Page ${idx + 1}`, 'info');
      });
      rightGroup.appendChild(delBtn);

      actions.appendChild(leftGroup);
      actions.appendChild(rightGroup);
      card.appendChild(actions);

      galleryPagesGrid.appendChild(card);
    });
  }

  function renderGalleryLibrary(): void {
    if (!galleryTemplatesGrid) return;
    galleryTemplatesGrid.innerHTML = '';

    const hiddenIds = getHiddenPresetIds();
    const filtered = savedTemplates.filter(t => {
      if (t.isPreset && hiddenIds.has(t.id)) return false;
      if (activeLibraryFilter === 'page') return t.scope === 'page';
      if (activeLibraryFilter === 'lines') return t.scope === 'lines';
      if (activeLibraryFilter === 'preset') return t.isPreset;
      if (activeLibraryFilter === 'custom') return !t.isPreset;
      return true;
    });

    if (filtered.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'gallery-empty-state';
      emptyMsg.style.gridColumn = '1 / -1';
      emptyMsg.style.padding = '24px';
      emptyMsg.style.textAlign = 'center';
      emptyMsg.style.color = '#888888';
      emptyMsg.style.fontFamily = 'var(--font-mono)';
      emptyMsg.innerHTML = `
        <p>No templates found for filter "<b>${activeLibraryFilter}</b>".</p>
        <button type="button" class="btn btn-xs btn-primary" id="btn-empty-save-current" style="margin-top: 8px;">+ Save Current Page or Lines</button>
      `;
      galleryTemplatesGrid.appendChild(emptyMsg);
      document.getElementById('btn-empty-save-current')?.addEventListener('click', () => switchGalleryTab('save'));
      return;
    }

    filtered.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'gallery-template-card';

      // Header
      const header = document.createElement('div');
      header.className = 'gallery-card-header';
      header.innerHTML = `
        <span class="gallery-card-title">${tpl.title}</span>
        <span class="badge ${tpl.scope === 'page' ? 'badge-ok' : ''}">${tpl.scope === 'page' ? 'PAGE' : 'LINES'} • ${tpl.category}</span>
      `;
      card.appendChild(header);

      // Miniature Parchment Preview
      const preview = document.createElement('div');
      preview.className = 'parchment-preview-slot';
      preview.title = tpl.scope === 'page' ? 'Apply template to page' : 'Insert lines into current page';
      const maxRows = Math.min(tpl.lines.length, MINECRAFT_LINES_PER_PAGE);
      for (let r = 0; r < maxRows; r++) {
        preview.appendChild(renderFormattedMiniLine(tpl.lines[r] ?? ''));
      }
      preview.addEventListener('click', () => {
        applyTemplate(tpl);
      });
      card.appendChild(preview);

      // Actions Footer
      const actions = document.createElement('div');
      actions.className = 'gallery-card-actions';

      const leftGroup = document.createElement('div');
      leftGroup.className = 'card-btn-group';

      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn-card-action btn-card-primary';
      applyBtn.textContent = tpl.scope === 'page' ? 'Apply Page' : 'Insert Lines';
      applyBtn.title = tpl.scope === 'page' ? 'Replace current page with this layout' : 'Insert lines starting at active row';
      applyBtn.addEventListener('click', () => applyTemplate(tpl));

      const newPageBtn = document.createElement('button');
      newPageBtn.type = 'button';
      newPageBtn.className = 'btn-card-action';
      newPageBtn.textContent = '+ New Page';
      newPageBtn.title = 'Insert as a new page in book';
      newPageBtn.addEventListener('click', () => {
        if (book.pages.length >= MINECRAFT_MAX_PAGES) {
          showToast(`Maximum ${MINECRAFT_MAX_PAGES} pages reached`, 'warn');
          return;
        }
        pushUndoSnapshot();
        saveCurrentPageToBook();
        const pageText = tpl.lines.join('\n');
        book.pages.splice(currentPageIndex + 1, 0, pageText);
        loadPageIntoEditor(currentPageIndex + 1);
        syncViewerToBook();
        viewer?.setPage(currentPageIndex);
        updateGalleryCounts();
        galleryDialog.close();
        showToast(`Inserted "${tpl.title}" as Page ${currentPageIndex + 1}`, 'success');
      });

      leftGroup.appendChild(applyBtn);
      leftGroup.appendChild(newPageBtn);

      const rightGroup = document.createElement('div');
      rightGroup.className = 'card-btn-group';

      const dupBtn = document.createElement('button');
      dupBtn.type = 'button';
      dupBtn.className = 'btn-card-action';
      dupBtn.textContent = '⎘';
      dupBtn.title = 'Duplicate this saved template';
      dupBtn.addEventListener('click', () => {
        const copy: SavedTemplate = {
          ...tpl,
          id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: `${tpl.title} (Copy)`,
          createdAt: Date.now(),
          isPreset: false,
        };
        savedTemplates.push(copy);
        saveUserTemplates(savedTemplates);
        renderGalleryLibrary();
        updateGalleryCounts();
        showToast(`Duplicated "${copy.title}"`, 'success');
      });
      rightGroup.appendChild(dupBtn);

      if (!tpl.isPreset) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-card-action btn-card-danger';
        delBtn.textContent = '🗑';
        delBtn.title = 'Delete saved template';
        delBtn.addEventListener('click', () => {
          savedTemplates = savedTemplates.filter(t => t.id !== tpl.id);
          saveUserTemplates(savedTemplates);
          renderGalleryLibrary();
          renderDeckPastes();
          updateGalleryCounts();
          showToast(`Deleted "${tpl.title}"`, 'info');
        });
        rightGroup.appendChild(delBtn);
      } else {
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'btn-card-action';
        hideBtn.textContent = '✕';
        hideBtn.title = 'Hide built-in preset (can restore with Reset Presets)';
        hideBtn.addEventListener('click', () => {
          const ids = getHiddenPresetIds();
          ids.add(tpl.id);
          saveHiddenPresetIds(ids);
          renderGalleryLibrary();
          renderDeckPastes();
          showToast(`Hidden "${tpl.title}"`, 'info');
        });
        rightGroup.appendChild(hideBtn);
      }

      actions.appendChild(leftGroup);
      actions.appendChild(rightGroup);
      card.appendChild(actions);

      galleryTemplatesGrid.appendChild(card);
    });
  }

  function applyTemplate(tpl: SavedTemplate): void {
    pushUndoSnapshot();
    if (tpl.scope === 'page') {
      currentLines = [...tpl.lines];
      while (currentLines.length < MINECRAFT_LINES_PER_PAGE) currentLines.push('');
      currentLines = currentLines.slice(0, MINECRAFT_LINES_PER_PAGE);
      reflowPageLines(currentLines, 0, maxWidth(), MINECRAFT_LINES_PER_PAGE);
      for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
        if (lineInputEls[i]) lineInputEls[i].value = currentLines[i] ?? '';
      }
      updateAll(true);
      galleryDialog.close();
      showToast(`Applied "${tpl.title}" to Page ${currentPageIndex + 1}`, 'success');
    } else {
      const startRow = Math.max(0, Math.min(activeLineIndex, MINECRAFT_LINES_PER_PAGE - 1));
      for (let i = 0; i < tpl.lines.length && startRow + i < MINECRAFT_LINES_PER_PAGE; i++) {
        currentLines[startRow + i] = tpl.lines[i] ?? '';
      }
      reflowPageLines(currentLines, startRow, maxWidth(), MINECRAFT_LINES_PER_PAGE);
      for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
        if (lineInputEls[i]) lineInputEls[i].value = currentLines[i] ?? '';
      }
      updateAll(true);
      galleryDialog.close();
      showToast(`Inserted ${tpl.lines.length} lines from "${tpl.title}"`, 'success');
    }
  }

  function getLinesToSave(scope: 'page' | 'current-line' | 'non-empty'): string[] {
    if (scope === 'current-line') {
      const row = Math.max(0, Math.min(activeLineIndex, MINECRAFT_LINES_PER_PAGE - 1));
      return [currentLines[row] ?? ''];
    }
    if (scope === 'non-empty') {
      const filtered = currentLines.filter(l => l.trim().length > 0);
      return filtered.length > 0 ? filtered : [''];
    }
    // scope === 'page'
    return [...currentLines];
  }

  function updateSavePreview(customLines?: string[]): void {
    if (!gallerySavePreview) return;
    gallerySavePreview.innerHTML = '';
    const scopeRadio = document.querySelector<HTMLInputElement>('input[name="save-scope"]:checked');
    const scope = (scopeRadio?.value as 'page' | 'current-line' | 'non-empty') || 'page';
    const lines = customLines ?? getLinesToSave(scope);

    lines.forEach(l => {
      gallerySavePreview.appendChild(renderFormattedMiniLine(l));
    });
  }

  function setupGallerySaveForm(): void {
    const scopeRadio = document.querySelector<HTMLInputElement>('input[name="save-scope"]:checked');
    const scope = (scopeRadio?.value as 'page' | 'current-line' | 'non-empty') || 'page';

    if (saveItemTitle) {
      if (scope === 'current-line') {
        const text = stripFormatting(currentLines[activeLineIndex] || '').trim();
        saveItemTitle.value = text ? `Line ${activeLineIndex + 1}: ${text.slice(0, 16)}` : `Line ${activeLineIndex + 1} Snippet`;
      } else {
        saveItemTitle.value = `${book.title || 'Book'} - Page ${currentPageIndex + 1}`;
      }
    }
    const currentLineLabel = document.getElementById('save-scope-current-line-label');
    if (currentLineLabel) {
      currentLineLabel.textContent = `Active Line (Line ${activeLineIndex + 1})`;
    }
    updateSavePreview();
  }

  const btnGalleryRestoreDefaults = document.getElementById('btn-gallery-restore-defaults');
  btnGalleryRestoreDefaults?.addEventListener('click', () => {
    saveHiddenPresetIds(new Set());
    renderGalleryLibrary();
    renderDeckPastes();
    showToast('Restored all default presets', 'success');
  });

  function switchGalleryTab(tab: 'pages' | 'library' | 'save'): void {
    activeGalleryTab = tab;
    if (galleryTabsNav) {
      galleryTabsNav.querySelectorAll<HTMLButtonElement>('.gallery-tab').forEach(t => {
        const isActive = t.dataset.tab === tab;
        t.classList.toggle('active', isActive);
        t.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    if (galleryPanePages) galleryPanePages.style.display = tab === 'pages' ? 'flex' : 'none';
    if (galleryPaneLibrary) galleryPaneLibrary.style.display = tab === 'library' ? 'flex' : 'none';
    if (galleryPaneSave) galleryPaneSave.style.display = tab === 'save' ? 'flex' : 'none';

    if (tab === 'pages') renderGalleryPages();
    else if (tab === 'library') renderGalleryLibrary();
    else if (tab === 'save') setupGallerySaveForm();
  }

  function openGallery(initialTab: 'pages' | 'library' | 'save' = 'pages'): void {
    saveCurrentPageToBook();
    updateGalleryCounts();
    switchGalleryTab(initialTab);
    galleryDialog?.showModal();
  }

  // Gallery Navigation Buttons
  btnOpenGallery?.addEventListener('click', () => openGallery('pages'));
  btnOpenGalleryTool?.addEventListener('click', () => openGallery('pages'));
  btnSaveGallery?.addEventListener('click', () => openGallery('save'));

  galleryTabsNav?.querySelectorAll<HTMLButtonElement>('.gallery-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab as 'pages' | 'library' | 'save';
      if (targetTab) switchGalleryTab(targetTab);
    });
  });

  galleryFilterChips?.querySelectorAll<HTMLButtonElement>('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      galleryFilterChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeLibraryFilter = (chip.dataset.filter as any) || 'all';
      renderGalleryLibrary();
    });
  });

  btnGalleryAddBlank?.addEventListener('click', () => {
    if (book.pages.length >= MINECRAFT_MAX_PAGES) {
      showToast(`Maximum ${MINECRAFT_MAX_PAGES} pages reached`, 'warn');
      return;
    }
    pushUndoSnapshot();
    saveCurrentPageToBook();
    book.pages.push('');
    loadPageIntoEditor(book.pages.length - 1);
    syncViewerToBook();
    viewer?.setPage(currentPageIndex);
    renderGalleryPages();
    updateGalleryCounts();
    showToast(`Added Blank Page ${book.pages.length}`, 'success');
  });

  btnGalleryDupActive?.addEventListener('click', () => {
    if (book.pages.length >= MINECRAFT_MAX_PAGES) {
      showToast(`Maximum ${MINECRAFT_MAX_PAGES} pages reached`, 'warn');
      return;
    }
    pushUndoSnapshot();
    saveCurrentPageToBook();
    const activeText = book.pages[currentPageIndex] ?? '';
    book.pages.splice(currentPageIndex + 1, 0, activeText);
    loadPageIntoEditor(currentPageIndex + 1);
    syncViewerToBook();
    viewer?.setPage(currentPageIndex);
    renderGalleryPages();
    updateGalleryCounts();
    showToast(`Duplicated Active Page as Page ${currentPageIndex + 1}`, 'success');
  });

  btnGallerySwitchSave?.addEventListener('click', () => switchGalleryTab('save'));

  btnGalleryExportLib?.addEventListener('click', () => {
    const userOnly = savedTemplates.filter(t => !t.isPreset);
    const jsonStr = JSON.stringify(userOnly, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookgame_gallery_library.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${userOnly.length} saved templates`, 'success');
  });

  btnGalleryImportLib?.addEventListener('click', () => {
    galleryImportFileInput?.click();
  });

  galleryImportFileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string;
        const imported = JSON.parse(raw);
        if (Array.isArray(imported)) {
          let count = 0;
          imported.forEach((item: any) => {
            if (item.title && Array.isArray(item.lines)) {
              savedTemplates.push({
                id: item.id || `imported-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                title: item.title,
                scope: item.scope === 'lines' ? 'lines' : 'page',
                category: item.category || 'Custom',
                lines: item.lines,
                createdAt: item.createdAt || Date.now(),
                isPreset: false,
              });
              count++;
            }
          });
          saveUserTemplates(savedTemplates);
          renderGalleryLibrary();
          updateGalleryCounts();
          showToast(`Imported ${count} template(s) to Library`, 'success');
        } else {
          showToast('Invalid gallery library JSON file', 'warn');
        }
      } catch {
        showToast('Failed to parse JSON file', 'warn');
      }
    };
    reader.readAsText(file);
  });

  document.querySelectorAll<HTMLInputElement>('input[name="save-scope"]').forEach(r => {
    r.addEventListener('change', () => updateSavePreview());
  });

  btnCancelSaveGallery?.addEventListener('click', () => switchGalleryTab('library'));

  btnConfirmSaveGallery?.addEventListener('click', () => {
    const title = saveItemTitle?.value.trim() || `Template ${savedTemplates.length + 1}`;
    const scopeRadio = document.querySelector<HTMLInputElement>('input[name="save-scope"]:checked');
    const scope = (scopeRadio?.value as 'page' | 'current-line' | 'non-empty') || 'page';
    const category = saveItemCategory?.value || 'Custom';
    const lines = getLinesToSave(scope);

    const newTemplate: SavedTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title,
      scope: scope === 'current-line' ? 'lines' : (scope === 'non-empty' ? 'lines' : 'page'),
      category,
      lines,
      createdAt: Date.now(),
      isPreset: false,
    };

    savedTemplates.push(newTemplate);
    saveUserTemplates(savedTemplates);
    updateGalleryCounts();
    renderDeckPastes();
    switchGalleryTab('library');
    showToast(`Saved "${newTemplate.title}" to Presets Deck and Library`, 'success');
  });

  // 9. Matrix Selector & Tools Hub Wire Events
  renderMatrixSlots();

  matrixPxUp?.addEventListener('click', () => {
    let currentPx = currentMatrixMode.type === 'width' ? currentMatrixMode.px : 6;
    const idx = WIDTH_STEPS.indexOf(currentPx);
    const nextPx = idx !== -1 && idx < WIDTH_STEPS.length - 1 ? WIDTH_STEPS[idx + 1]! : WIDTH_STEPS[0]!;
    currentMatrixMode = { type: 'width', px: nextPx };
    currentMatrixPage = 0;
    updateActiveMatrixChip();
    renderMatrixSlots();
  });

  matrixPxDown?.addEventListener('click', () => {
    let currentPx = currentMatrixMode.type === 'width' ? currentMatrixMode.px : 6;
    const idx = WIDTH_STEPS.indexOf(currentPx);
    const prevPx = idx !== -1 && idx > 0 ? WIDTH_STEPS[idx - 1]! : WIDTH_STEPS[WIDTH_STEPS.length - 1]!;
    currentMatrixMode = { type: 'width', px: prevPx };
    currentMatrixPage = 0;
    updateActiveMatrixChip();
    renderMatrixSlots();
  });

  matrixPagePrev?.addEventListener('click', () => {
    const list = getGlyphsForCurrentSelection();
    const totalPages = Math.max(1, Math.ceil(list.length / MATRIX_PAGE_SIZE));
    if (currentMatrixPage > 0) {
      currentMatrixPage--;
    } else {
      currentMatrixPage = totalPages - 1;
    }
    renderMatrixSlots();
  });

  matrixPageNext?.addEventListener('click', () => {
    const list = getGlyphsForCurrentSelection();
    const totalPages = Math.max(1, Math.ceil(list.length / MATRIX_PAGE_SIZE));
    if (currentMatrixPage < totalPages - 1) {
      currentMatrixPage++;
    } else {
      currentMatrixPage = 0;
    }
    renderMatrixSlots();
  });

  function updateActiveMatrixChip(): void {
    if (!matrixQuickWidths) return;
    matrixQuickWidths.querySelectorAll<HTMLButtonElement>('.matrix-chip').forEach(chip => {
      const setId = chip.dataset.set;
      const isActive = currentMatrixMode.type === 'set' && currentMatrixMode.setId === setId;
      chip.classList.toggle('active', !!isActive);
    });
  }

  matrixQuickWidths?.querySelectorAll<HTMLButtonElement>('.matrix-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const setId = chip.dataset.set;
      if (setId) {
        currentMatrixMode = { type: 'set', setId };
        currentMatrixPage = 0;
        updateActiveMatrixChip();
        renderMatrixSlots();
      }
    });
  });

  // Studio Tools Hub Dropdown Toggle
  btnStudioTools?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!studioToolsFlyout) return;
    const isHidden = studioToolsFlyout.style.display === 'none';
    studioToolsFlyout.style.display = isHidden ? 'block' : 'none';
  });

  btnCloseToolsFlyout?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (studioToolsFlyout) studioToolsFlyout.style.display = 'none';
  });

  window.addEventListener('click', (e) => {
    if (studioToolsFlyout && studioToolsFlyout.style.display !== 'none') {
      const target = e.target as HTMLElement;
      if (!studioToolsFlyout.contains(target) && target !== btnStudioTools && !btnStudioTools.contains(target)) {
        studioToolsFlyout.style.display = 'none';
      }
    }
  });

  // Author and Inline Title sync
  metaTitle?.addEventListener('input', () => {
    book.title = metaTitle.value.trim() || 'Untitled';
    if (metaTitleCount) metaTitleCount.textContent = `${metaTitle.value.length}/32`;
    triggerAutosave();
  });

  metaAuthor?.addEventListener('input', () => {
    book.author = metaAuthor.value.trim() || 'Author';
    if (metaAuthorCount) metaAuthorCount.textContent = `${metaAuthor.value.length}/16`;
    triggerAutosave();
  });

  // Below-the-fold Saved Art Deck
  let activeDeckFilter: 'all' | 'page' | 'lines' | 'custom' = 'all';

  function renderDeckPastes(): void {
    if (!deckPastesStrip) return;
    deckPastesStrip.innerHTML = '';

    const hiddenIds = getHiddenPresetIds();
    const visibleDefaults = DEFAULT_PRESETS.filter(p => !hiddenIds.has(p.id));
    const userItems = savedTemplates.filter(t => !t.isPreset);
    const allDeckItems = [...visibleDefaults, ...userItems];

    const filtered = allDeckItems.filter(item => {
      if (activeDeckFilter === 'page') return item.scope === 'page';
      if (activeDeckFilter === 'lines') return item.scope === 'lines';
      if (activeDeckFilter === 'custom') return !item.isPreset;
      return true;
    });

    const badgeEl = document.getElementById('deck-presets-badge');
    if (badgeEl) {
      badgeEl.textContent = `${filtered.length} Saved`;
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.style.gridColumn = '1 / -1';
      empty.style.padding = '16px';
      empty.style.textAlign = 'center';
      empty.style.color = 'var(--text-secondary)';
      empty.style.fontFamily = 'var(--font-mono)';
      empty.innerHTML = `
        <p>No presets found for filter "<b>${activeDeckFilter}</b>".</p>
        <button type="button" class="btn btn-xs btn-primary" id="btn-deck-quick-save-hint" style="margin-top: 6px;">💾 Save Active Row or Page</button>
      `;
      deckPastesStrip.appendChild(empty);
      document.getElementById('btn-deck-quick-save-hint')?.addEventListener('click', () => {
        openGallery('save');
      });
      return;
    }

    filtered.forEach((preset) => {
      const card = document.createElement('div');
      card.className = 'deck-paste-card';

      const header = document.createElement('div');
      header.className = 'deck-paste-header';
      header.innerHTML = `
        <span class="deck-paste-title" title="${preset.title}">${preset.title}</span>
        <span class="badge ${preset.isPreset ? 'badge-ok' : ''}">${preset.isPreset ? 'BUILTIN' : 'CUSTOM'} • ${preset.scope.toUpperCase()}</span>
      `;
      card.appendChild(header);

      const preview = document.createElement('div');
      preview.className = 'deck-paste-preview';
      preview.title = `Click to stamp "${preset.title}" into book`;
      preset.lines.slice(0, 4).forEach(l => {
        preview.appendChild(renderFormattedMiniLine(l));
      });
      preview.addEventListener('click', () => {
        applyTemplate(preset);
        soundManager.playButtonClick();
        showToast(`Stamped "${preset.title}" into active page`, 'success');
      });
      card.appendChild(preview);

      const actions = document.createElement('div');
      actions.className = 'deck-card-actions';

      const stampBtn = document.createElement('button');
      stampBtn.type = 'button';
      stampBtn.className = 'btn-deck-action';
      stampBtn.textContent = '📥 Stamp';
      stampBtn.title = `Insert into current page`;
      stampBtn.addEventListener('click', () => {
        applyTemplate(preset);
        soundManager.playButtonClick();
        showToast(`Stamped "${preset.title}" into active page`, 'success');
      });
      actions.appendChild(stampBtn);

      if (preset.isPreset) {
        const hideBtn = document.createElement('button');
        hideBtn.type = 'button';
        hideBtn.className = 'btn-deck-action';
        hideBtn.textContent = '✕ Hide';
        hideBtn.title = 'Hide built-in preset (can restore in Gallery)';
        hideBtn.addEventListener('click', () => {
          hiddenIds.add(preset.id);
          saveHiddenPresetIds(hiddenIds);
          renderDeckPastes();
          renderGalleryLibrary();
          showToast(`Hidden "${preset.title}"`, 'info');
        });
        actions.appendChild(hideBtn);
      } else {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-deck-action btn-deck-danger';
        delBtn.textContent = '🗑 Delete';
        delBtn.title = 'Permanently delete this saved paste';
        delBtn.addEventListener('click', () => {
          savedTemplates = savedTemplates.filter(t => t.id !== preset.id);
          saveUserTemplates(savedTemplates);
          renderDeckPastes();
          renderGalleryLibrary();
          updateGalleryCounts();
          showToast(`Deleted "${preset.title}"`, 'info');
        });
        actions.appendChild(delBtn);
      }

      card.appendChild(actions);
      deckPastesStrip.appendChild(card);
    });
  }
  renderDeckPastes();

  // Deck filter chips wire events
  document.getElementById('deck-filter-chips')?.querySelectorAll<HTMLButtonElement>('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('deck-filter-chips')?.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeDeckFilter = (chip.dataset.deckFilter as any) || 'all';
      renderDeckPastes();
    });
  });

  // Collapsible Saved Art Deck handling
  function setDeckCollapsed(collapsed: boolean): void {
    if (!savedArtDeck) return;
    if (collapsed) {
      savedArtDeck.classList.add('collapsed');
      if (deckToggleIcon) deckToggleIcon.textContent = '▲';
      if (deckToggleText) deckToggleText.textContent = 'Expand Presets';
      btnDeckToggle?.classList.remove('btn-outline');
      btnDeckToggle?.classList.add('btn-primary');
    } else {
      savedArtDeck.classList.remove('collapsed');
      if (deckToggleIcon) deckToggleIcon.textContent = '▼';
      if (deckToggleText) deckToggleText.textContent = 'Collapse';
      btnDeckToggle?.classList.remove('btn-primary');
      btnDeckToggle?.classList.add('btn-outline');
    }
    try {
      localStorage.setItem('blockgame_art_deck_collapsed', collapsed ? 'true' : 'false');
    } catch {}
  }

  function toggleDeckCollapsed(): void {
    const isCollapsed = savedArtDeck?.classList.contains('collapsed');
    setDeckCollapsed(!isCollapsed);
  }

  // Restore deck collapsed state (default to true so user has spacious unobstructed editor & book preview)
  const savedCollapsed = localStorage.getItem('blockgame_art_deck_collapsed');
  setDeckCollapsed(savedCollapsed !== 'false');

  btnDeckToggle?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeckCollapsed();
  });

  deckTitleToggle?.addEventListener('click', () => {
    toggleDeckCollapsed();
  });

  deckTitleToggle?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDeckCollapsed();
    }
  });

  btnDeckSaveRow?.addEventListener('click', () => {
    openGallery('save');
    const r = document.querySelector<HTMLInputElement>('input[name="save-scope"][value="current-line"]');
    if (r) r.checked = true;
    setupGallerySaveForm();
  });

  btnDeckSavePage?.addEventListener('click', () => {
    openGallery('save');
    const r = document.querySelector<HTMLInputElement>('input[name="save-scope"][value="page"]');
    if (r) r.checked = true;
    setupGallerySaveForm();
  });

  btnDeckOpenGallery?.addEventListener('click', () => {
    openGallery('library');
  });

  // 9. View Mode Toggle (Single vs Double Spread)
  viewModeSingle.addEventListener('click', () => {
    viewMode = 'single';
    viewModeSingle.classList.add('active');
    viewModeDouble.classList.remove('active');
    viewer?.setViewMode('single');
  });

  viewModeDouble.addEventListener('click', () => {
    viewMode = 'double';
    viewModeDouble.classList.add('active');
    viewModeSingle.classList.remove('active');
    viewer?.setViewMode('double');
  });

  // 10. Engine Selector (Java vs Bedrock)
  engineSelect.addEventListener('change', () => {
    engine = engineSelect.value as BookEngine;
    updateAll(true);
    showToast(`Switched to ${engine === 'bedrock' ? 'Bedrock Edition (122px)' : 'Java Edition (114px)'}`, 'info');
  });

  // 11. Zoom Controls
  function applyZoom(zoom: number): void {
    currentZoom = Math.max(0.5, Math.min(2.0, zoom));
    viewerContainer.style.transform = `scale(${currentZoom})`;
    zoomLabel.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  btnZoomIn.addEventListener('click', () => applyZoom(currentZoom + 0.15));
  btnZoomOut.addEventListener('click', () => applyZoom(currentZoom - 0.15));
  btnZoomFit.addEventListener('click', () => applyZoom(1.0));

  // 12. Sound Toggle
  btnSoundToggle.addEventListener('click', () => {
    soundEnabled = soundManager.toggle();
    btnSoundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    showToast(`Sound ${soundEnabled ? 'Enabled' : 'Muted'}`, 'info');
  });

  // 13. Dialog Openers and Closers
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((el) => {
    el.addEventListener('click', () => {
      const targetId = el.dataset.close;
      if (!targetId) return;
      const dlg = document.getElementById(targetId) as HTMLDialogElement;
      dlg?.close();
    });
  });

  // Close dialogs when clicking directly on the backdrop
  document.querySelectorAll<HTMLDialogElement>('dialog.editor-dialog').forEach((dlg) => {
    dlg.addEventListener('click', (e) => {
      if (e.target === dlg) {
        dlg.close();
      }
    });
  });

  // Escape key closes flyout menu as well
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (studioToolsFlyout && studioToolsFlyout.style.display !== 'none') {
        studioToolsFlyout.style.display = 'none';
      }
      if (copyPageMenu && copyPageMenu.style.display !== 'none') {
        copyPageMenu.style.display = 'none';
      }
    }
  });

  // Clicking outside copy page menu closes it
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (copyPageMenu && copyPageMenu.style.display !== 'none') {
      if (!copyPageWrapper?.contains(target)) {
        copyPageMenu.style.display = 'none';
      }
    }
  });

  document.getElementById('btn-import')!.addEventListener('click', () => {
    importTextarea.value = '';
    importDialog.showModal();
  });

  document.getElementById('import-confirm-btn')!.addEventListener('click', () => {
    const raw = importTextarea.value.trim();
    if (!raw) return;
    const parsed = parseBook(raw);
    if (parsed) {
      pushUndoSnapshot();
      book = parsed;
      metaTitle.value = book.title;
      metaAuthor.value = book.author;
      currentPageIndex = 0;
      loadPageIntoEditor(0);
      syncViewerToBook();
      importDialog.close();
      showToast(`Imported book: "${book.title}" (${book.pages.length} pages)`, 'success');
    } else {
      showToast('Could not parse format. Supported: Stendhal, Scribble, BookCopy, CMI, /give', 'warn');
    }
  });

  document.getElementById('btn-export')!.addEventListener('click', () => {
    renderExportFormats();
    exportDialog.showModal();
  });

  document.getElementById('btn-glyph-modal')!.addEventListener('click', () => {
    renderGlyphs();
    glyphDialog.showModal();
  });

  glyphSearch.addEventListener('input', () => renderGlyphs());

  glyphTabs.querySelectorAll<HTMLButtonElement>('.glyph-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      glyphTabs.querySelectorAll('.glyph-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeGlyphCat = tab.dataset.cat as GlyphCategory;
      renderGlyphs();
    });
  });

  // Font Converter & Actions
  const fontConvertInput = document.getElementById('font-convert-input') as HTMLInputElement | null;
  const fontConvertPreview = document.getElementById('font-convert-preview');
  const btnFontInsert = document.getElementById('btn-font-insert');
  const btnFontApplyLine = document.getElementById('btn-font-apply-line');

  if (fontConvertInput && fontConvertPreview) {
    fontConvertInput.addEventListener('input', () => {
      const font = getFontById(activeFontId);
      fontConvertPreview.textContent = font.transform(fontConvertInput.value || 'Minecraft Book Studio 123');
    });
  }

  if (btnFontInsert && fontConvertInput && fontConvertPreview) {
    btnFontInsert.addEventListener('click', () => {
      const font = getFontById(activeFontId);
      const textToInsert = font.transform(fontConvertInput.value);
      if (textToInsert) {
        insertAtCursor(textToInsert);
        showToast(`Inserted ${font.name} text`, 'success');
      }
    });
  }

  if (btnFontApplyLine && fontConvertInput) {
    btnFontApplyLine.addEventListener('click', () => {
      const current = currentLines[activeLineIndex] ?? '';
      if (!current.trim()) {
        showToast('Active line is empty', 'warn');
        return;
      }
      const font = getFontById(activeFontId);
      const converted = font.transform(current);
      pushUndoSnapshot();
      currentLines[activeLineIndex] = converted;
      if (lineInputEls[activeLineIndex]) {
        lineInputEls[activeLineIndex].value = converted;
      }
      saveCurrentPageToBook();
      updateAll();
      showToast(`Applied ${font.name} to line ${activeLineIndex + 1}`, 'success');
    });
  }

  // Tint Swatches for Minecraft Bitmap Glyphs
  const tintContainer = document.getElementById('glyph-tint-swatches');
  if (tintContainer) {
    tintContainer.querySelectorAll<HTMLButtonElement>('.tint-dot').forEach((dot) => {
      dot.addEventListener('click', () => {
        tintContainer.querySelectorAll('.tint-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        activeGlyphTint = dot.dataset.color || '#FFFFFF';
        renderGlyphs();
      });
    });
  }

  // Custom Character Inspector & Inserter
  glyphCustomInput.addEventListener('input', () => {
    const text = glyphCustomInput.value;
    if (text) {
      const width = Math.round(measureLineWidth(parseFormattedText(text)));
      const unsup = detectUnsupportedMinecraftChars(text);
      if (unsup.count > 0) {
        glyphCustomWidth.textContent = `${width}px • ⚠️ >U+FFFF (SMP emoji - renders as [] in MC)`;
        glyphCustomWidth.className = 'badge stat-warn';
      } else {
        glyphCustomWidth.textContent = `${width}px • ✓ Minecraft Java Compatible (BMP)`;
        glyphCustomWidth.className = 'badge badge-ok';
      }
    } else {
      glyphCustomWidth.textContent = '-- px';
      glyphCustomWidth.className = 'badge';
    }
  });

  glyphCustomInsertBtn.addEventListener('click', () => {
    const text = glyphCustomInput.value;
    if (text) {
      insertAtCursor(text);
      showToast(`Inserted custom characters`, 'info');
      glyphDialog.close();
    }
  });

  // 14. Theme Toggle (True Eye-Friendly Dark & Light Mode with Persistence)
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
  try {
    const savedTheme = localStorage.getItem('blockgame_theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      document.documentElement.dataset.theme = savedTheme;
      if (themeToggle) themeToggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    }
  } catch {}

  themeToggle?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    themeToggle.textContent = nextTheme === 'dark' ? '🌙' : '☀️';
    try {
      localStorage.setItem('blockgame_theme', nextTheme);
    } catch {}
    showToast(`Switched to ${nextTheme === 'dark' ? 'Dark Mode' : 'Light Mode'}`, 'info');
  });

  // 15. Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    const activeEl = document.activeElement;
    const isEditing = activeEl?.tagName === 'TEXTAREA' || activeEl?.tagName === 'INPUT';

    // Undo / Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        redo();
      } else {
        e.preventDefault();
        undo();
      }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    // Toggle Glyph Browser (Ctrl+G / Cmd+G)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      renderGlyphs();
      glyphDialog.showModal();
      return;
    }

    // Copy Current Page (Ctrl+Shift+C / Cmd+Shift+C)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault();
      triggerCopyPageFeedback('raw', btnCopyPage);
      return;
    }

    // Page navigation with arrow keys outside textarea
    if (!isEditing) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        retreatPage();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advancePage();
      }
    }
  });
}

// ─── App Bootstrap ────────────────────────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', async () => {
    initDOM();
    restoreAutosave();

    metaTitle.value  = book.title;
    metaAuthor.value = book.author;

    wireEvents();
    await initViewer();
    loadPageIntoEditor(currentPageIndex);
    updateUndoRedoButtons();
  });
}
