import {
  BOOK_TEXT_WIDTH,
  LINES_PER_PAGE,
  BLOCKGAME_COLORS,
  splitTextToLines,
  type BlockgameBook,
  type FormattedSpan,
} from 'blockgame-book-viewer';

export interface NormalizationOptions {
  maxWidth?: number;
  maxLinesPerPage?: number;
}

// Inverted lookup map: Hex color -> Minecraft color code ('0'-'f', etc.)
const HEX_TO_CODE: Record<string, string> = {};
for (const [code, hex] of Object.entries(BLOCKGAME_COLORS)) {
  HEX_TO_CODE[hex.toLowerCase()] = code;
}

export interface FormattedSpanStyle {
  color: string;
  bold: boolean;
  italic: boolean;
  underlined: boolean;
  strikethrough: boolean;
  obfuscated: boolean;
}

/**
 * Reconstructs a Minecraft-formatted string (using §-codes) from an array of spans.
 * - Carries active styles (e.g. §c§l) cleanly across wrapped segments.
 * - Emits §r when styles are cleared (e.g. turning bold or italics off).
 * - Avoids prepending §0 on unformatted plain text.
 */
export function spansToMinecraftText(
  spans: FormattedSpan[],
  currentStyle: FormattedSpanStyle = {
    color: '#000000',
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false,
  }
): string {
  if (!spans || spans.length === 0) return '';
  let out = '';

  for (const span of spans) {
    if (!span.text) continue;
    let codePrefix = '';
    const spanColor = (span.color || '#000000').toLowerCase();

    // Check if any active style needs to be turned off
    const needsStyleReset =
      (currentStyle.bold && !span.bold) ||
      (currentStyle.italic && !span.italic) ||
      (currentStyle.underlined && !span.underlined) ||
      (currentStyle.strikethrough && !span.strikethrough) ||
      (currentStyle.obfuscated && !span.obfuscated);

    if (needsStyleReset) {
      codePrefix += '§r';
      currentStyle.color = '#000000';
      currentStyle.bold = false;
      currentStyle.italic = false;
      currentStyle.underlined = false;
      currentStyle.strikethrough = false;
      currentStyle.obfuscated = false;
    }

    // Color code check
    const currColor = (currentStyle.color || '#000000').toLowerCase();
    if (spanColor !== currColor) {
      const code = HEX_TO_CODE[spanColor];
      if (code !== undefined) {
        // Minecraft color codes reset formatting styles
        codePrefix += `§${code}`;
        currentStyle.color = span.color;
        currentStyle.bold = false;
        currentStyle.italic = false;
        currentStyle.underlined = false;
        currentStyle.strikethrough = false;
        currentStyle.obfuscated = false;
      }
    }

    // Formatting style codes
    if (span.bold && !currentStyle.bold) {
      codePrefix += '§l';
      currentStyle.bold = true;
    }
    if (span.italic && !currentStyle.italic) {
      codePrefix += '§o';
      currentStyle.italic = true;
    }
    if (span.underlined && !currentStyle.underlined) {
      codePrefix += '§n';
      currentStyle.underlined = true;
    }
    if (span.strikethrough && !currentStyle.strikethrough) {
      codePrefix += '§m';
      currentStyle.strikethrough = true;
    }
    if (span.obfuscated && !currentStyle.obfuscated) {
      codePrefix += '§k';
      currentStyle.obfuscated = true;
    }

    out += codePrefix + span.text;
  }

  return out;
}

/**
 * Normalizes a single page text string into an array of page strings:
 * 1. Wraps lines exceeding maxWidth at word/whitespace boundaries using Minecraft metrics.
 * 2. Carries style codes to wrapped lines within paragraphs.
 * 3. Preserves trailing style resets (§r) so subsequent paragraphs do not inherit bold or colors.
 * 4. Chunks pages into <= maxLinesPerPage (default 14).
 */
export function normalizePageText(
  pageText: string,
  options: NormalizationOptions = {}
): string[] {
  const maxWidth = options.maxWidth ?? BOOK_TEXT_WIDTH;
  const maxLinesPerPage = options.maxLinesPerPage ?? LINES_PER_PAGE;

  if (!pageText || !pageText.trim()) {
    return [''];
  }

  const rawParagraphs = pageText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const allNormalizedLines: string[] = [];

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const p = rawParagraphs[pIdx];
    if (p.length === 0) {
      allNormalizedLines.push('');
      continue;
    }

    const endsWithReset = p.trimEnd().endsWith('§r');
    const wrapped = splitTextToLines(p, maxWidth);

    for (let wIdx = 0; wIdx < wrapped.length; wIdx++) {
      const isLastInParagraph = wIdx === wrapped.length - 1;
      let lineStr = spansToMinecraftText(wrapped[wIdx].spans);
      if (isLastInParagraph && endsWithReset && !lineStr.endsWith('§r')) {
        lineStr += '§r';
      }
      allNormalizedLines.push(lineStr);
    }
  }

  // Chunk lines into pages of <= maxLinesPerPage
  const pages: string[] = [];
  for (let i = 0; i < allNormalizedLines.length; i += maxLinesPerPage) {
    const pageLines = allNormalizedLines.slice(i, i + maxLinesPerPage);
    pages.push(pageLines.join('\n'));
  }

  return pages.length > 0 ? pages : [''];
}

/**
 * Normalizes an entire book:
 * Every page is normalized so that:
 * - Every line is strictly <= maxWidth (default 114px)
 * - Every page has at most 14 lines
 * - Page overflows cleanly cascade to new pages without text truncation
 */
export function normalizeBook(
  book: BlockgameBook,
  options: NormalizationOptions = {}
): BlockgameBook {
  const maxWidth = options.maxWidth ?? BOOK_TEXT_WIDTH;
  const maxLinesPerPage = options.maxLinesPerPage ?? LINES_PER_PAGE;

  const normalizedPages: string[] = [];

  for (const page of book.pages) {
    const pagesForThisInput = normalizePageText(page, { maxWidth, maxLinesPerPage });
    normalizedPages.push(...pagesForThisInput);
  }

  return {
    title: book.title,
    author: book.author,
    pages: normalizedPages.length > 0 ? normalizedPages : [''],
  };
}
