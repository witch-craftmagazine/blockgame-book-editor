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
  defaultGlyphAtlas,
  type SinglePageExportFormat,
  type BlockgameBook,
  type BookEngine,
  type ViewMode,
} from 'blockgame-book-viewer';
import {
  ALL_GLYPHS,
  CATEGORY_DEFINITIONS,
  GLYPHS_BY_CATEGORY,
  findGlyphItem,
  getUnicodeSearchAliases,
  type GlyphCategory,
  type GlyphItem,
} from './data/symbolChatDataset';
import {
  getFontById,
  transformWithFont,
} from './data/symbolChatFonts';
import {
  normalizeBook,
} from './utils/bookNormalization';
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

export interface UndoSnapshot {
  book: BlockgameBook;
  pageIndex: number;
  actionLabel?: string;
  actionCategory?: 'text' | 'color' | 'style' | 'glyph' | 'layout' | 'page' | 'preset' | 'clear' | 'meta' | 'font';
  timestamp?: number;
}

export let book: BlockgameBook = normalizeBook({
  title: 'My Book',
  author: 'Author',
  pages: ['§6§lWelcome to the Book!§r\n\nEdit this page using the toolbar or type formatting codes directly.'],
});

export let currentPageIndex = 0;
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
export const undoStack: UndoSnapshot[] = [];
export const redoStack: UndoSnapshot[] = [];
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

import {
  DEFAULT_PRESETS,
  type SavedTemplate,
} from './data/defaultPresets';

export type { SavedTemplate };
export { DEFAULT_PRESETS };

const GALLERY_STORAGE_KEY = 'blockgame_saved_art';
const LEGACY_GALLERY_KEY = 'blockgame_book_gallery_templates';

export let savedTemplates: SavedTemplate[] = [];
export let activeGalleryTab: 'pages' | 'library' | 'save' = 'pages';
export let activeLibraryFilter: 'all' | 'page' | 'lines' | 'preset' | 'custom' = 'all';
export let activeDeckFilter: 'all' | 'page' | 'lines' | 'custom' | 'kaomoji' = 'all';
export let setDeckCollapsed: (collapsed: boolean) => void = () => {};
let refreshDeckPastes: () => void = () => {};

export function loadSavedTemplates(): SavedTemplate[] {
  if (typeof localStorage === 'undefined') return [...DEFAULT_PRESETS];
  try {
    let raw = localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_GALLERY_KEY);
    }
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

const HISTORY_STORAGE_KEY = 'blockgame_book_history';

export function migrateSnippetHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return;
    const snapshots = JSON.parse(raw);
    if (!Array.isArray(snapshots)) return;

    const snippets = snapshots.filter((s: any) => s.type === 'snippet');
    if (snippets.length > 0) {
      let changed = false;
      for (const s of snippets) {
        if (!savedTemplates.some(t => t.id === s.id)) {
          savedTemplates.unshift({
            id: s.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            title: s.title || 'Saved Snippet',
            scope: 'lines',
            category: 'Snippet',
            lines: s.lines || [],
            createdAt: s.timestamp || Date.now(),
            isPreset: false,
          });
          changed = true;
        }
      }
      if (changed) {
        saveUserTemplates(savedTemplates);
        refreshDeckPastes();
        updateGalleryCounts();
      }
      const purified = snapshots.filter((s: any) => s.type !== 'snippet');
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(purified));
    }
  } catch {}
}

export function renderSnippetPreviewCanvas(
  lines: string[],
  options?: {
    scale?: number;
    textWidth?: number;
    lineHeight?: number;
    fallbackColor?: string;
  }
): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    return {} as HTMLCanvasElement;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'snippet-preview-canvas';
  const scale = options?.scale ?? 2;
  const textWidth = options?.textWidth ?? 114;
  const lineHeight = options?.lineHeight ?? 9;
  const fallbackColor = options?.fallbackColor ?? '#1a1a1a';

  const numLines = Math.max(1, lines.length);
  const totalWidth = textWidth * scale;
  const totalHeight = numLines * lineHeight * scale;

  canvas.width = totalWidth;
  canvas.height = totalHeight;

  const draw = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, totalWidth, totalHeight);
    ctx.save();
    ctx.scale(scale, scale);

    lines.forEach((lineText, lineIdx) => {
      const y = lineIdx * lineHeight;
      if (!lineText) return;
      const spans = parseFormattedText(lineText);
      let cursorX = 0;

      for (const span of spans) {
        const color = span.color || fallbackColor;
        for (const char of span.text) {
          const glyphInfo = defaultGlyphAtlas.getGlyphDrawInfo(char, color, span.bold);
          if (glyphInfo && glyphInfo.image) {
            const destW = glyphInfo.dWidth ?? glyphInfo.sWidth;
            const destH = glyphInfo.dHeight ?? glyphInfo.sHeight;
            const drawY = y + (glyphInfo.yOffset ?? 0);

            if (span.italic) {
              ctx.save();
              ctx.transform(1, 0, -0.15, 1, (drawY + destH) * 0.15, 0);
            }

            ctx.drawImage(
              glyphInfo.image,
              glyphInfo.sx,
              glyphInfo.sy,
              glyphInfo.sWidth,
              glyphInfo.sHeight,
              cursorX,
              drawY,
              destW,
              destH
            );

            if (span.bold) {
              ctx.drawImage(
                glyphInfo.image,
                glyphInfo.sx,
                glyphInfo.sy,
                glyphInfo.sWidth,
                glyphInfo.sHeight,
                cursorX + 1,
                drawY,
                destW,
                destH
              );
            }

            if (span.italic) {
              ctx.restore();
            }

            const adv = glyphInfo.advance;
            if (span.strikethrough) {
              ctx.fillStyle = color;
              ctx.fillRect(cursorX, y + 4, adv, 1);
            }
            if (span.underlined) {
              ctx.fillStyle = color;
              ctx.fillRect(cursorX, y + 8, adv, 1);
            }
            cursorX += adv;
          } else {
            cursorX += defaultGlyphAtlas.getAdvance(char, span.bold);
          }
        }
      }
    });

    ctx.restore();
  };

  draw();
  ensureAtlasLoaded().then(() => draw());

  return canvas;
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
  // Legacy gallery counts no-op
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
    glyphs: ['█', '▓', '▒', '░', '▀', '▄', '▌', '▐', '■', '□', '▪', '▫', '▬', '▭', '▮', '▯', '▰', '▱', '◆', '◇', '◈', '◉', '◊', '○', '◯', '●', '◐', '◑'],
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
  7: ['—', '–', '≈', '≠', '≤', '≥', '¿', '‰', 'ᛞ', 'ᛟ', '◯'],
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

export type MatrixMode = { type: 'set'; setId: string; px?: number } | { type: 'width'; px: number };
export let currentMatrixSetId = 'all';
export let currentMatrixPx = 6;
export let currentMatrixMode: MatrixMode = { type: 'set', setId: 'all', px: 6 };
export let currentMatrixPage = 0;
export const MATRIX_PAGE_SIZE = 14;
export let currentMatrixPageSize = 14;

export let currentSetsPage = 0;
export const SETS_PAGE_SIZE = 5;
export let currentSetsPageSize = 5;

export interface FontChipItem {
  id: string;
  name: string;
  label: string;
  title: string;
}

export const FONT_CHIPS_DATA: FontChipItem[] = [
  { id: 'normal', name: 'Normal', label: 'Normal', title: 'Normal text' },
  { id: 'small_caps', name: 'Small Caps', label: 'ꜱᴍᴀʟʟ', title: 'Small Caps' },
  { id: 'circled', name: 'Circled', label: 'Ⓒⓘⓡ', title: 'Circled' },
  { id: 'fullwidth', name: 'Fullwidth', label: 'Ｆｕｌｌ', title: 'Fullwidth' },
  { id: 'superscript', name: 'Superscript', label: 'ˢᵘᵖ', title: 'Superscript' },
  { id: 'subscript', name: 'Subscript', label: 'ₜₑₓₜ', title: 'Subscript' },
  { id: 'inverted', name: 'Upside Down', label: 'ʇxǝʇ', title: 'Inverted / Upside Down' },
  { id: 'fraktur', name: 'Fraktur / Gothic', label: '𝔉𝔯𝔞', title: 'Fraktur / Gothic' },
  { id: 'double_struck', name: 'Double Struck', label: '𝔻𝕠𝕦', title: 'Double Struck' },
  { id: 'script', name: 'Script / Cursive', label: '𝒮𝒸𝓇', title: 'Script / Cursive' },
  { id: 'bold_serif', name: 'Bold Serif', label: '𝐁𝐨𝐥', title: 'Bold Serif' },
  { id: 'circled_black', name: 'Circled Black', label: '🅐🅑🅒', title: 'Circled Black' },
  { id: 'squared', name: 'Squared', label: '🄰🄱🄲', title: 'Squared' },
];

export let currentFontPage = 0;
export const FONTS_PAGE_SIZE = 5;
export let currentFontsPageSize = 5;
export let activeFontId: string = 'normal';

export function getBaseGlyphsForSet(setId: string): string[] {
  if (setId === 'all') return ALL_GLYPHS.map(g => g.char);
  if (setId === 'recent') return recentGlyphs;
  if (setId === 'fav') return userFavoriteGlyphs;
  if (setId in GLYPHS_BY_CATEGORY) {
    return (GLYPHS_BY_CATEGORY[setId as keyof typeof GLYPHS_BY_CATEGORY] || []).map(g => g.char);
  }
  return CHARACTER_SETS[setId]?.glyphs || [];
}

export function getAvailableWidthsForSet(setId: string): number[] {
  const glyphs = getBaseGlyphsForSet(setId);
  const widths = new Set<number>();
  for (const ch of glyphs) {
    const adv = getCharPixelAdvance(ch);
    if (adv > 0 && adv <= 12) widths.add(adv);
  }
  const sorted = Array.from(widths).sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : WIDTH_STEPS;
}

export let hideSmpGlyphs: boolean = typeof localStorage !== 'undefined' ? localStorage.getItem('blockgame_hide_smp') === 'true' : false;

export function setHideSmp(hide: boolean): void {
  hideSmpGlyphs = hide;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('blockgame_hide_smp', String(hide));
  }
  const glyphToggle = document.getElementById('glyph-toggle-smp') as HTMLInputElement | null;
  if (glyphToggle) glyphToggle.checked = hide;
  const matToggle = document.getElementById('matrix-toggle-smp') as HTMLInputElement | null;
  if (matToggle) matToggle.checked = hide;
  renderGlyphs();
  renderMatrixSlots();
  showToast(hide ? 'Hiding SMP (>U+FFFF) characters' : 'Showing all characters including SMP', 'info');
}

export function getHideSmp(): boolean {
  return hideSmpGlyphs;
}

export function getGlyphsForCurrentSelection(): string[] {
  const setId = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;
  const targetPx = currentMatrixMode.px ?? currentMatrixPx;
  let baseGlyphs = getBaseGlyphsForSet(setId);

  if (hideSmpGlyphs) {
    baseGlyphs = baseGlyphs.filter((ch) => (ch.codePointAt(0) || 0) <= 0xFFFF);
  }

  // Filter the glyphs in this set by the selected pixel size
  return baseGlyphs.filter(ch => getCharPixelAdvance(ch) === targetPx);
}

