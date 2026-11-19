import { describe, expect, test } from 'bun:test';
import {
  normalizePageText,
  normalizeBook,
  spansToMinecraftText,
} from '../src/utils/bookNormalization';
import {
  measureLineWidth,
  parseFormattedText,
  BOOK_TEXT_WIDTH,
  BEDROCK_BOOK_TEXT_WIDTH,
  type BlockgameBook,
} from 'blockgame-book-viewer';

describe('Book Normalizer & Import Converter', () => {
  test('normalizes the 280px line from the starter book into separate lines <= 114px', () => {
    const rawStarterPage = '§6§lWelcome to the Book!§r\n\nEdit this page using the toolbar or type §-codes directly.';
    const pages = normalizePageText(rawStarterPage, { maxWidth: BOOK_TEXT_WIDTH });

    expect(pages.length).toBe(1);
    const lines = pages[0].split('\n');

    // Should break into exactly 6 lines
    expect(lines.length).toBe(6);

    // Every line must strictly measure <= 114px
    for (const line of lines) {
      if (line) {
        const width = measureLineWidth(parseFormattedText(line));
        expect(width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
      }
    }

    // Verify first line has gold & bold
    expect(lines[0]).toBe('§6§lWelcome to the');
    // Verify second line retained gold & bold and ends with reset §r so subsequent lines stay unbold
    expect(lines[1]).toBe('§6§lBook!§r');
    // Verify third line is empty gap
    expect(lines[2]).toBe('');
    // Verify continuation lines
    expect(lines[3]).toBe('Edit this page using');
    expect(lines[4]).toBe('the toolbar or type');
    expect(lines[5]).toBe('codes directly.');
  });

  test('plain text wrapping does not inject redundant §0 prefixes', () => {
    const plainText = 'The quick brown fox jumps over the lazy dog and runs through the forest near the mountains.';
    const pages = normalizePageText(plainText, { maxWidth: BOOK_TEXT_WIDTH });

    expect(pages.length).toBe(1);
    const lines = pages[0].split('\n');

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.startsWith('§0')).toBe(false);
      const width = measureLineWidth(parseFormattedText(line));
      expect(width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    }
  });

  test('styling codes carry cleanly to wrapped continuation lines', () => {
    const styledText = '§c§lThis is a very long red bold warning banner that must wrap across multiple lines in the book.';
    const pages = normalizePageText(styledText, { maxWidth: BOOK_TEXT_WIDTH });

    expect(pages.length).toBe(1);
    const lines = pages[0].split('\n');
    expect(lines.length).toBeGreaterThan(1);

    for (const line of lines) {
      expect(line.startsWith('§c§l')).toBe(true);
      const width = measureLineWidth(parseFormattedText(line));
      expect(width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    }
  });

  test('cascades into multiple 14-line pages when wrapped lines exceed 14', () => {
    // 25 short lines of text (each <= 114px)
    const longText = Array(25).fill('Line of text').join('\n');
    const pages = normalizePageText(longText, { maxWidth: BOOK_TEXT_WIDTH, maxLinesPerPage: 14 });

    expect(pages.length).toBe(2);
    const page1Lines = pages[0].split('\n');
    const page2Lines = pages[1].split('\n');

    expect(page1Lines.length).toBe(14);
    expect(page2Lines.length).toBe(11);
  });

  test('normalizeBook normalizes multi-page books and updates pages array', () => {
    const inputBook: BlockgameBook = {
      title: 'Imported Guide',
      author: 'Steve',
      pages: [
        '§6§lWelcome to the Book!§r\n\nEdit this page using the toolbar or type §-codes directly.',
        'Short page 2',
      ],
    };

    const normalized = normalizeBook(inputBook, { maxWidth: BOOK_TEXT_WIDTH });
    expect(normalized.title).toBe('Imported Guide');
    expect(normalized.author).toBe('Steve');
    expect(normalized.pages.length).toBe(2);

    const p1Lines = normalized.pages[0].split('\n');
    expect(p1Lines.length).toBe(6);
    for (const l of p1Lines) {
      if (l) {
        expect(measureLineWidth(parseFormattedText(l))).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
      }
    }
  });

  test('supports Bedrock width normalization (122px)', () => {
    const text = 'Edit this page using the toolbar or type §-codes directly.';
    const pages = normalizePageText(text, { maxWidth: BEDROCK_BOOK_TEXT_WIDTH });
    const lines = pages[0].split('\n');

    for (const line of lines) {
      if (line) {
        const width = measureLineWidth(parseFormattedText(line));
        expect(width).toBeLessThanOrEqual(BEDROCK_BOOK_TEXT_WIDTH);
      }
    }
  });
});
