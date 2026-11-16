import {
  BOOK_TEXT_WIDTH,
  LINES_PER_PAGE,
  BLOCKGAME_COLORS,
  splitTextToLines,
  paginateLines,
  type BlockgameBook,
  type FormattedSpan,
  type LineLayout,
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

/**
 * Reconstructs a Minecraft-formatted string (using §-codes) from an array of spans.
 * - Carries active styles (e.g. §c§l) cleanly across wrapped segments.
 * - Avoids prepending §0 on unformatted plain text.
 */
export function spansToMinecraftText(spans: FormattedSpan[]): string {
  if (!spans || spans.length === 0) return '';
  let out = '';
  const currentStyle = {
    color: '#000000',
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false,
  };

  for (const span of spans) {
    if (!span.text) continue;
    let codePrefix = '';
    const spanColor = (span.color || '#000000').toLowerCase();
    const currColor = (currentStyle.color || '#000000').toLowerCase();

    // Color code check
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
 * 2. Carries style codes to wrapped lines.
 * 3. Chunks pages into <= maxLinesPerPage (default 14).
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

  // Use Minecraft Java line breaker
  const wrappedLines: LineLayout[] = splitTextToLines(pageText, maxWidth);
  const paginatedPages = paginateLines(wrappedLines, maxLinesPerPage);

  return paginatedPages.map((pageLines) => {
    return pageLines.map((l) => spansToMinecraftText(l.spans)).join('\n');
  });
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