export function renderMatrixSlots(): void {
  if (!matrixSlotsRibbon) return;
  matrixSlotsRibbon.innerHTML = '';

  const list = getGlyphsForCurrentSelection();
  const totalPages = Math.max(1, Math.ceil(list.length / currentMatrixPageSize));
  if (currentMatrixPage >= totalPages) currentMatrixPage = 0;

  // Pixel selector badge ALWAYS displays the pixel width (never a set name!)
  const targetPx = currentMatrixMode.px ?? currentMatrixPx;
  if (matrixPxValue) {
    matrixPxValue.textContent = targetPx.toString();
  }

  const matrixUnit = document.querySelector('.matrix-unit') as HTMLElement;
  if (matrixUnit) {
    matrixUnit.textContent = 'px';
  }

  if (matrixPageLabel) {
    matrixPageLabel.textContent = `${currentMatrixPage + 1}/${totalPages}`;
  }

  const startIdx = currentMatrixPage * currentMatrixPageSize;
  const pageItems = list.slice(startIdx, startIdx + currentMatrixPageSize);

  if (pageItems.length === 0) {
    const empty = document.createElement('div');
    empty.style.color = '#888888';
    empty.style.fontSize = '11px';
    empty.style.fontFamily = 'var(--font-mono)';
    empty.style.padding = '0 8px';
    empty.style.display = 'flex';
    empty.style.alignItems = 'center';
    empty.textContent = `No ${targetPx}px glyphs in this set`;
    matrixSlotsRibbon.appendChild(empty);
    return;
  }

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
      addRecentGlyph(ch);
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

export function renderMatrixSetChips(): void {
  if (!matrixQuickWidths) return;
  const container = matrixQuickWidths;
  container.innerHTML = '';

  const totalSetsPages = Math.max(1, Math.ceil(CATEGORY_DEFINITIONS.length / currentSetsPageSize));
  if (currentSetsPage >= totalSetsPages) currentSetsPage = 0;
  if (currentSetsPage < 0) currentSetsPage = totalSetsPages - 1;

  if (matrixSetsPageLabel) {
    matrixSetsPageLabel.textContent = `${currentSetsPage + 1}/${totalSetsPages}`;
  }

  const startIdx = currentSetsPage * currentSetsPageSize;
  const pageSets = CATEGORY_DEFINITIONS.slice(startIdx, startIdx + currentSetsPageSize);
  const activeSet = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;

  pageSets.forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `matrix-chip ${cat.id === activeSet ? 'active' : ''}`;
    btn.dataset.set = cat.id;
    btn.title = cat.description;
    btn.textContent = `${cat.icon} ${cat.label}`;

    btn.addEventListener('click', () => {
      currentMatrixSetId = cat.id;
      const available = getAvailableWidthsForSet(cat.id);
      if (available.length > 0 && !available.includes(currentMatrixPx)) {
        currentMatrixPx = available[0];
      }
      currentMatrixMode = { type: 'set', setId: cat.id, px: currentMatrixPx };
      currentMatrixPage = 0;
      updateActiveMatrixChip();
      renderMatrixSlots();
    });

    container.appendChild(btn);
  });
}

export function updateActiveMatrixSetDisplay(): void {
  const activeSet = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;
  const currentCat = CATEGORY_DEFINITIONS.find(c => c.id === activeSet) || CATEGORY_DEFINITIONS[0];

  if (matrixActiveSetIcon) {
    matrixActiveSetIcon.textContent = currentCat.icon;
  }
  if (matrixActiveSetName) {
    matrixActiveSetName.textContent = currentCat.label;
  }
  if (btnMatrixSetPicker) {
    btnMatrixSetPicker.title = `Symbol Set: ${currentCat.label} (${currentCat.description}) • Click to choose`;
  }

  // Update active state in dropdown
  if (matrixSetMenu) {
    matrixSetMenu.querySelectorAll<HTMLButtonElement>('.matrix-set-menu-item').forEach(item => {
      item.classList.toggle('active', item.dataset.set === activeSet);
    });
  }

  // Also sync legacy chips if present
  if (matrixQuickWidths) {
    matrixQuickWidths.querySelectorAll<HTMLButtonElement>('.matrix-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.set === activeSet);
    });
  }
}

export function renderMatrixSetDropdown(): void {
  if (!matrixSetMenu) return;
  const menu = matrixSetMenu;
  menu.innerHTML = '';

  const activeSet = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;

  CATEGORY_DEFINITIONS.forEach((cat) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `matrix-set-menu-item ${cat.id === activeSet ? 'active' : ''}`;
    item.dataset.set = cat.id;
    item.title = cat.description;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'set-item-icon';
    iconSpan.textContent = cat.icon;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'set-item-label';
    labelSpan.textContent = cat.label;

    item.appendChild(iconSpan);
    item.appendChild(labelSpan);

    item.addEventListener('click', (e) => {
      e.stopPropagation();
      currentMatrixSetId = cat.id;
      const available = getAvailableWidthsForSet(cat.id);
      if (available.length > 0 && !available.includes(currentMatrixPx)) {
        currentMatrixPx = available[0];
      }
      currentMatrixMode = { type: 'set', setId: cat.id, px: currentMatrixPx };
      currentMatrixPage = 0;
      updateActiveMatrixSetDisplay();
      renderMatrixSlots();
      soundManager.playButtonClick();
      closeMatrixSetMenu();
    });

    menu.appendChild(item);
  });

  // Footer with SMP toggle
  const footer = document.createElement('div');
  footer.className = 'matrix-set-menu-footer';
  footer.innerHTML = `
    <label class="matrix-smp-toggle-label" title="Hide/display characters from the Supplementary Multilingual Plane (>U+FFFF). Vanilla Minecraft Java and Bedrock render many SMP characters as missing boxes []">
      <input type="checkbox" id="matrix-toggle-smp" ${hideSmpGlyphs ? 'checked' : ''} />
      <span class="toggle-label-text">Hide SMP (>U+FFFF)</span>
    </label>
  `;
  const matInput = footer.querySelector('input');
  matInput?.addEventListener('change', (e) => {
    e.stopPropagation();
    setHideSmp(matInput.checked);
  });
  menu.appendChild(footer);
}

export function toggleMatrixSetMenu(): void {
  if (!matrixSetMenu) return;
  const isHidden = matrixSetMenu.style.display === 'none';
  matrixSetMenu.style.display = isHidden ? 'grid' : 'none';
}

export function closeMatrixSetMenu(): void {
  if (matrixSetMenu) {
    matrixSetMenu.style.display = 'none';
  }
}

export function updateActiveMatrixChip(): void {
  updateActiveMatrixSetDisplay();
}

export function renderFontChips(): void {
  if (!fontQuickChips) return;
  const container = fontQuickChips;
  container.innerHTML = '';

  const totalFontPages = Math.max(1, Math.ceil(FONT_CHIPS_DATA.length / currentFontsPageSize));
  if (currentFontPage >= totalFontPages) currentFontPage = 0;
  if (currentFontPage < 0) currentFontPage = totalFontPages - 1;

  if (fontPageLabel) {
    fontPageLabel.textContent = `${currentFontPage + 1}/${totalFontPages}`;
  }

  const startIdx = currentFontPage * currentFontsPageSize;
  const pageFonts = FONT_CHIPS_DATA.slice(startIdx, startIdx + currentFontsPageSize);

  pageFonts.forEach((f) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `font-chip ${f.id === activeFontId ? 'active' : ''}`;
    btn.dataset.font = f.id;
    btn.title = f.title;
    btn.textContent = f.label;

    btn.addEventListener('click', () => {
      setActiveFont(f.id);
    });

    container.appendChild(btn);
  });
}

export function setActiveFont(fontId: string): void {
  activeFontId = fontId;

  // Auto-sync font page if necessary so the active chip is visible
  const fontIdx = FONT_CHIPS_DATA.findIndex(f => f.id === fontId);
  if (fontIdx !== -1) {
    const targetPage = Math.floor(fontIdx / currentFontsPageSize);
    if (targetPage !== currentFontPage) {
      currentFontPage = targetPage;
    }
  }
  renderFontChips();

  const activeFontBadge = document.getElementById('active-font-badge');
  if (activeFontBadge) {
    const activeFontObj = FONT_CHIPS_DATA.find(f => f.id === fontId);
    const label = activeFontObj?.name || (fontId === 'normal' ? 'Normal' : fontId);
    activeFontBadge.textContent = `Active: ${label}`;
  }
  showToast(`Font: ${fontId === 'normal' ? 'Normal' : fontId}`, 'info');
}

export function updateDynamicRibbonSizes(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // 1. Dynamic Glyph Slots Page Size
  if (matrixSlotsRibbon) {
    const availableWidth = matrixSlotsRibbon.clientWidth;
    // Each slot is 28px + 3px gap = 31px
    if (availableWidth > 60) {
      const slotsFit = Math.max(4, Math.floor((availableWidth - 4) / 31));
      if (slotsFit !== currentMatrixPageSize) {
        currentMatrixPageSize = slotsFit;
        renderMatrixSlots();
      }
    }
  }

  // 2. Dynamic Sets Ribbon Page Size
  if (matrixQuickWidths && matrixQuickWidths.parentElement) {
    const parentWidth = matrixQuickWidths.parentElement.clientWidth;
    // Prev / Next arrow buttons and label occupy ~60px
    const availableWidth = Math.max(80, parentWidth - 65);
    // Each chip is ~75px average
    const setsFit = Math.max(2, Math.min(8, Math.floor(availableWidth / 75)));
    if (setsFit !== currentSetsPageSize) {
      currentSetsPageSize = setsFit;
      renderMatrixSetChips();
    }
  }

  // 3. Dynamic Font Switcher Page Size
  if (fontQuickChips && fontQuickChips.parentElement) {
    const parentWidth = fontQuickChips.parentElement.clientWidth;
    // Prev / Next arrow buttons and label occupy ~65px
    const availableWidth = Math.max(80, parentWidth - 70);
    // Each chip is ~70px average
    const fontsFit = Math.max(2, Math.min(8, Math.floor(availableWidth / 70)));
    if (fontsFit !== currentFontsPageSize) {
      currentFontsPageSize = fontsFit;
      renderFontChips();
    }
  }
}

export function jumpToHistorySnapshot(targetIndex: number): void {
  const currentIdx = undoStack.length;
  if (targetIndex === currentIdx) return;

  if (targetIndex < currentIdx) {
    const steps = currentIdx - targetIndex;
    for (let i = 0; i < steps; i++) {
      if (undoStack.length === 0) break;
      undo();
    }
  } else {
    const steps = targetIndex - currentIdx;
    for (let i = 0; i < steps; i++) {
      if (redoStack.length === 0) break;
      redo();
    }
  }
  renderHistoryTable();
}

export function renderHistoryTable(): void {
  if (!historyTableBody) return;
  const container = historyTableBody;
  container.innerHTML = '';

  interface TimelineItem {
    index: number;
    type: 'past' | 'current' | 'future';
    snapshot: UndoSnapshot;
    label: string;
    category: string;
    page: number;
    timeStr: string;
  }

  const items: TimelineItem[] = [];

  // 1. Past states (from undoStack)
  undoStack.forEach((snap, idx) => {
    items.push({
      index: idx,
      type: 'past',
      snapshot: snap,
      label: snap.actionLabel || 'Edit',
      category: snap.actionCategory || 'text',
      page: snap.pageIndex + 1,
      timeStr: snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Earlier',
    });
  });

  // 2. Current active state
  items.push({
    index: undoStack.length,
    type: 'current',
    snapshot: {
      book: { title: book.title, author: book.author, pages: [...book.pages] },
      pageIndex: currentPageIndex,
      actionLabel: 'Current State',
      actionCategory: 'meta',
      timestamp: Date.now(),
    },
    label: 'Current State (Active)',
    category: 'meta',
    page: currentPageIndex + 1,
    timeStr: 'Now',
  });

  // 3. Future states (from redoStack, popped in reverse order)
  const reversedRedo = [...redoStack].reverse();
  reversedRedo.forEach((snap, rIdx) => {
    const timelineIdx = undoStack.length + 1 + rIdx;
    items.push({
      index: timelineIdx,
      type: 'future',
      snapshot: snap,
      label: snap.actionLabel || 'Undone Action',
      category: snap.actionCategory || 'text',
      page: snap.pageIndex + 1,
      timeStr: snap.timestamp ? new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Future',
    });
  });

  const categoryIcons: Record<string, string> = {
    text: '✏️',
    color: '🎨',
    style: '✨',
    glyph: '🔣',
    layout: '📐',
    page: '📄',
    preset: '📥',
    clear: '🗑️',
    meta: '⚙️',
    font: '🔤',
  };

  items.forEach((item) => {
    const tr = document.createElement('tr');
    tr.className = `history-row ${item.type}`;

    // State column
    const tdState = document.createElement('td');
    const stateBadge = document.createElement('span');
    stateBadge.className = `history-status-badge ${item.type}`;
    stateBadge.textContent = item.type === 'current' ? '● Current' : item.type === 'past' ? 'Past' : 'Future';
    tdState.appendChild(stateBadge);
    tr.appendChild(tdState);

    // Target column
    const tdTarget = document.createElement('td');
    const targetBadge = document.createElement('span');
    targetBadge.className = 'history-target-badge';
    targetBadge.textContent = `P. ${item.page}`;
    tdTarget.appendChild(targetBadge);
    tr.appendChild(tdTarget);

    // Action column
    const tdAction = document.createElement('td');
    const actionWrap = document.createElement('span');
    actionWrap.className = 'history-action-tag';
    const icon = categoryIcons[item.category] || '✏️';
    actionWrap.textContent = `${icon} ${item.label}`;
    tdAction.appendChild(actionWrap);
    tr.appendChild(tdAction);

    // Time column
    const tdTime = document.createElement('td');
    tdTime.className = 'history-time-col';
    tdTime.textContent = item.timeStr;
    tr.appendChild(tdTime);

    // Action / Jump column
    const tdJump = document.createElement('td');
    tdJump.style.textAlign = 'right';
    if (item.type === 'current') {
      const activeSpan = document.createElement('span');
      activeSpan.style.color = 'var(--mc-diamond)';
      activeSpan.style.fontSize = '10px';
      activeSpan.textContent = 'Active';
      tdJump.appendChild(activeSpan);
    } else {
      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'btn btn-xs btn-outline';
      jumpBtn.textContent = item.type === 'past' ? '↩ Revert' : '↪ Advance';
      jumpBtn.title = `Jump to this snapshot`;
      jumpBtn.addEventListener('click', () => {
        jumpToHistorySnapshot(item.index);
      });
      tdJump.appendChild(jumpBtn);
    }
    tr.appendChild(tdJump);

    container.appendChild(tr);
  });

  const stats = document.getElementById('history-footer-stats');
  if (stats) {
    stats.textContent = `${undoStack.length} undo step${undoStack.length === 1 ? '' : 's'} • ${redoStack.length} redo step${redoStack.length === 1 ? '' : 's'}`;
  }
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

// Mobile Active Line Deck Elements
let mobileLineInput: HTMLInputElement | null = null;
let btnMobilePrevLine: HTMLButtonElement | null = null;
let btnMobileNextLine: HTMLButtonElement | null = null;
let mobileLinePill: HTMLElement | null = null;
let mobileTrafficDot: HTMLElement | null = null;
let btnMobileFont: HTMLButtonElement | null = null;

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
let btnCenterLine: HTMLButtonElement;
let btnFillMargin: HTMLButtonElement;
let btnDedupCodes: HTMLButtonElement;
let btnClearPage: HTMLButtonElement;
let btnPreviewCopyPage: HTMLButtonElement | null;
let btnPrevPage: HTMLButtonElement;
let btnNextPage: HTMLButtonElement;
let btnZoomIn: HTMLButtonElement;
let btnZoomOut: HTMLButtonElement;
let btnZoomFit: HTMLButtonElement;
let btnSoundToggle: HTMLButtonElement;
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
let glyphWidthFilter: HTMLSelectElement | null = null;
let selectedGlyphWidth: string = 'all';

// Bookshelf Dialog & Book Library Elements
let bookshelfDialog: HTMLDialogElement | null = null;
let bookshelfGrid: HTMLElement | null = null;
let btnOpenBookshelf: HTMLButtonElement | null = null;
let btnBookshelfNewBook: HTMLButtonElement | null = null;

// ─── Bookshelf & Book Library Engine ──────────────────────────────────────────
export const BOOKSHELF_STORAGE_KEY = 'blockgame_bookshelf_v1';
export const BOOKSHELF_ACTIVE_KEY = 'blockgame_bookshelf_active_id';

export interface BookshelfBook {
  id: string;
  title: string;
  author: string;
  pages: string[];
  updatedAt: number;
  createdAt: number;
}

export let activeBookId = 'book-starter';
let inMemoryBookshelf: BookshelfBook[] | null = null;

export function loadBookshelf(): BookshelfBook[] {
  if (typeof localStorage === 'undefined') {
    return inMemoryBookshelf ? [...inMemoryBookshelf] : [];
  }
  try {
    const raw = localStorage.getItem(BOOKSHELF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return inMemoryBookshelf ? [...inMemoryBookshelf] : [];
}

export function saveBookshelf(books: BookshelfBook[]): void {
  inMemoryBookshelf = [...books];
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(BOOKSHELF_STORAGE_KEY, JSON.stringify(books));
  } catch {}
}

export function syncCurrentBookToBookshelf(): void {
  const books = loadBookshelf();
  const existingIdx = books.findIndex(b => b.id === activeBookId);
  const entry: BookshelfBook = {
    id: activeBookId,
    title: book.title || 'Untitled Book',
    author: book.author || 'Author',
    pages: [...book.pages],
    updatedAt: Date.now(),
    createdAt: existingIdx >= 0 ? books[existingIdx].createdAt : Date.now(),
  };

  if (existingIdx >= 0) {
    books[existingIdx] = entry;
  } else {
    books.unshift(entry);
  }
  saveBookshelf(books);
  try {
    localStorage.setItem(BOOKSHELF_ACTIVE_KEY, activeBookId);
  } catch {}
}

export function switchToBook(id: string): void {
  // Save current book first
  saveCurrentPageToBook();
  syncCurrentBookToBookshelf();

  const books = loadBookshelf();
  const target = books.find(b => b.id === id);
  if (!target) return;

  activeBookId = target.id;
  try {
    localStorage.setItem(BOOKSHELF_ACTIVE_KEY, activeBookId);
  } catch {}

  const targetWidth = engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
  book = normalizeBook({
    title: target.title,
    author: target.author,
    pages: target.pages.length > 0 ? [...target.pages] : [''],
  }, { maxWidth: targetWidth });

  metaTitle.value = book.title;
  metaAuthor.value = book.author;
  currentPageIndex = 0;
  activeLineIndex = 0;
  undoStack.length = 0;
  redoStack.length = 0;

  loadPageIntoEditor(0);
  syncViewerToBook();
  updateAll(true);
  bookshelfDialog?.close();
  soundManager.playButtonClick();
  showToast(`Switched to "${book.title}"`, 'success');
}

export function createNewBook(title = 'Untitled Book'): void {
  saveCurrentPageToBook();
  syncCurrentBookToBookshelf();

  const newId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const newBookEntry: BookshelfBook = {
    id: newId,
    title,
    author: book.author || 'Author',
    pages: [''],
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };

  const books = [newBookEntry, ...loadBookshelf()];
  saveBookshelf(books);
  switchToBook(newId);
}

export function duplicateBook(id: string): void {
  const books = loadBookshelf();
  const src = books.find(b => b.id === id);
  if (!src) return;

  const newId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const clone: BookshelfBook = {
    id: newId,
    title: `${src.title} (Copy)`,
    author: src.author,
    pages: [...src.pages],
    updatedAt: Date.now(),
    createdAt: Date.now(),
  };

  const updated = [clone, ...books];
  saveBookshelf(updated);
  renderBookshelf();
  showToast(`Duplicated "${src.title}"`, 'success');
}

export function deleteBook(id: string): void {
  const books = loadBookshelf();
  const bookToDelete = books.find(b => b.id === id);
  const title = bookToDelete?.title || 'this book';

  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    if (!window.confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      return;
    }
  }

  const remaining = books.filter(b => b.id !== id);
  saveBookshelf(remaining);

  if (remaining.length === 0) {
    // Deleting the only existing book — initialize a fresh blank Untitled Book!
    const newId = `book-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    activeBookId = newId;
    try {
      localStorage.setItem(BOOKSHELF_ACTIVE_KEY, activeBookId);
    } catch {}

    book = {
      title: 'Untitled Book',
      author: book?.author || 'Author',
      pages: [''],
    };
    const freshEntry: BookshelfBook = {
      id: newId,
      title: book.title,
      author: book.author,
      pages: [''],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveBookshelf([freshEntry]);

    if (metaTitle) metaTitle.value = book.title;
    if (metaAuthor) metaAuthor.value = book.author;
    currentPageIndex = 0;
    activeLineIndex = 0;
    undoStack.length = 0;
    redoStack.length = 0;

    if (typeof document !== 'undefined') {
      loadPageIntoEditor(0);
      syncViewerToBook();
      updateAll(true);
      renderBookshelf();
    }
    showToast(`Deleted "${title}". Created new Untitled Book.`, 'info');
  } else if (id === activeBookId) {
    // Switch directly to the first remaining book without syncing the deleted book back!
    const target = remaining[0];
    activeBookId = target.id;
    try {
      localStorage.setItem(BOOKSHELF_ACTIVE_KEY, activeBookId);
    } catch {}

    const targetWidth = engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
    book = normalizeBook({
      title: target.title,
      author: target.author,
      pages: target.pages.length > 0 ? [...target.pages] : [''],
    }, { maxWidth: targetWidth });

    if (metaTitle) metaTitle.value = book.title;
    if (metaAuthor) metaAuthor.value = book.author;
    currentPageIndex = 0;
    activeLineIndex = 0;
    undoStack.length = 0;
    redoStack.length = 0;

    if (typeof document !== 'undefined') {
      loadPageIntoEditor(0);
      syncViewerToBook();
      updateAll(true);
      renderBookshelf();
    }
    showToast(`Deleted "${title}". Switched to "${book.title}".`, 'info');
  } else {
    renderBookshelf();
    showToast(`Removed "${title}" from Bookshelf`, 'info');
  }
}

export function formatRelativeTime(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function renderBookshelf(): void {
  if (typeof document === 'undefined') return;
  const grid = bookshelfGrid || document.getElementById('bookshelf-grid');
  if (!grid) return;
  grid.innerHTML = '';

  syncCurrentBookToBookshelf();
  const books = loadBookshelf();

  books.forEach((b) => {
    const card = document.createElement('div');
    const isActive = b.id === activeBookId;
    card.className = `bookshelf-book-card${isActive ? ' active-book' : ''}`;

    const header = document.createElement('div');
    header.className = 'bookshelf-card-header';
    header.innerHTML = `
      <div class="bookshelf-card-title-row">
        <span class="bookshelf-card-title" title="${b.title}">${b.title || 'Untitled'}</span>
        ${isActive ? '<span class="badge badge-ok">★ EDITING</span>' : ''}
      </div>
      <div class="bookshelf-card-meta">
        <span class="bookshelf-card-author">By ${b.author || 'Author'}</span>
        <span class="bookshelf-card-pages">${b.pages.length} ${b.pages.length === 1 ? 'Page' : 'Pages'}</span>
      </div>
    `;
    card.appendChild(header);

    // Parchment mini-preview of Page 1 (146:180 aspect ratio, full page layout)
    const preview = document.createElement('div');
    preview.className = 'bookshelf-card-preview';
    preview.title = isActive ? 'Currently editing this book' : `Click to switch to "${b.title}"`;
    const pageLines = (b.pages[0] ?? '').split('\n').slice(0, 14);
    while (pageLines.length < 14) pageLines.push('');
    const canvas = renderSnippetPreviewCanvas(pageLines, { scale: 2 });
    preview.appendChild(canvas);
    if (!isActive) {
      preview.addEventListener('click', () => switchToBook(b.id));
    }
    card.appendChild(preview);

    const actions = document.createElement('div');
    actions.className = 'bookshelf-card-actions';

    if (isActive) {
      const activeBtn = document.createElement('button');
      activeBtn.type = 'button';
      activeBtn.className = 'btn btn-xs btn-primary';
      activeBtn.textContent = '✓ Editing';
      activeBtn.disabled = true;
      actions.appendChild(activeBtn);
    } else {
      const switchBtn = document.createElement('button');
      switchBtn.type = 'button';
      switchBtn.className = 'btn btn-xs btn-primary';
      switchBtn.textContent = '✏ Switch';
      switchBtn.title = `Switch to editing "${b.title}"`;
      switchBtn.addEventListener('click', () => switchToBook(b.id));
      actions.appendChild(switchBtn);
    }

    const dupBtn = document.createElement('button');
    dupBtn.type = 'button';
    dupBtn.className = 'btn btn-xs btn-outline';
    dupBtn.textContent = '📑 Copy';
    dupBtn.title = 'Duplicate this book';
    dupBtn.addEventListener('click', () => duplicateBook(b.id));
    actions.appendChild(dupBtn);

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-xs btn-outline btn-danger-tag';
    delBtn.textContent = '🗑';
    delBtn.title = 'Delete this book';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete "${b.title}" from Bookshelf?`)) {
        deleteBook(b.id);
      }
    });
    actions.appendChild(delBtn);

    card.appendChild(actions);
    grid.appendChild(card);
  });
}

export function openBookshelf(): void {
  renderBookshelf();
  bookshelfDialog?.showModal();
}

// Deprecated alias for openHistory
export const openHistory = openBookshelf;

// Desktop Font Switcher Ribbon
let fontQuickChips: HTMLElement | null = null;
let fontPagePrev: HTMLButtonElement | null = null;
let fontPageNext: HTMLButtonElement | null = null;
let fontPageLabel: HTMLElement | null = null;

// Edit History Dialog
let historyDialog: HTMLDialogElement | null = null;
let historyTableBody: HTMLElement | null = null;
let btnHistory: HTMLButtonElement | null = null;

// Multi-line selection
let selectedLineIndices = new Set<number>([0]);
let lastClickedLineIndex = 0;

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
let matrixSetsPrev: HTMLButtonElement | null = null;
let matrixSetsNext: HTMLButtonElement | null = null;
let matrixSetsPageLabel: HTMLElement | null = null;

let btnMatrixSetPicker: HTMLButtonElement | null = null;
let matrixActiveSetIcon: HTMLElement | null = null;
let matrixActiveSetName: HTMLElement | null = null;
let matrixSetMenu: HTMLElement | null = null;
let autosaveIndicator: HTMLElement | null = null;

// Collapsible Saved Art Deck
let savedArtDeck: HTMLElement;
let btnDeckToggle: HTMLButtonElement;
let deckToggleIcon: HTMLElement;
let deckToggleText: HTMLElement;
let deckTitleToggle: HTMLElement;
let deckPastesStrip: HTMLElement;
let btnDeckSaveRow: HTMLButtonElement | null = null;
let btnMobilePresets: HTMLButtonElement | null = null;
let btnToolbarPresets: HTMLButtonElement | null = null;

function initDOM(): void {
  if (typeof document === 'undefined') return;

  textarea            = document.getElementById('page-textarea')         as HTMLTextAreaElement;
  bookLinesList       = document.getElementById('book-lines-list')       as HTMLElement;
  btnToggleEditorMode = document.getElementById('btn-toggle-editor-mode') as HTMLButtonElement;

  mobileLineInput     = document.getElementById('mobile-line-input')     as HTMLInputElement | null;
  btnMobilePrevLine   = document.getElementById('btn-mobile-prev-line')   as HTMLButtonElement | null;
  btnMobileNextLine   = document.getElementById('btn-mobile-next-line')   as HTMLButtonElement | null;
  mobileLinePill      = document.getElementById('mobile-line-pill');
  mobileTrafficDot    = document.getElementById('mobile-traffic-dot');
  btnMobileFont       = document.getElementById('btn-mobile-font')        as HTMLButtonElement | null;

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
  autosaveIndicator   = document.getElementById('autosave-indicator');
  if (autosaveIndicator) {
    const readyTip = 'Auto-save: Ready (saves locally on change)';
    autosaveIndicator.title = readyTip;
    autosaveIndicator.setAttribute('data-tooltip', readyTip);
  }
  toastContainer      = document.getElementById('toast-container')!;

  btnUndo             = document.getElementById('btn-undo')              as HTMLButtonElement;
  btnRedo             = document.getElementById('btn-redo')              as HTMLButtonElement;
  btnHistory          = document.getElementById('btn-history')           as HTMLButtonElement | null;
  historyDialog       = document.getElementById('history-dialog')        as HTMLDialogElement | null;
  historyTableBody    = document.getElementById('history-table-body');
  btnOpenBookshelf    = document.getElementById('btn-open-bookshelf')    as HTMLButtonElement | null;
  btnCenterLine       = document.getElementById('btn-center-line')       as HTMLButtonElement;
  btnFillMargin       = document.getElementById('btn-fill-margin')       as HTMLButtonElement;
  btnDedupCodes       = document.getElementById('btn-dedup-codes')       as HTMLButtonElement;
  btnClearPage        = document.getElementById('btn-clear-page')        as HTMLButtonElement;
  btnPreviewCopyPage  = document.getElementById('btn-preview-copy-page')  as HTMLButtonElement | null;
  btnPrevPage         = document.getElementById('prev-page-btn')         as HTMLButtonElement;
  btnNextPage         = document.getElementById('next-page-btn')         as HTMLButtonElement;
  btnZoomIn           = document.getElementById('btn-zoom-in')           as HTMLButtonElement;
  btnZoomOut          = document.getElementById('btn-zoom-out')          as HTMLButtonElement;
  btnZoomFit          = document.getElementById('btn-zoom-fit')          as HTMLButtonElement;
  btnSoundToggle      = document.getElementById('btn-sound-toggle')      as HTMLButtonElement;
  engineSelect        = document.getElementById('engine-select')         as HTMLSelectElement;

  importDialog        = document.getElementById('import-dialog')         as HTMLDialogElement;
  importTextarea      = document.getElementById('import-textarea')       as HTMLTextAreaElement;
  exportDialog        = document.getElementById('export-dialog')         as HTMLDialogElement;
  exportFormatsEl     = document.getElementById('export-formats')!;
  glyphDialog         = document.getElementById('glyph-dialog')          as HTMLDialogElement;
  glyphGrid           = document.getElementById('glyph-grid')!;
  glyphSearch         = document.getElementById('glyph-search')          as HTMLInputElement;
  glyphTabs           = document.getElementById('glyph-tabs')!;
  glyphWidthFilter    = document.getElementById('glyph-width-filter')   as HTMLSelectElement | null;
  const glyphToggleSmp = document.getElementById('glyph-toggle-smp')   as HTMLInputElement | null;
  if (glyphToggleSmp) {
    glyphToggleSmp.checked = hideSmpGlyphs;
    glyphToggleSmp.addEventListener('change', () => {
      setHideSmp(glyphToggleSmp.checked);
    });
  }

  // Dedicated Bookshelf Modal
  bookshelfDialog     = document.getElementById('bookshelf-dialog')      as HTMLDialogElement | null;
  bookshelfGrid       = document.getElementById('bookshelf-grid');
  btnBookshelfNewBook = document.getElementById('btn-bookshelf-new-book') as HTMLButtonElement | null;

  // Desktop Font Switcher Ribbon
  fontQuickChips      = document.getElementById('font-quick-chips');
  fontPagePrev        = document.getElementById('font-page-prev') as HTMLButtonElement | null;
  fontPageNext        = document.getElementById('font-page-next') as HTMLButtonElement | null;
  fontPageLabel       = document.getElementById('font-page-label');

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
  matrixSetsPrev      = document.getElementById('matrix-sets-prev')       as HTMLButtonElement | null;
  matrixSetsNext      = document.getElementById('matrix-sets-next')       as HTMLButtonElement | null;
  matrixSetsPageLabel = document.getElementById('matrix-sets-page-label');
  btnMatrixSetPicker  = document.getElementById('btn-matrix-set-picker')  as HTMLButtonElement | null;
  matrixActiveSetIcon = document.getElementById('matrix-active-set-icon');
  matrixActiveSetName = document.getElementById('matrix-active-set-name');
  matrixSetMenu       = document.getElementById('matrix-set-menu');

  // Initial render of dynamic paged strips and category set dropdown
  renderMatrixSetDropdown();
  updateActiveMatrixSetDisplay();
  renderMatrixSetChips();
  renderFontChips();

  // Collapsible Saved Art Deck
  savedArtDeck        = document.getElementById('saved-art-deck')         as HTMLElement;
  btnDeckToggle       = document.getElementById('btn-deck-toggle')        as HTMLButtonElement;
  deckToggleIcon      = document.getElementById('deck-toggle-icon')       as HTMLElement;
  deckToggleText      = document.getElementById('deck-toggle-text')       as HTMLElement;
  deckTitleToggle     = document.getElementById('deck-title-toggle')      as HTMLElement;
  deckPastesStrip     = document.getElementById('deck-pastes-strip')      as HTMLElement;
  btnDeckSaveRow      = document.getElementById('btn-deck-save-row')      as HTMLButtonElement | null;
  btnMobilePresets    = document.getElementById('btn-mobile-presets')    as HTMLButtonElement | null;
  btnToolbarPresets   = document.getElementById('btn-toolbar-presets')   as HTMLButtonElement | null;

  // Build the 14 Line Rows in the 14-Line Book View
  build14LineRows();

  // Dynamic Ribbon Page Sizing via ResizeObserver
  updateDynamicRibbonSizes();
  if (typeof ResizeObserver !== 'undefined') {
    let animId: number | null = null;
    const ro = new ResizeObserver(() => {
      if (animId) cancelAnimationFrame(animId);
      animId = requestAnimationFrame(() => {
        updateDynamicRibbonSizes();
      });
    });
    if (matrixSlotsRibbon) ro.observe(matrixSlotsRibbon);
    const setsWrap = document.getElementById('matrix-sets-pagination-wrap');
    if (setsWrap) ro.observe(setsWrap);
    const fontRibbon = document.getElementById('font-switcher-ribbon');
    if (fontRibbon) ro.observe(fontRibbon);
  }
  window.addEventListener('resize', () => {
    updateDynamicRibbonSizes();
  });
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
    row.className = `book-line-row${i === activeLineIndex ? ' active' : ''}${selectedLineIndices.has(i) ? ' selected' : ''}`;
    row.dataset.lineIndex = String(i);

    // Left checkbox for line selection
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'line-select-check';
    check.dataset.lineIndex = String(i);
    check.checked = selectedLineIndices.has(i);
    check.title = 'Select line for multi-line actions (Shift+Click for range, Cmd/Ctrl+Click to toggle)';
    check.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLineSelection(i, e.shiftKey, e.metaKey || e.ctrlKey, true);
    });

    const gutter = document.createElement('div');
    gutter.className = 'book-line-gutter';
    gutter.title = `Click to select Line ${i + 1} (Shift+Click for range)`;

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

    // Save icon on each line row
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'btn-row-save';
    saveBtn.dataset.lineIndex = String(i);
    saveBtn.innerHTML = '💾';
    saveBtn.title = 'Save snippet from this line (or selected lines) to History';
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      saveLineSnippet(i);
    });
    inputWrap.appendChild(saveBtn);

    row.appendChild(check);
    row.appendChild(gutter);
    row.appendChild(inputWrap);
    bookLinesList.appendChild(row);

    lineRowEls.push(row);
    lineInputEls.push(input);
    lineGutterNumEls.push(numSpan);
    lineGutterFillEls.push(barFill);
    lineGutterBadgeEls.push(badge);

    // Gutter click selects and focuses input
    gutter.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLineSelection(i, e.shiftKey, e.metaKey || e.ctrlKey, false);
      input.focus();
    });

    // Row click selects line when clicking gutter/empty row space
    row.addEventListener('click', (e) => {
      if (e.target === check || e.target === saveBtn || e.target === input) return;
      handleLineSelection(i, e.shiftKey, e.metaKey || e.ctrlKey, false);
      input.focus();
    });

    // Intercept mousedown on line input for Shift/Cmd/Ctrl multi-selection
    input.addEventListener('mousedown', (e: MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        e.preventDefault();
        handleLineSelection(i, e.shiftKey, e.metaKey || e.ctrlKey, false);
      }
    });

    // Intercept input insertion for non-destructive stylized font typing
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
        onLineInput(i);
      }
    });

    // Input Events
    input.addEventListener('focus', () => {
      if (!selectedLineIndices.has(i)) {
        selectedLineIndices.clear();
        selectedLineIndices.add(i);
        lastClickedLineIndex = i;
      }
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

function handleLineSelection(lineIdx: number, isShift: boolean, isModifier: boolean, isCheckboxClick: boolean): void {
  if (isShift) {
    const start = Math.min(lastClickedLineIndex, lineIdx);
    const end = Math.max(lastClickedLineIndex, lineIdx);
    if (!isModifier && !isCheckboxClick) {
      selectedLineIndices.clear();
    }
    for (let idx = start; idx <= end; idx++) {
      selectedLineIndices.add(idx);
    }
  } else if (isModifier || isCheckboxClick) {
    if (selectedLineIndices.has(lineIdx)) {
      if (selectedLineIndices.size > 1) {
        selectedLineIndices.delete(lineIdx);
      }
    } else {
      selectedLineIndices.add(lineIdx);
    }
    lastClickedLineIndex = lineIdx;
  } else {
    selectedLineIndices.clear();
    selectedLineIndices.add(lineIdx);
    lastClickedLineIndex = lineIdx;
  }

  activeLineIndex = lineIdx;
  updateActiveRowClass();
}

function updateActiveRowClass(): void {
  const isMulti = selectedLineIndices.size > 1;
  const firstSelected = isMulti ? Math.min(...selectedLineIndices) : -1;
  const sorted = isMulti ? [...selectedLineIndices].sort((a, b) => a - b) : [];
  const multiTitle = isMulti
    ? `Save selection (Lines ${sorted[0] + 1}–${sorted[sorted.length - 1] + 1}, ${sorted.length} lines) to Snippet Drawer`
    : '';

  lineRowEls.forEach((r, idx) => {
    r.classList.toggle('active', idx === activeLineIndex);
    r.classList.toggle('selected', selectedLineIndices.has(idx));
    const chk = r.querySelector<HTMLInputElement>('.line-select-check');
    if (chk) chk.checked = selectedLineIndices.has(idx);

    const saveBtn = r.querySelector<HTMLButtonElement>('.btn-row-save');
    if (saveBtn) {
      if (isMulti) {
        if (idx === firstSelected) {
          saveBtn.style.display = 'flex';
          saveBtn.title = multiTitle;
        } else {
          saveBtn.style.display = 'none';
        }
      } else {
        saveBtn.style.display = '';
        saveBtn.title = `Save Line ${idx + 1} snippet to Snippet Drawer`;
      }
    }
  });
}

function saveLineSnippet(lineIdx: number): void {
  let linesToSave: string[] = [];
  let title = '';
  if (selectedLineIndices.has(lineIdx) && selectedLineIndices.size > 1) {
    const sorted = [...selectedLineIndices].sort((a, b) => a - b);
    linesToSave = sorted.map(idx => currentLines[idx] ?? '');
    title = `Snippet: Lines ${sorted[0] + 1}-${sorted[sorted.length - 1] + 1}`;
  } else {
    linesToSave = [currentLines[lineIdx] ?? ''];
    title = `Snippet: Line ${lineIdx + 1}`;
  }

  const newTemplate: SavedTemplate = {
    id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    scope: 'lines',
    category: 'Snippet',
    lines: linesToSave,
    createdAt: Date.now(),
    isPreset: false,
  };
  savedTemplates = [newTemplate, ...savedTemplates];
  saveUserTemplates(savedTemplates);

  // Auto-expand Snippet Drawer so user sees the newly saved snippet immediately
  setDeckCollapsed(false);
  if (activeDeckFilter === 'page') {
    activeDeckFilter = 'all';
    document.getElementById('deck-filter-chips')?.querySelectorAll<HTMLButtonElement>('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.deckFilter === 'all');
    });
  }

  refreshDeckPastes();
  updateGalleryCounts();

  // Highlight and scroll the newly added card into view
  setTimeout(() => {
    const firstCard = deckPastesStrip?.querySelector('.deck-paste-card') as HTMLElement | null;
    if (firstCard) {
      firstCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      firstCard.classList.add('card-just-added');
      setTimeout(() => firstCard.classList.remove('card-just-added'), 1800);
    }
  }, 50);

  soundManager.playButtonClick();
  showToast(`Saved "${title}" to Snippet Drawer`, 'success');
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
  pushUndoSnapshot(`Edit Line ${lineIdx + 1}`, 'text');
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

    pushUndoSnapshot(`Split Line ${lineIdx + 1}`, 'text');
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

      pushUndoSnapshot(`Merge Line ${lineIdx + 1}`, 'text');
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

  pushUndoSnapshot('Paste Text', 'text');
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

  const isMobileActive = mobileLineInput && (document.activeElement === mobileLineInput || (window.innerWidth <= 768 && document.activeElement !== lineInputEls[activeLineIndex]));
  const input = (isMobileActive ? mobileLineInput : lineInputEls[activeLineIndex]) || mobileLineInput || lineInputEls[activeLineIndex];
  if (!input) return;

  const start = input.selectionStart ?? input.value.length;
  const end   = input.selectionEnd   ?? input.value.length;
  const currentVal = currentLines[activeLineIndex] ?? '';

  currentLines[activeLineIndex] = currentVal.slice(0, start) + text + currentVal.slice(end);
  if (lineInputEls[activeLineIndex]) lineInputEls[activeLineIndex].value = currentLines[activeLineIndex];
  if (mobileLineInput) mobileLineInput.value = currentLines[activeLineIndex];
  const pos = start + text.length;
  input.setSelectionRange(pos, pos);
  input.focus();

  handleLineAutoWrap(activeLineIndex);
  const snippet = text.length > 8 ? text.slice(0, 7) + '…' : text;
  pushUndoSnapshot(`Insert "${snippet}"`, 'glyph');
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

  const isMobileActive = mobileLineInput && (document.activeElement === mobileLineInput || (window.innerWidth <= 768 && document.activeElement !== lineInputEls[activeLineIndex]));
  const input = (isMobileActive ? mobileLineInput : lineInputEls[activeLineIndex]) || mobileLineInput || lineInputEls[activeLineIndex];
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
  if (lineInputEls[activeLineIndex]) lineInputEls[activeLineIndex].value = currentLines[activeLineIndex];
  if (mobileLineInput) mobileLineInput.value = currentLines[activeLineIndex];
  const pos = start + replacement.length;
  input.setSelectionRange(pos, pos);
  input.focus();
  input.focus();

  handleLineAutoWrap(activeLineIndex);
  const isColor = /^[0-9a-f]$/i.test(code.replace('§', ''));
  pushUndoSnapshot(isColor ? `Color ${code}` : `Format ${code}`, isColor ? 'color' : 'style');
  updateAll();
}

// ─── Undo / Redo System ───────────────────────────────────────────────────────

export function pushUndoSnapshot(
  actionLabel = 'Edit',
  actionCategory: UndoSnapshot['actionCategory'] = 'text'
): void {
  if (isApplyingHistory) return;
  const snapshot: UndoSnapshot = {
    book: {
      title: book.title,
      author: book.author,
      pages: [...book.pages],
    },
    pageIndex: currentPageIndex,
    actionLabel,
    actionCategory,
    timestamp: Date.now(),
  };

  undoStack.push(snapshot);
  if (undoStack.length > MAX_UNDO_HISTORY) {
    undoStack.shift();
  }
  redoStack.length = 0;
  updateUndoRedoButtons();
  if (historyDialog && historyDialog.open) {
    renderHistoryTable();
  }
}

export function undo(): void {
  if (undoStack.length === 0) return;
  isApplyingHistory = true;

  const prev = undoStack.pop()!;
  redoStack.push({
    book: { title: book.title, author: book.author, pages: [...book.pages] },
    pageIndex: currentPageIndex,
    actionLabel: prev.actionLabel || 'Action',
    actionCategory: prev.actionCategory || 'text',
    timestamp: Date.now(),
  });

  book = {
    title: prev.book.title,
    author: prev.book.author,
    pages: [...prev.book.pages],
  };
  if (metaTitle) metaTitle.value = book.title;
  if (metaAuthor) metaAuthor.value = book.author;
  currentPageIndex = Math.min(prev.pageIndex, book.pages.length - 1);

  loadPageIntoEditor(currentPageIndex);
  syncViewerToBook();

  isApplyingHistory = false;
  updateUndoRedoButtons();
  triggerAutosave();
  showToast('Undo', 'info');
}

export function redo(): void {
  if (redoStack.length === 0) return;
  isApplyingHistory = true;

  const next = redoStack.pop()!;
  undoStack.push({
    book: { title: book.title, author: book.author, pages: [...book.pages] },
    pageIndex: currentPageIndex,
    actionLabel: next.actionLabel || 'Action',
    actionCategory: next.actionCategory || 'text',
    timestamp: Date.now(),
  });

  book = {
    title: next.book.title,
    author: next.book.author,
    pages: [...next.book.pages],
  };
  if (metaTitle) metaTitle.value = book.title;
  if (metaAuthor) metaAuthor.value = book.author;
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
  if (historyDialog && historyDialog.open) {
    renderHistoryTable();
  }
}

// ─── LocalStorage Autosave & Restore ──────────────────────────────────────────

function triggerAutosave(): void {
  if (autosaveDot) {
    autosaveDot.classList.add('saving');
    autosaveDot.classList.remove('error');
  }
  const savingTooltip = 'Auto-save: Saving changes…';
  if (autosaveIndicator) {
    autosaveIndicator.title = savingTooltip;
    autosaveIndicator.setAttribute('data-tooltip', savingTooltip);
  }
  if (autosaveText) autosaveText.textContent = 'Saving…';

  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      const data = {
        book,
        timestamp: Date.now(),
        currentPageIndex,
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
      }
      syncCurrentBookToBookshelf();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const savedTooltip = `Auto-save: Saved locally at ${timeStr}`;
      if (autosaveText) autosaveText.textContent = `Saved ${timeStr}`;
      if (autosaveIndicator) {
        autosaveIndicator.title = savedTooltip;
        autosaveIndicator.setAttribute('data-tooltip', savedTooltip);
      }
    } catch {
      const errTooltip = 'Auto-save: Error saving to local storage';
      if (autosaveText) autosaveText.textContent = 'Autosave error';
      if (autosaveDot) autosaveDot.classList.add('error');
      if (autosaveIndicator) {
        autosaveIndicator.title = errTooltip;
        autosaveIndicator.setAttribute('data-tooltip', errTooltip);
      }
    } finally {
      if (autosaveDot) autosaveDot.classList.remove('saving');
    }
  }, 400);
}

function restoreAutosave(): boolean {
  try {
    const savedActiveId = localStorage.getItem(BOOKSHELF_ACTIVE_KEY);
    const books = loadBookshelf();
    if (books.length > 0) {
      const active = (savedActiveId && books.find(b => b.id === savedActiveId)) || books[0];
      if (active) {
        activeBookId = active.id;
        const targetWidth = engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
        book = normalizeBook({
          title: active.title,
          author: active.author,
          pages: active.pages.length > 0 ? active.pages : [''],
        }, { maxWidth: targetWidth });
        currentPageIndex = 0;
        return true;
      }
    }

    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.book && Array.isArray(parsed.book.pages) && parsed.book.pages.length > 0) {
      const targetWidth = engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
      book = normalizeBook(parsed.book, { maxWidth: targetWidth });
      currentPageIndex = Math.max(0, Math.min(parsed.currentPageIndex || 0, book.pages.length - 1));
      syncCurrentBookToBookshelf();
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
  if (textarea) textarea.value = pageText;

  for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
    if (lineInputEls[i]) {
      lineInputEls[i].value = currentLines[i] ?? '';
    }
  }

  if (pageBadge) pageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  if (previewIndicator) {
    previewIndicator.textContent = `${currentPageIndex + 1} / ${book.pages.length}`;
  }
  const sidePageBadge = typeof document !== 'undefined' ? document.getElementById('side-page-badge') : null;
  const flyoutPageBadge = typeof document !== 'undefined' ? document.getElementById('flyout-page-badge') : null;
  if (sidePageBadge) sidePageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  if (flyoutPageBadge) flyoutPageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;

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
  if (rulerTargetWidth) {
    rulerTargetWidth.textContent = `Target: ${mw} px/line`;
  }

  // Update Gutter Meters across all 14 Lines
  for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
    const lineText = currentLines[i] ?? '';
    const style = getCarriedStyleForLine(currentLines, i);
    const lineW = Math.round(measureLineWidth(parseFormattedText(lineText, style)));
    const pct = Math.min(100, (lineW / mw) * 100);
    const isOver = lineW > mw;
    const isFull = lineW === mw;
    const isWarn = pct > 90 && !isFull && !isOver;

    if (lineRowEls[i]) {
      lineRowEls[i].classList.toggle('over-width', isOver);
    }
    if (lineInputEls[i]) {
      lineInputEls[i].classList.toggle('over-width', isOver);
    }

    if (lineGutterFillEls[i]) {
      lineGutterFillEls[i].style.width = `${Math.min(100, pct)}%`;
      lineGutterFillEls[i].className = `gutter-bar-fill${isOver ? ' over' : isFull ? ' full' : isWarn ? ' warn' : ''}`;
    }
    if (lineGutterBadgeEls[i]) {
      lineGutterBadgeEls[i].textContent = `${lineW}px`;
      lineGutterBadgeEls[i].className = `gutter-badge${isOver ? ' over' : isFull ? ' full' : isWarn ? ' warn' : ''}`;
      if (isOver) {
        lineGutterBadgeEls[i].title = `${lineW}px exceeds Minecraft maximum of ${mw}px`;
      } else {
        lineGutterBadgeEls[i].title = `${lineW}px / ${mw}px`;
      }
    }
  }

  // Footer Stats
  const pageText = isRawMode ? textarea.value : getPageTextFromLines(currentLines);
  const totalChars = pageText.length;
  const activeStyle = getCarriedStyleForLine(currentLines, activeLineIndex);
  const activeW = Math.round(measureLineWidth(parseFormattedText(currentLines[activeLineIndex] ?? '', activeStyle)));
  const pxLeft = Math.max(0, mw - activeW);

  if (statChars) {
    statChars.textContent = `${totalChars} / ${MINECRAFT_PAGE_MAX_CHARS} chars`;
    statChars.classList.toggle('stat-warn', totalChars > MINECRAFT_PAGE_MAX_CHARS);
  }
  if (statPixelsLeft) {
    statPixelsLeft.textContent = `${pxLeft} px left`;
  }

  if (statLines) {
    statLines.textContent = `14 lines (L${activeLineIndex + 1} active)`;
  }
  if (statWords) {
    const words = pageText.trim() ? pageText.trim().split(/\s+/).length : 0;
    statWords.textContent = `${words} words`;
  }

  const isOverChars = totalChars > MINECRAFT_PAGE_MAX_CHARS;
  const unsupported = detectUnsupportedMinecraftChars(pageText);

  if (diagSummary) {
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
      diagSummary.textContent = '✓ Valid';
      diagSummary.className = 'badge badge-ok';
      diagSummary.title = 'All lines and characters are valid Minecraft book text.';
    }
  }

  if (metaTitleCount && metaTitle) {
    metaTitleCount.textContent = `${metaTitle.value.length}/32`;
  }
  if (metaAuthorCount && metaAuthor) {
    metaAuthorCount.textContent = `${metaAuthor.value.length}/16`;
  }

  // Mobile Active Line Deck & Traffic Light Dot Sync
  if (mobileLineInput && typeof document !== 'undefined' && document.activeElement !== mobileLineInput) {
    mobileLineInput.value = currentLines[activeLineIndex] ?? '';
    mobileLineInput.placeholder = `Type line ${activeLineIndex + 1} text…`;
  }

  const mobileDot = typeof document !== 'undefined' ? document.getElementById('mobile-traffic-dot') : null;
  if (mobileDot) {
    if (activeW > mw) {
      mobileDot.className = 'mobile-traffic-dot dot-over';
    } else if (activeW >= mw * 0.9) {
      mobileDot.className = 'mobile-traffic-dot dot-warn';
    } else {
      mobileDot.className = 'mobile-traffic-dot dot-ok';
    }
  }
  if (mobileLinePill) {
    mobileLinePill.textContent = `Line ${activeLineIndex + 1} / ${MINECRAFT_LINES_PER_PAGE}`;
  }
  const mobilePxVal = typeof document !== 'undefined' ? document.getElementById('mobile-px-val') : null;
  const mobilePxMax = typeof document !== 'undefined' ? document.getElementById('mobile-px-max') : null;
  if (mobilePxVal) mobilePxVal.textContent = String(activeW);
  if (mobilePxMax) mobilePxMax.textContent = String(mw);
  if (mobileTrafficDot) {
    const isOver = activeW > mw;
    const isWarn = activeW >= Math.floor(mw * 0.9) && !isOver;
    mobileTrafficDot.className = `mobile-traffic-dot ${isOver ? 'dot-overflow' : isWarn ? 'dot-warn' : 'dot-ok'}`;
    mobileTrafficDot.title = `Line ${activeLineIndex + 1}: ${activeW} / ${mw} px`;
  }
}

// ─── Master Update ────────────────────────────────────────────────────────────

function updateAll(immediate = false): void {
  updateGutterAndStats();

  // Sync state
  if (isRawMode) {
    if (textarea) book.pages[currentPageIndex] = textarea.value;
  } else {
    const pageText = getPageTextFromLines(currentLines);
    book.pages[currentPageIndex] = pageText;
    if (textarea) textarea.value = pageText;
  }
  if (metaTitle) book.title  = metaTitle.value.trim()  || 'Untitled';
  if (metaAuthor) book.author = metaAuthor.value.trim() || 'Author';

  if (immediate) {
    syncViewerToBook();
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      syncViewerToBook();
    }, 60);
  }

  if (pageBadge) {
    pageBadge.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  }
  if (previewIndicator) {
    previewIndicator.textContent = `${currentPageIndex + 1} / ${book.pages.length}`;
  }
  const sidePageBadge2 = typeof document !== 'undefined' ? document.getElementById('side-page-badge') : null;
  const flyoutPageBadge2 = typeof document !== 'undefined' ? document.getElementById('flyout-page-badge') : null;
  if (sidePageBadge2) sidePageBadge2.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
  if (flyoutPageBadge2) flyoutPageBadge2.textContent = `Page ${currentPageIndex + 1} / ${book.pages.length}`;
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
export let activeGlyphCat: GlyphCategory = 'symbols';
export let currentGlyphPage = 1;
export const GLYPH_PAGE_SIZE = 120;
let activeGlyphTint: string = '#FFFFFF';
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

function renderGlyphs(): void {
  ensureAtlasLoaded();

  glyphGrid.style.display = 'grid';

  const query = glyphSearch.value.trim().toLowerCase();
  glyphGrid.innerHTML = '';

  let itemsToRender: GlyphItem[] = [];

  if (query) {
    const qTokens = query.split(/\s+/).filter(Boolean);
    itemsToRender = ALL_GLYPHS.filter((item) => {
      const hex = (item.char.codePointAt(0) || 0).toString(16).toLowerCase();
      const aliases = getUnicodeSearchAliases(item.char).toLowerCase();
      const name = item.name.toLowerCase();
      const searchable = `${item.char} ${name} ${aliases} u+${hex} ${hex}`;
      return qTokens.every((tok) => searchable.includes(tok));
    });

    // If active category is a large subset (e.g. nonlatin, noncharacter, cjk, latin), also search within that subset
    if (activeGlyphCat in GLYPHS_BY_CATEGORY && !['all', 'fav', 'recent'].includes(activeGlyphCat)) {
      const subsetItems = (GLYPHS_BY_CATEGORY as any)[activeGlyphCat] || [];
      const subsetMatches = subsetItems.filter((item: GlyphItem) => {
        const hex = (item.char.codePointAt(0) || 0).toString(16).toLowerCase();
        const aliases = getUnicodeSearchAliases(item.char).toLowerCase();
        const name = item.name.toLowerCase();
        const searchable = `${item.char} ${name} ${aliases} u+${hex} ${hex}`;
        return qTokens.every((tok) => searchable.includes(tok));
      });
      const seen = new Set(itemsToRender.map(i => i.char));
      for (const m of subsetMatches) {
        if (!seen.has(m.char)) {
          seen.add(m.char);
          itemsToRender.push(m);
        }
      }
    }
  } else if (activeGlyphCat === 'fav') {
    itemsToRender = userFavoriteGlyphs.map((c) => findGlyphItem(c));
  } else if (activeGlyphCat === 'recent') {
    itemsToRender = recentGlyphs.map((c) => findGlyphItem(c));
  } else if (activeGlyphCat === 'all') {
    // Curated Symbol Chat set, never dump >100k
    itemsToRender = ALL_GLYPHS;
  } else {
    itemsToRender = (GLYPHS_BY_CATEGORY as any)[activeGlyphCat] || [];
  }

  // Filter out SMP characters if hideSmpGlyphs is active
  if (hideSmpGlyphs) {
    itemsToRender = itemsToRender.filter((item) => !item.isSmp);
  }

  // Filter by pixel width if selected
  if (selectedGlyphWidth !== 'all') {
    const targetPx = parseInt(selectedGlyphWidth, 10);
    itemsToRender = itemsToRender.filter((item) => getCharPixelAdvance(item.char) === targetPx);
  }

  const totalPages = Math.max(1, Math.ceil(itemsToRender.length / GLYPH_PAGE_SIZE));
  if (currentGlyphPage > totalPages) currentGlyphPage = totalPages;
  if (currentGlyphPage < 1) currentGlyphPage = 1;

  // Update pagination bar
  const pageInfo = document.getElementById('glyph-page-info');
  const prevBtn = document.getElementById('glyph-page-prev') as HTMLButtonElement | null;
  const nextBtn = document.getElementById('glyph-page-next') as HTMLButtonElement | null;
  if (pageInfo) {
    pageInfo.textContent = `Page ${currentGlyphPage} / ${totalPages} (${itemsToRender.length.toLocaleString()} symbols)`;
  }
  if (prevBtn) prevBtn.disabled = currentGlyphPage <= 1;
  if (nextBtn) nextBtn.disabled = currentGlyphPage >= totalPages;

  // Windowed rendering: only render current page to keep DOM fast
  const startIdx = (currentGlyphPage - 1) * GLYPH_PAGE_SIZE;
  const pageItems = itemsToRender.slice(startIdx, startIdx + GLYPH_PAGE_SIZE);

  if (pageItems.length > 0) {
    updateGlyphInspector(pageItems[0]);
  }

  pageItems.forEach((item) => {
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

// ─── Mobile Viewport & Virtual Keyboard Tracking ────────────────────────────

function initMobileKeyboardTracking(): void {
  if (typeof window === 'undefined') return;

  const updateVh = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
  };
  updateVh();
  window.addEventListener('resize', updateVh);

  if (window.visualViewport) {
    const handleViewport = () => {
      if (!window.visualViewport) return;
      const currentHeight = window.visualViewport.height;
      const fullHeight = window.innerHeight;
      const isKeyboardOpen = (fullHeight - currentHeight) > 140 || (document.activeElement === mobileLineInput);

      document.body.classList.toggle('keyboard-open', isKeyboardOpen);
      document.querySelector('.app-layout')?.classList.toggle('keyboard-open', isKeyboardOpen);
    };

    window.visualViewport.addEventListener('resize', handleViewport);
  }
}

// ─── Event Wiring ─────────────────────────────────────────────────────────────

function wireEvents(): void {
  initMobileKeyboardTracking();

  // Mobile Active Line Stepper & Input Events
  if (mobileLineInput) {
    mobileLineInput.addEventListener('beforeinput', (e: InputEvent) => {
      if (activeFontId === 'normal') return;
      if (e.inputType === 'insertText' && e.data) {
        e.preventDefault();
        const transformed = transformWithFont(e.data, activeFontId);
        const start = mobileLineInput!.selectionStart ?? 0;
        const end = mobileLineInput!.selectionEnd ?? 0;
        const current = mobileLineInput!.value;
        mobileLineInput!.value = current.slice(0, start) + transformed + current.slice(end);
        const newPos = start + transformed.length;
        mobileLineInput!.setSelectionRange(newPos, newPos);
        mobileLineInput!.dispatchEvent(new Event('input'));
      }
    });

    mobileLineInput.addEventListener('input', () => {
      const prevVal = currentLines[activeLineIndex];
      currentLines[activeLineIndex] = mobileLineInput!.value;

      if (lineInputEls[activeLineIndex]) {
        lineInputEls[activeLineIndex].value = mobileLineInput!.value;
      }

      const totalChars = getTotalPageChars(currentLines);
      if (totalChars > MINECRAFT_PAGE_MAX_CHARS) {
        currentLines[activeLineIndex] = prevVal;
        mobileLineInput!.value = prevVal;
        if (lineInputEls[activeLineIndex]) lineInputEls[activeLineIndex].value = prevVal;
        showToast(`Minecraft character limit reached (${MINECRAFT_PAGE_MAX_CHARS} max per page)`, 'warn');
        updateAll();
        return;
      }

      handleLineAutoWrap(activeLineIndex);
      pushUndoSnapshot(`Edit Line ${activeLineIndex + 1}`, 'text');
      updateAll();
    });

    mobileLineInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (activeLineIndex < MINECRAFT_LINES_PER_PAGE - 1) {
          activeLineIndex++;
          updateActiveRowClass();
          updateGutterAndStats();
          if (mobileLineInput) {
            mobileLineInput.value = currentLines[activeLineIndex] ?? '';
            mobileLineInput.focus();
          }
        } else if (currentPageIndex < book.pages.length - 1 || book.pages.length < MINECRAFT_MAX_PAGES) {
          advancePage();
          activeLineIndex = 0;
          updateActiveRowClass();
          updateGutterAndStats();
          if (mobileLineInput) {
            mobileLineInput.value = currentLines[activeLineIndex] ?? '';
            mobileLineInput.focus();
          }
        }
      }
    });
  }

  btnMobilePrevLine?.addEventListener('click', () => {
    if (activeLineIndex > 0) {
      activeLineIndex--;
      updateActiveRowClass();
      updateGutterAndStats();
      if (mobileLineInput) {
        mobileLineInput.value = currentLines[activeLineIndex] ?? '';
        mobileLineInput.focus();
      }
    } else if (currentPageIndex > 0) {
      retreatPage();
      activeLineIndex = MINECRAFT_LINES_PER_PAGE - 1;
      updateActiveRowClass();
      updateGutterAndStats();
      if (mobileLineInput) {
        mobileLineInput.value = currentLines[activeLineIndex] ?? '';
        mobileLineInput.focus();
      }
    }
  });

  btnMobileNextLine?.addEventListener('click', () => {
    if (activeLineIndex < MINECRAFT_LINES_PER_PAGE - 1) {
      activeLineIndex++;
      updateActiveRowClass();
      updateGutterAndStats();
      if (mobileLineInput) {
        mobileLineInput.value = currentLines[activeLineIndex] ?? '';
        mobileLineInput.focus();
      }
    } else if (currentPageIndex < book.pages.length - 1 || book.pages.length < MINECRAFT_MAX_PAGES) {
      advancePage();
      activeLineIndex = 0;
      updateActiveRowClass();
      updateGutterAndStats();
      if (mobileLineInput) {
        mobileLineInput.value = currentLines[activeLineIndex] ?? '';
        mobileLineInput.focus();
      }
    }
  });

  btnMobileFont?.addEventListener('click', (e) => {
    e.stopPropagation();
    const fontPanel = document.getElementById('panel-font-switcher');
    if (!fontPanel) return;
    const isOpen = fontPanel.classList.toggle('mobile-drawer-open');
    btnMobileFont!.classList.toggle('active', isOpen);
    btnMobileFont!.textContent = isOpen ? '✕ Font' : '🔤 Font';
  });

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
    pushUndoSnapshot('Edit Raw Text', 'text');
    updateAll();
  });

  metaTitle.addEventListener('input', () => {
    pushUndoSnapshot('Edit Title', 'meta');
    updateAll();
  });

  metaAuthor.addEventListener('input', () => {
    pushUndoSnapshot('Edit Author', 'meta');
    updateAll();
  });

  // 3. Undo / Redo / Edit History
  btnUndo.addEventListener('click', () => undo());
  btnRedo.addEventListener('click', () => redo());
  btnHistory?.addEventListener('click', () => {
    renderHistoryTable();
    historyDialog?.showModal();
  });

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
      pushUndoSnapshot(`Center Line ${targetLineIdx + 1}`, 'layout');
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
      pushUndoSnapshot(`Center Line ${activeLineIndex + 1}`, 'layout');
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
        pushUndoSnapshot('Clean Duplicate Codes', 'style');
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
        pushUndoSnapshot('Clean Duplicate Codes', 'style');
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

  // 7b. Copy Page in Book Preview (With format selection dropdown)
  let activeCopyFormat: PageCopyFormat = 'raw';
  const btnPreviewCopyOpts = document.getElementById('btn-preview-copy-opts');
  const previewCopyMenu = document.getElementById('preview-copy-menu');

  btnPreviewCopyPage?.addEventListener('click', (e) => {
    e.preventDefault();
    triggerCopyPageFeedback(activeCopyFormat, btnPreviewCopyPage);
  });

  btnPreviewCopyOpts?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (previewCopyMenu) {
      const isVis = previewCopyMenu.style.display !== 'none';
      previewCopyMenu.style.display = isVis ? 'none' : 'flex';
    }
  });

  previewCopyMenu?.querySelectorAll<HTMLButtonElement>('.copy-option-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      activeCopyFormat = (item.dataset.format as PageCopyFormat) || 'raw';
      if (previewCopyMenu) previewCopyMenu.style.display = 'none';
      triggerCopyPageFeedback(activeCopyFormat, btnPreviewCopyPage);
    });
  });

  document.addEventListener('click', (e) => {
    if (previewCopyMenu && !previewCopyMenu.contains(e.target as Node) && e.target !== btnPreviewCopyOpts) {
      previewCopyMenu.style.display = 'none';
    }
  });

  // Dedicated Bookshelf Wire Events
  btnOpenBookshelf?.addEventListener('click', (e) => {
    e.preventDefault();
    openBookshelf();
  });

  btnBookshelfNewBook?.addEventListener('click', (e) => {
    e.preventDefault();
    createNewBook();
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

    pushUndoSnapshot(`Clear Page ${currentPageIndex + 1}`, 'clear');
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
      pushUndoSnapshot(`Add Page ${book.pages.length + 1}`, 'page');
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

  // Flanking Side Page Buttons for Mobile Handheld View
  const sidePrevBtn = document.getElementById('side-prev-page-btn');
  const sideNextBtn = document.getElementById('side-next-page-btn');
  sidePrevBtn?.addEventListener('click', retreatPage);
  sideNextBtn?.addEventListener('click', advancePage);

  // Studio Tools Flyout Copy Page Buttons
  const btnFlyoutCopyPage = document.getElementById('btn-flyout-copy-page') as HTMLButtonElement | null;
  btnFlyoutCopyPage?.addEventListener('click', () => {
    triggerCopyPageFeedback('raw', btnFlyoutCopyPage);
  });

  document.querySelectorAll<HTMLButtonElement>('.flyout-fmt-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const fmt = (btn.dataset.format as PageCopyFormat) || 'raw';
      triggerCopyPageFeedback(fmt, btn);
    });
  });

  // 8. Saved Presets & History Wire Events
  savedTemplates = loadSavedTemplates();
  migrateSnippetHistory();

  function applyTemplate(tpl: SavedTemplate): void {
    pushUndoSnapshot(`Apply Preset "${tpl.title}"`, 'preset');
    if (tpl.scope === 'page') {
      currentLines = [...tpl.lines];
      while (currentLines.length < MINECRAFT_LINES_PER_PAGE) currentLines.push('');
      currentLines = currentLines.slice(0, MINECRAFT_LINES_PER_PAGE);
      reflowPageLines(currentLines, 0, maxWidth(), MINECRAFT_LINES_PER_PAGE);
      for (let i = 0; i < MINECRAFT_LINES_PER_PAGE; i++) {
        if (lineInputEls[i]) lineInputEls[i].value = currentLines[i] ?? '';
      }
      updateAll(true);
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
      showToast(`Inserted ${tpl.lines.length} lines from "${tpl.title}"`, 'success');
    }
  }

  // ─── Font Switcher Wiring ───────────────────────────────────────────────
  fontPagePrev?.addEventListener('click', () => {
    const totalFontPages = Math.max(1, Math.ceil(FONT_CHIPS_DATA.length / currentFontsPageSize));
    if (currentFontPage > 0) {
      currentFontPage--;
    } else {
      currentFontPage = totalFontPages - 1;
    }
    renderFontChips();
  });

  fontPageNext?.addEventListener('click', () => {
    const totalFontPages = Math.max(1, Math.ceil(FONT_CHIPS_DATA.length / currentFontsPageSize));
    if (currentFontPage < totalFontPages - 1) {
      currentFontPage++;
    } else {
      currentFontPage = 0;
    }
    renderFontChips();
  });

  // Dedicated "Transform Line" button on Font Switcher panel
  const btnFontApplyLinePanel = document.getElementById('btn-font-apply-line-panel');
  btnFontApplyLinePanel?.addEventListener('click', () => {
    const current = currentLines[activeLineIndex] ?? '';
    if (!current.trim()) {
      showToast('Active line is empty', 'warn');
      return;
    }
    const font = getFontById(activeFontId);
    const converted = font.transform(current);
    pushUndoSnapshot(`Apply ${font.name} to Line ${activeLineIndex + 1}`, 'font');
    currentLines[activeLineIndex] = converted;
    if (lineInputEls[activeLineIndex]) {
      lineInputEls[activeLineIndex].value = converted;
    }
    saveCurrentPageToBook();
    updateAll();
    showToast(`Applied ${font.name} to line ${activeLineIndex + 1}`, 'success');
  });



  // 9. Matrix Selector & Tools Hub Wire Events
  renderMatrixSlots();

  matrixPxUp?.addEventListener('click', () => {
    const setId = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;
    const available = getAvailableWidthsForSet(setId);
    const targetPx = currentMatrixMode.px ?? currentMatrixPx;
    const idx = available.indexOf(targetPx);
    const nextPx = idx !== -1 && idx < available.length - 1 ? available[idx + 1] : available[0];
    currentMatrixPx = nextPx;
    currentMatrixMode.px = nextPx;
    currentMatrixPage = 0;
    renderMatrixSlots();
  });

  matrixPxDown?.addEventListener('click', () => {
    const setId = currentMatrixMode.type === 'set' ? currentMatrixMode.setId : currentMatrixSetId;
    const available = getAvailableWidthsForSet(setId);
    const targetPx = currentMatrixMode.px ?? currentMatrixPx;
    const idx = available.indexOf(targetPx);
    const prevPx = idx !== -1 && idx > 0 ? available[idx - 1] : available[available.length - 1];
    currentMatrixPx = prevPx;
    currentMatrixMode.px = prevPx;
    currentMatrixPage = 0;
    renderMatrixSlots();
  });

  matrixPagePrev?.addEventListener('click', () => {
    const list = getGlyphsForCurrentSelection();
    const totalPages = Math.max(1, Math.ceil(list.length / currentMatrixPageSize));
    if (currentMatrixPage > 0) {
      currentMatrixPage--;
    } else {
      currentMatrixPage = totalPages - 1;
    }
    renderMatrixSlots();
  });

  matrixPageNext?.addEventListener('click', () => {
    const list = getGlyphsForCurrentSelection();
    const totalPages = Math.max(1, Math.ceil(list.length / currentMatrixPageSize));
    if (currentMatrixPage < totalPages - 1) {
      currentMatrixPage++;
    } else {
      currentMatrixPage = 0;
    }
    renderMatrixSlots();
  });

  matrixSetsPrev?.addEventListener('click', () => {
    const totalSetsPages = Math.max(1, Math.ceil(CATEGORY_DEFINITIONS.length / currentSetsPageSize));
    if (currentSetsPage > 0) {
      currentSetsPage--;
    } else {
      currentSetsPage = totalSetsPages - 1;
    }
    renderMatrixSetChips();
  });

  matrixSetsNext?.addEventListener('click', () => {
    const totalSetsPages = Math.max(1, Math.ceil(CATEGORY_DEFINITIONS.length / currentSetsPageSize));
    if (currentSetsPage < totalSetsPages - 1) {
      currentSetsPage++;
    } else {
      currentSetsPage = 0;
    }
    renderMatrixSetChips();
  });

  // Matrix Set Dropdown Toggle
  btnMatrixSetPicker?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMatrixSetMenu();
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
    const target = e.target as HTMLElement;
    if (matrixSetMenu && matrixSetMenu.style.display !== 'none') {
      if (!matrixSetMenu.contains(target) && target !== btnMatrixSetPicker && !btnMatrixSetPicker?.contains(target)) {
        closeMatrixSetMenu();
      }
    }
    if (studioToolsFlyout && studioToolsFlyout.style.display !== 'none') {
      if (!studioToolsFlyout.contains(target) && target !== btnStudioTools && !btnStudioTools.contains(target)) {
        studioToolsFlyout.style.display = 'none';
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMatrixSetMenu();
      if (studioToolsFlyout) studioToolsFlyout.style.display = 'none';
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
  function renderDeckPastes(): void {
    if (!deckPastesStrip) return;
    deckPastesStrip.innerHTML = '';

    const hiddenIds = getHiddenPresetIds();
    const visibleDefaults = DEFAULT_PRESETS.filter(p => !hiddenIds.has(p.id));
    const userItems = savedTemplates.filter(t => !t.isPreset);
    const allDeckItems = [...userItems, ...visibleDefaults];

    const filtered = allDeckItems.filter(item => {
      if (activeDeckFilter === 'page') return item.scope === 'page';
      if (activeDeckFilter === 'lines') return item.scope === 'lines';
      if (activeDeckFilter === 'kaomoji') return item.category === 'Kaomoji';
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
      `;
      deckPastesStrip.appendChild(empty);
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
      const canvas = renderSnippetPreviewCanvas(preset.lines.slice(0, 8), { scale: 2 });
      preview.appendChild(canvas);
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
                    updateGalleryCounts();
          showToast(`Deleted "${preset.title}"`, 'info');
        });
        actions.appendChild(delBtn);
      }

      card.appendChild(actions);
      deckPastesStrip.appendChild(card);
    });
  }
  refreshDeckPastes = renderDeckPastes;
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
  setDeckCollapsed = function (collapsed: boolean): void {
    if (!savedArtDeck) return;
    if (collapsed) {
      savedArtDeck.classList.add('collapsed');
      if (deckToggleIcon) deckToggleIcon.textContent = '▲';
      if (deckToggleText) deckToggleText.textContent = 'Expand Snippets';
      btnDeckToggle?.classList.remove('btn-outline');
      btnDeckToggle?.classList.add('btn-primary');
      if (btnMobilePresets) {
        btnMobilePresets.classList.remove('active');
        btnMobilePresets.textContent = '🎨 Snippets';
      }
      if (btnToolbarPresets) {
        btnToolbarPresets.classList.remove('active');
      }
    } else {
      savedArtDeck.classList.remove('collapsed');
      if (deckToggleIcon) deckToggleIcon.textContent = '✕';
      if (deckToggleText) deckToggleText.textContent = 'Close';
      btnDeckToggle?.classList.remove('btn-primary');
      btnDeckToggle?.classList.add('btn-outline');
      if (btnMobilePresets) {
        btnMobilePresets.classList.add('active');
        btnMobilePresets.textContent = '✕ Snippets';
      }
      if (btnToolbarPresets) {
        btnToolbarPresets.classList.add('active');
      }
      renderDeckPastes();
    }
    try {
      localStorage.setItem('blockgame_art_deck_collapsed', collapsed ? 'true' : 'false');
    } catch {}
  };

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

  btnMobilePresets?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDeckCollapsed();
  });

  btnToolbarPresets?.addEventListener('click', (e) => {
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
    saveLineSnippet(activeLineIndex);
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
      const targetWidth = engine === 'bedrock' ? BEDROCK_BOOK_TEXT_WIDTH : BOOK_TEXT_WIDTH;
      const normalized = normalizeBook(parsed, { maxWidth: targetWidth });
      pushUndoSnapshot('Import Book', 'preset');
      book = normalized;
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
    // When opening glyph library window, avoid loading all symbols (>100k)
    if (activeGlyphCat === 'all') {
      activeGlyphCat = 'symbols';
      glyphTabs.querySelectorAll<HTMLButtonElement>('.glyph-tab').forEach((t) => {
        t.classList.toggle('active', t.dataset.cat === 'symbols');
      });
    }
    currentGlyphPage = 1;
    renderGlyphs();
    glyphDialog.showModal();
  });

  const glyphPagePrev = document.getElementById('glyph-page-prev') as HTMLButtonElement | null;
  const glyphPageNext = document.getElementById('glyph-page-next') as HTMLButtonElement | null;

  glyphPagePrev?.addEventListener('click', () => {
    if (currentGlyphPage > 1) {
      currentGlyphPage--;
      renderGlyphs();
      glyphGrid.scrollTop = 0;
    }
  });

  glyphPageNext?.addEventListener('click', () => {
    currentGlyphPage++;
    renderGlyphs();
    glyphGrid.scrollTop = 0;
  });

  glyphSearch.addEventListener('input', () => {
    currentGlyphPage = 1;
    renderGlyphs();
  });

  glyphTabs.querySelectorAll<HTMLButtonElement>('.glyph-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      glyphTabs.querySelectorAll('.glyph-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeGlyphCat = tab.dataset.cat as GlyphCategory;
      currentGlyphPage = 1;
      renderGlyphs();
      glyphGrid.scrollTop = 0;
    });
  });

  // Pixel Width Filter
  glyphWidthFilter?.addEventListener('change', () => {
    selectedGlyphWidth = glyphWidthFilter?.value || 'all';
    currentGlyphPage = 1;
    renderGlyphs();
  });

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
      if (btnPreviewCopyPage) triggerCopyPageFeedback('raw', btnPreviewCopyPage);
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
