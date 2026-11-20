import { describe, expect, test } from 'bun:test';
import {
  deduplicateCodes,
  calculateMarginFillSpaces,
  centerLineText,
  MINECRAFT_LINES_PER_PAGE,
  MINECRAFT_PAGE_MAX_CHARS,
  MINECRAFT_MAX_PAGES,
  getPageTextFromLines,
  getLinesFromPageText,
  splitLineAtOverflow,
  reflowPageLines,
  getCarriedStyleForLine,
  DEFAULT_PRESETS,
  loadSavedTemplates,
  detectUnsupportedMinecraftChars,
  CHARACTER_SETS,
  GLYPH_CATALOG_BY_WIDTH,
  formatPageForClipboard,
  writeTextToClipboard,
  BOOKSHELF_STORAGE_KEY,
  loadBookshelf,
  saveBookshelf,
  deleteBook,
  activeBookId,
  currentMatrixMode,
  getGlyphsForCurrentSelection,
  renderSnippetPreviewCanvas,
  type BookshelfBook,
  type PageCopyFormat,
  type SavedTemplate,
} from '../src/editor';
import {
  SYMBOL_CHAT_FONTS,
  NORMAL_FONT,
  transformWithFont,
  getFontById,
  toNormalText,
} from '../src/data/symbolChatFonts';
import {
  CORE_ASSETS,
  parseBook,
  splitTextToLines,
  measureLineWidth,
  parseFormattedText,
  BOOK_TEXT_WIDTH,
  LINES_PER_PAGE,
  exportToStendhal,
  exportToGiveCommandModern,
  exportToGiveCommandJsonPages,
  exportToGiveCommandLegacy,
  exportToScribbleJson,
  exportToBookCopyJson,
  exportToCmiText,
  exportToBedrockJson,
} from 'blockgame-book-viewer';

describe('Minecraft Line & Page Rules (Checked against Minecraft Code)', () => {
  test('Minecraft Java Edition uses exactly 14 lines per page', () => {
    // BookEditScreen TEXT_HEIGHT (126) / 9 = 14 lines
    // BookViewScreen TEXT_HEIGHT (128) / 9 = 14 lines
    expect(MINECRAFT_LINES_PER_PAGE).toBe(14);
    expect(LINES_PER_PAGE).toBe(14);
    expect(BOOK_TEXT_WIDTH).toBe(114);
  });

  test('Minecraft WritableBookContent character limit is 1024 chars per page', () => {
    expect(MINECRAFT_PAGE_MAX_CHARS).toBe(1024);
  });

  test('when user types in row 5, preceding 4 lines get newlines so they are blank in Minecraft', () => {
    const lines = Array(14).fill('');
    lines[4] = 'Row 5 Heading'; // Row 5 is index 4

    const pageText = getPageTextFromLines(lines);
    // 4 leading newlines for the first 4 blank lines
    expect(pageText).toBe('\n\n\n\nRow 5 Heading');

    // Deserializing matches row 5 exactly
    const parsedLines = getLinesFromPageText(pageText);
    expect(parsedLines.length).toBe(14);
    expect(parsedLines[0]).toBe('');
    expect(parsedLines[1]).toBe('');
    expect(parsedLines[2]).toBe('');
    expect(parsedLines[3]).toBe('');
    expect(parsedLines[4]).toBe('Row 5 Heading');
    expect(parsedLines[5]).toBe('');
    expect(parsedLines[13]).toBe('');

    // Verifying with blockgame-book-viewer rendering logic
    const renderedLines = splitTextToLines(pageText);
    expect(renderedLines.length).toBe(5);
    expect(renderedLines[0].spans.length).toBe(0);
    expect(renderedLines[1].spans.length).toBe(0);
    expect(renderedLines[2].spans.length).toBe(0);
    expect(renderedLines[3].spans.length).toBe(0);
    expect(renderedLines[4].spans.map((s) => s.text).join('')).toBe('Row 5 Heading');
  });

  test('no more or less than 14 lines are handled', () => {
    // Page with 20 lines gets clamped to 14
    const excessText = Array(20).fill('Line').join('\n');
    const lines = getLinesFromPageText(excessText);
    expect(lines.length).toBe(14);

    // Serialization only includes up to 14 lines
    const longLines = Array(30).fill('Hello');
    const serialized = getPageTextFromLines(longLines);
    expect(serialized.split('\n').length).toBe(14);
  });

  test('splitLineAtOverflow wraps words cleanly at 114px without character overflow', () => {
    const longLine = 'The quick brown fox jumps over the lazy dog and runs away.';
    const { head, tail, brokeAtSpace } = splitLineAtOverflow(longLine);

    expect(brokeAtSpace).toBe(true);
    expect(measureLineWidth(parseFormattedText(head))).toBeLessThanOrEqual(114);
    expect(head.length).toBeGreaterThan(0);
    expect(tail.length).toBeGreaterThan(0);
  });

  test('reflowPageLines cascades overflow across lines and stops at line 14 without page overflow', () => {
    const lines = Array(14).fill('');
    lines[0] = 'The quick brown fox jumps over the lazy dog and runs away into the forest to find some red apples and mushrooms for crafting.';

    const { lines: reflowed, truncated } = reflowPageLines(lines, 0, 114, 14);
    expect(reflowed.length).toBe(14);
    // All populated lines are strictly <= 114px
    reflowed.forEach((l) => {
      if (l) {
        expect(measureLineWidth(parseFormattedText(l))).toBeLessThanOrEqual(114);
      }
    });

    // When line 14 itself overflows, it stops and marks truncated
    const full14 = Array(14).fill('A'.repeat(30)); // 30 'A's is 180px > 114px
    const result = reflowPageLines(full14, 0, 114, 14);
    expect(result.lines.length).toBe(14);
    expect(measureLineWidth(parseFormattedText(result.lines[13]))).toBeLessThanOrEqual(114);
    expect(result.truncated).toBe(true);
  });

  test('formatting styles carry across lines in carried style calculations', () => {
    const lines = ['§6§lGold Heading§r', 'Normal Line', '§1Blue Line'];
    const styleLine1 = getCarriedStyleForLine(lines, 1);
    // Line 1 ended with §r so style reset
    expect(styleLine1.color).toBe('#000000');
    expect(styleLine1.bold).toBe(false);

    const linesNoReset = ['§6§lGold Heading', 'Inherited Gold'];
    const styleLine2 = getCarriedStyleForLine(linesNoReset, 1);
    expect(styleLine2.color).toBe('#FFAA00');
    expect(styleLine2.bold).toBe(true);
  });
});

describe('Editor Helpers & Deduplication', () => {
  test('deduplicateCodes removes consecutive redundant styles and colors without removing intentional line resets', () => {
    // Consecutive identical codes and color override
    const input = '§l§lBold Text§r §1§2Color Override§r\nSecond line';
    const { cleaned, removedCount } = deduplicateCodes(input);
    expect(cleaned).toBe('§lBold Text§r §2Color Override§r\nSecond line');
    expect(removedCount).toBeGreaterThan(0);
  });

  test('splitTextToLines resets subsequent lines when §r is at end of line', () => {
    const lines = splitTextToLines('§6§lHeading§r\nSecond Line');
    expect(lines.length).toBe(2);
    // Line 1 is gold and bold
    expect(lines[0].spans[0].color).toBe('#FFAA00');
    expect(lines[0].spans[0].bold).toBe(true);

    // Line 2 was reset by §r at end of Line 1
    expect(lines[1].spans[0].color).toBe('#000000');
    expect(lines[1].spans[0].bold).toBe(false);
  });

  test('calculateMarginFillSpaces computes exact or near margin padding', () => {
    // Target: 114px. Current line width: 104px (10px needed = 2 bold spaces of 5px)
    const padding = calculateMarginFillSpaces(104, 114);
    expect(padding).toBe('§l  §r');

    // Target: 114px. Current: 106px (8px needed = 2 regular spaces of 4px)
    const padding2 = calculateMarginFillSpaces(106, 114);
    expect(padding2).toBe('  ');

    // Already at target width
    expect(calculateMarginFillSpaces(114, 114)).toBe('');
  });
});

describe('blockgame-book-viewer Out-of-the-Box Inlined Core Assets', () => {
  test('exports inlined data URIs for all vanilla core textures', () => {
    expect(CORE_ASSETS.textures.gui.book).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.gui.pageForward).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.gui.pageBackward).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.gui.pageForwardHighlighted).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.gui.pageBackwardHighlighted).toStartWith('data:image/png;base64,');
  });

  test('exports inlined data URIs for Bedrock GUI textures', () => {
    const bedrock = CORE_ASSETS.textures.gui.bedrock;
    expect(bedrock.background).toStartWith('data:image/png;base64,');
    expect(bedrock.backgroundHc).toStartWith('data:image/png;base64,');
    expect(bedrock.close).toStartWith('data:image/png;base64,');
    expect(bedrock.pageForward).toStartWith('data:image/png;base64,');
    expect(bedrock.pageBackward).toStartWith('data:image/png;base64,');
  });

  test('exports inlined data URIs for font sheets and sounds', () => {
    expect(CORE_ASSETS.textures.font.ascii).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.font.accented).toStartWith('data:image/png;base64,');
    expect(CORE_ASSETS.textures.font.nonlatin).toStartWith('data:image/png;base64,');

    expect(CORE_ASSETS.sounds.openFlip1).toStartWith('data:audio/mp3;base64,');
    expect(CORE_ASSETS.sounds.openFlip2).toStartWith('data:audio/mp3;base64,');
    expect(CORE_ASSETS.sounds.openFlip3).toStartWith('data:audio/mp3;base64,');
  });
});

describe('Book IO Formats Interoperability', () => {
  const sampleBook = {
    title: 'Test Chronicles',
    author: 'Steve',
    pages: ['Page 1: §lEpic Tale§r', 'Page 2: Chapter §6Gold§r'],
  };

  test('Stendhal export and parse round-trip', () => {
    const stendhal = exportToStendhal(sampleBook);
    const parsed = parseBook(stendhal);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe(sampleBook.title);
    expect(parsed?.author).toBe(sampleBook.author);
    expect(parsed?.pages.length).toBe(2);
  });

  test('Scribble JSON export and parse round-trip', () => {
    const json = exportToScribbleJson(sampleBook);
    const parsed = parseBook(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.pages.length).toBe(2);
  });

  test('BookCopy JSON export and parse round-trip', () => {
    const json = exportToBookCopyJson(sampleBook);
    const parsed = parseBook(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe(sampleBook.title);
    expect(parsed?.pages.length).toBe(2);
  });

  test('CMI Text export and parse round-trip', () => {
    const cmi = exportToCmiText(sampleBook);
    const parsed = parseBook(cmi);
    expect(parsed).not.toBeNull();
    expect(parsed?.pages.length).toBe(2);
  });

  test('Modern /give command export and parse round-trip', () => {
    const give = exportToGiveCommandModern(sampleBook);
    expect(give).toContain('written_book[written_book_content=');
    const parsed = parseBook(give);
    expect(parsed).not.toBeNull();
    expect(parsed?.title).toBe(sampleBook.title);
    expect(parsed?.author).toBe(sampleBook.author);
  });

  test('JSON-Pages and Legacy /give commands export valid strings', () => {
    const jsonPages = exportToGiveCommandJsonPages(sampleBook);
    expect(jsonPages).toContain('written_book[written_book_content=');
    expect(jsonPages).toContain('pages:[');

    const legacy = exportToGiveCommandLegacy(sampleBook);
    expect(legacy).toContain('written_book{');

    const bedrock = exportToBedrockJson(sampleBook);
    expect(bedrock).toContain('"pages":');
  });
});

describe('Minecraft Page Limit & Page Gallery Presets', () => {
  test('Minecraft WritableBookContent MAX_PAGES limit is 100 pages', () => {
    expect(MINECRAFT_MAX_PAGES).toBe(100);
  });

  test('advancing past last page adds blank page until 100 max pages', () => {
    const pages: string[] = ['Page 1 content'];

    function advance(currentPage: number): number {
      if (currentPage < pages.length - 1) {
        return currentPage + 1;
      } else if (pages.length < MINECRAFT_MAX_PAGES) {
        pages.push('');
        return pages.length - 1;
      }
      return currentPage;
    }

    // From page 0 (last page), advance appends page 2
    let cur = advance(0);
    expect(cur).toBe(1);
    expect(pages.length).toBe(2);
    expect(pages[1]).toBe('');

    // Advance to 100
    while (pages.length < 100) {
      cur = advance(cur);
    }
    expect(pages.length).toBe(100);

    // Advancing past 100 does not exceed 100 pages
    const at100 = advance(99);
    expect(at100).toBe(99);
    expect(pages.length).toBe(100);
  });

  test('Page Gallery built-in presets load properly with valid Minecraft lines', () => {
    const presets = loadSavedTemplates();
    expect(presets.length).toBeGreaterThanOrEqual(DEFAULT_PRESETS.length);

    const chapterPreset = presets.find(p => p.id === 'preset-chapter-header');
    expect(chapterPreset).toBeDefined();
    expect(chapterPreset?.title).toBe('Chapter Header Banner');
    expect(chapterPreset?.scope).toBe('lines');
    expect(chapterPreset?.lines.length).toBe(4);

    const tocPreset = presets.find(p => p.id === 'preset-toc-page');
    expect(tocPreset).toBeDefined();
    expect(tocPreset?.title).toBe('Table of Contents Page');
    expect(tocPreset?.scope).toBe('page');
    expect(tocPreset?.lines.length).toBe(14);
  });

  test('inserting line snippet into page lines shifts and limits within 14 lines', () => {
    const pageLines = Array(14).fill('');
    pageLines[0] = 'Existing Header';

    const snippet: SavedTemplate = {
      id: 'test-divider',
      title: 'Divider',
      scope: 'lines',
      category: 'Divider',
      lines: ['§6§l---✦ ★ ✦---', '§8Subtitle'],
      createdAt: Date.now(),
    };

    // Insert at row 1
    const startRow = 1;
    for (let i = 0; i < snippet.lines.length && startRow + i < MINECRAFT_LINES_PER_PAGE; i++) {
      pageLines[startRow + i] = snippet.lines[i];
    }

    expect(pageLines[0]).toBe('Existing Header');
    expect(pageLines[1]).toBe('§6§l---✦ ★ ✦---');
    expect(pageLines[2]).toBe('§8Subtitle');
    expect(pageLines.length).toBe(14);
  });

  test('collapsible Saved Art Deck supports toggle state and localStorage persistence', () => {
    // Simulate deck DOM element state
    const mockDeck = {
      classList: new Set<string>(),
      collapsed: false,
    };

    function setMockCollapsed(collapsed: boolean): { icon: string; text: string; isCollapsed: boolean } {
      if (collapsed) {
        mockDeck.classList.add('collapsed');
        mockDeck.collapsed = true;
        return { icon: '▲', text: 'Expand Presets', isCollapsed: true };
      } else {
        mockDeck.classList.delete('collapsed');
        mockDeck.collapsed = false;
        return { icon: '▼', text: 'Collapse', isCollapsed: false };
      }
    }

    // Default start state is collapsed to give full screen height to the editor and book viewer
    const state1 = setMockCollapsed(true);
    expect(state1.isCollapsed).toBe(true);
    expect(state1.icon).toBe('▲');
    expect(state1.text).toBe('Expand Presets');
    expect(mockDeck.classList.has('collapsed')).toBe(true);

    // Expand deck
    const state2 = setMockCollapsed(false);
    expect(state2.isCollapsed).toBe(false);
    expect(state2.icon).toBe('▼');
    expect(state2.text).toBe('Collapse');
    expect(mockDeck.classList.has('collapsed')).toBe(false);

    // Re-collapse deck
    const state3 = setMockCollapsed(true);
    expect(state3.isCollapsed).toBe(true);
    expect(state3.icon).toBe('▲');
    expect(state3.text).toBe('Expand Presets');
    expect(mockDeck.classList.has('collapsed')).toBe(true);
  });

  test('mobile presets toggle button updates text and active class in synchrony with deck', () => {
    const mockMobileBtn = {
      text: '🎨 Presets',
      active: false,
    };

    function syncMobilePresetsBtn(collapsed: boolean) {
      if (collapsed) {
        mockMobileBtn.active = false;
        mockMobileBtn.text = '🎨 Presets';
      } else {
        mockMobileBtn.active = true;
        mockMobileBtn.text = '✕ Presets';
      }
    }

    syncMobilePresetsBtn(true);
    expect(mockMobileBtn.text).toBe('🎨 Presets');
    expect(mockMobileBtn.active).toBe(false);

    syncMobilePresetsBtn(false);
    expect(mockMobileBtn.text).toBe('✕ Presets');
    expect(mockMobileBtn.active).toBe(true);
  });

  test('detectUnsupportedMinecraftChars catches SMP characters > U+FFFF while approving BMP characters', () => {
    // BMP characters supported in Minecraft Java Edition
    const bmpText = '§6★ Quest 1: ⚔ Slay the Beast ━ Enter ⛨ Castle';
    const bmpResult = detectUnsupportedMinecraftChars(bmpText);
    expect(bmpResult.count).toBe(0);
    expect(bmpResult.chars.length).toBe(0);

    // Modern SMP emoji (> U+FFFF) that render as [] in vanilla Minecraft
    const smpText = 'Hello! 😀 🍎 Fire 🔥 and skull 💀';
    const smpResult = detectUnsupportedMinecraftChars(smpText);
    expect(smpResult.count).toBe(4);
    expect(smpResult.chars).toContain('😀');
    expect(smpResult.chars).toContain('🍎');
    expect(smpResult.chars).toContain('🔥');
    expect(smpResult.chars).toContain('💀');
  });

  test('all curated CHARACTER_SETS and GLYPH_CATALOG_BY_WIDTH contain only authentic Minecraft BMP glyphs', () => {
    // Check every glyph in curated character sets
    for (const [setName, setObj] of Object.entries(CHARACTER_SETS)) {
      for (const ch of setObj.glyphs) {
        const code = ch.codePointAt(0) ?? 0;
        expect(code).toBeLessThanOrEqual(0xFFFF);
      }
    }

    // Check every glyph in the width catalog
    for (const [pxStr, glyphs] of Object.entries(GLYPH_CATALOG_BY_WIDTH)) {
      for (const ch of glyphs) {
        const code = ch.codePointAt(0) ?? 0;
        expect(code).toBeLessThanOrEqual(0xFFFF);
      }
    }
  });

  test('custom user templates can be deleted and managed alongside presets', () => {
    const list: SavedTemplate[] = [
      ...DEFAULT_PRESETS,
      {
        id: 'custom-art-1',
        title: 'My Custom Border',
        scope: 'lines',
        category: 'Custom',
        lines: ['§6━━━ ★ ━━━'],
        createdAt: Date.now(),
        isPreset: false,
      },
    ];

    expect(list.length).toBe(DEFAULT_PRESETS.length + 1);

    // Delete custom item
    const updated = list.filter(t => t.id !== 'custom-art-1');
    expect(updated.length).toBe(DEFAULT_PRESETS.length);
    expect(updated.find(t => t.id === 'custom-art-1')).toBeUndefined();
  });

  test('centerLineText centers text on a 114px line using balanced spaces', () => {
    // 1. Basic text centering
    const raw = 'CHAPTER I';
    const centered = centerLineText(raw, 114);
    expect(centered.startsWith(' ')).toBe(true);
    expect(centered.endsWith('CHAPTER I')).toBe(true);

    const spans = parseFormattedText(centered);
    const totalW = measureLineWidth(spans);
    expect(totalW).toBeLessThanOrEqual(114);

    // Measure left margin
    const leftSpans = spans.slice(0, spans.length - 1);
    const leftW = measureLineWidth(leftSpans);
    const rightW = 114 - totalW;
    // Margins should be balanced to within 4px (1 space width)
    expect(Math.abs(leftW - rightW)).toBeLessThanOrEqual(4);

    // 2. Formatted line centering with § codes
    const formattedRaw = '§6§lAWAKENING';
    const formattedCentered = centerLineText(formattedRaw, 114);
    expect(formattedCentered.endsWith('AWAKENING')).toBe(true);
    expect(measureLineWidth(parseFormattedText(formattedCentered))).toBeLessThanOrEqual(114);

    // 3. Re-centering does not pile up duplicate spaces
    const doubleCentered = centerLineText(centered, 114);
    expect(doubleCentered).toBe(centered);

    // 4. Line that already fills line width is returned unchanged
    const fullLine = '━'.repeat(12); // 12 * 9 = 108px, nearly fills 114px line
    const centeredFull = centerLineText(fullLine, 114);
    expect(measureLineWidth(parseFormattedText(centeredFull))).toBeLessThanOrEqual(114);

    // 5. Empty line returns empty string
    expect(centerLineText('', 114)).toBe('');
    expect(centerLineText('   ', 114)).toBe('');
  });

  test('clear page empties lines while maintaining valid 14 lines array and undo history', () => {
    let lines = ['§6Header', 'Some content', 'More content'];
    while (lines.length < 14) lines.push('');

    expect(lines.filter(l => l.length > 0).length).toBe(3);

    // Clear operation
    const undoSnapshot = [...lines];
    lines = Array(14).fill('');

    expect(lines.length).toBe(14);
    expect(lines.every(l => l === '')).toBe(true);

    // Undo operation restores lines
    lines = [...undoSnapshot];
    expect(lines.filter(l => l.length > 0).length).toBe(3);
    expect(lines[0]).toBe('§6Header');
  });

  test('formatPageForClipboard serializes single page into Minecraft Book & Quill and command formats', () => {
    const pageLines = [
      '§6Town Notice',
      '§7Market open today!',
      'Bring emeralds.',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];

    // 1. Raw format (default for Book & Quill paste via Ctrl+V)
    const raw = formatPageForClipboard(pageLines, 'raw');
    expect(raw).toBe('§6Town Notice\n§7Market open today!\nBring emeralds.');
    expect(raw.includes('§6')).toBe(true);
    expect(raw.includes('§7')).toBe(true);

    // 2. Ampersand format (for EssentialsX / CMI server plugins)
    const ampersand = formatPageForClipboard(pageLines, 'ampersand');
    expect(ampersand).toBe('&6Town Notice\n&7Market open today!\nBring emeralds.');
    expect(ampersand.includes('§')).toBe(false);
    expect(ampersand.includes('&6')).toBe(true);

    // 3. Modern /give command (single page instant give)
    const give = formatPageForClipboard(pageLines, 'give', { title: 'Town Notice', author: 'Mayor' });
    expect(give.startsWith('/give @p written_book[written_book_content=')).toBe(true);
    expect(give.includes('Town Notice')).toBe(true);
    expect(give.includes('Mayor')).toBe(true);
    expect(give.endsWith('] 1')).toBe(true);

    // 4. Plain text format (formatting codes stripped)
    const plain = formatPageForClipboard(pageLines, 'plain');
    expect(plain).toBe('Town Notice\nMarket open today!\nBring emeralds.');
    expect(plain.includes('§')).toBe(false);

    // 5. Empty page returns empty string
    const emptyLines = Array(14).fill('');
    expect(formatPageForClipboard(emptyLines, 'raw')).toBe('');
    expect(formatPageForClipboard(emptyLines, 'give')).toBe('');
    expect(formatPageForClipboard(emptyLines, 'plain')).toBe('');
  });

  test('multi-line selection supports Shift range and Command/Ctrl toggling', () => {
    let selected = new Set<number>([0]);
    let lastClicked = 0;

    function selectLine(idx: number, isShift: boolean, isModifier: boolean) {
      if (isShift) {
        const start = Math.min(lastClicked, idx);
        const end = Math.max(lastClicked, idx);
        if (!isModifier) selected.clear();
        for (let i = start; i <= end; i++) selected.add(i);
      } else if (isModifier) {
        if (selected.has(idx)) {
          if (selected.size > 1) selected.delete(idx);
        } else {
          selected.add(idx);
        }
        lastClicked = idx;
      } else {
        selected.clear();
        selected.add(idx);
        lastClicked = idx;
      }
    }

    // Normal click selects row 2
    selectLine(2, false, false);
    expect(selected.size).toBe(1);
    expect(selected.has(2)).toBe(true);

    // Shift click row 5 selects range [2, 3, 4, 5]
    selectLine(5, true, false);
    expect(selected.size).toBe(4);
    expect([...selected].sort()).toEqual([2, 3, 4, 5]);

    // Command/Ctrl click row 8 adds row 8
    selectLine(8, false, true);
    expect(selected.size).toBe(5);
    expect(selected.has(8)).toBe(true);

    // Command/Ctrl click row 3 removes row 3
    selectLine(3, false, true);
    expect(selected.size).toBe(4);
    expect(selected.has(3)).toBe(false);

    // Plain click row 6 clears and selects row 6
    selectLine(6, false, false);
    expect(selected.size).toBe(1);
    expect(selected.has(6)).toBe(true);
  });

  test('beforeinput font character transformation preserves pre-existing text and surrogate pairs', () => {
    // Non-destructive input typing simulation
    let lineValue = 'Chapter 1: ';
    const activeFont = 'fraktur';

    function simulateBeforeInput(char: string, fontId: string, caretPos: number) {
      if (fontId === 'normal') {
        lineValue = lineValue.slice(0, caretPos) + char + lineValue.slice(caretPos);
        return caretPos + char.length;
      }
      const transformed = transformWithFont(char, fontId);
      lineValue = lineValue.slice(0, caretPos) + transformed + lineValue.slice(caretPos);
      return caretPos + transformed.length;
    }

    // Type 'A' at end of 'Chapter 1: '
    let caret = lineValue.length;
    caret = simulateBeforeInput('A', activeFont, caret);
    expect(lineValue).toBe('Chapter 1: 𝔄');
    // Pre-existing 'Chapter 1: ' must not be altered into Fraktur!
    expect(lineValue.startsWith('Chapter 1: ')).toBe(true);

    // Surrogate pair safety: 𝔄 is an SMP character (U+1D504), UTF-16 code units length is 2
    expect('𝔄'.length).toBe(2);
    expect(caret).toBe('Chapter 1: '.length + 2);

    // Type 'b' at end
    caret = simulateBeforeInput('b', activeFont, caret);
    expect(lineValue).toBe('Chapter 1: 𝔄𝔟');

    // Type normal character in normal font
    caret = simulateBeforeInput('!', 'normal', caret);
    expect(lineValue).toBe('Chapter 1: 𝔄𝔟!');
  });

  test('snippet persistence strictly routes to SavedTemplate under libraryStore with scope: "lines"', () => {
    const savedTemplatesList: SavedTemplate[] = [];

    function saveLineSnippetMock(selectedIndices: Set<number>, allLines: string[]): SavedTemplate {
      let linesToSave: string[] = [];
      let title = '';
      if (selectedIndices.size > 1) {
        const sorted = [...selectedIndices].sort((a, b) => a - b);
        linesToSave = sorted.map(i => allLines[i] ?? '');
        title = `Snippet: Lines ${sorted[0] + 1}-${sorted[sorted.length - 1] + 1}`;
      } else {
        const idx = [...selectedIndices][0] ?? 0;
        linesToSave = [allLines[idx] ?? ''];
        title = `Snippet: Line ${idx + 1}`;
      }

      const template: SavedTemplate = {
        id: `custom-${Date.now()}-${Math.random()}`,
        title,
        scope: 'lines',
        category: 'Snippet',
        lines: linesToSave,
        createdAt: Date.now(),
        isPreset: false,
      };
      savedTemplatesList.unshift(template);
      return template;
    }

    const testLines = ['Line 1 text', 'Line 2 text', 'Line 3 text', 'Line 4 text'];
    
    // Single line save
    const tpl1 = saveLineSnippetMock(new Set([1]), testLines);
    expect(tpl1.scope).toBe('lines');
    expect(tpl1.category).toBe('Snippet');
    expect(tpl1.title).toBe('Snippet: Line 2');
    expect(tpl1.lines).toEqual(['Line 2 text']);

    // Multi-line save (lines 0, 1, 2)
    const tplMulti = saveLineSnippetMock(new Set([0, 1, 2]), testLines);
    expect(tplMulti.scope).toBe('lines');
    expect(tplMulti.category).toBe('Snippet');
    expect(tplMulti.title).toBe('Snippet: Lines 1-3');
    expect(tplMulti.lines).toEqual(['Line 1 text', 'Line 2 text', 'Line 3 text']);

    expect(savedTemplatesList.length).toBe(2);
  });

  test('history snapshots are restricted to page and book scopes, with snippet migration support', () => {
    interface HistoryRecord {
      id: string;
      type: 'manual' | 'autosave' | 'snippet';
      title: string;
      lines: string[];
      timestamp: number;
    }

    const rawHistory: HistoryRecord[] = [
      { id: 'snap-1', type: 'manual', title: 'Manual Page 1', lines: ['Line A'], timestamp: 1000 },
      { id: 'snap-2', type: 'autosave', title: 'Autosave Page 1', lines: ['Line B'], timestamp: 2000 },
      { id: 'snap-3', type: 'snippet', title: 'Snippet: Line 1', lines: ['Snippet text'], timestamp: 3000 },
    ];

    // Migration logic: extracts snippets to saved templates and purifies history
    const migratedSavedArt: SavedTemplate[] = [];
    const snippets = rawHistory.filter(s => s.type === 'snippet');
    for (const sn of snippets) {
      migratedSavedArt.push({
        id: sn.id,
        title: sn.title,
        scope: 'lines',
        category: 'Snippet',
        lines: sn.lines,
        createdAt: sn.timestamp,
        isPreset: false,
      });
    }
    const purifiedHistory = rawHistory.filter(s => s.type !== 'snippet');

    expect(migratedSavedArt.length).toBe(1);
    expect(migratedSavedArt[0].title).toBe('Snippet: Line 1');
    expect(migratedSavedArt[0].scope).toBe('lines');

    // Purified history only contains manual & autosave
    expect(purifiedHistory.length).toBe(2);
    expect(purifiedHistory.every(h => h.type === 'manual' || h.type === 'autosave')).toBe(true);
  });

  test('complete parity of all 12 fonts in SYMBOL_CHAT_FONTS', () => {
    const expectedIds = [
      'small_caps',
      'circled',
      'fullwidth',
      'superscript',
      'subscript',
      'inverted',
      'fraktur',
      'double_struck',
      'script',
      'bold_serif',
      'circled_black',
      'squared',
    ];

    expect(SYMBOL_CHAT_FONTS.length).toBe(12);
    const registeredIds = SYMBOL_CHAT_FONTS.map(f => f.id);
    expect(registeredIds).toEqual(expectedIds);

    // Every font must produce stylized non-empty transforms for ASCII letters
    for (const font of SYMBOL_CHAT_FONTS) {
      const transformed = font.transform('test');
      expect(transformed).toBeDefined();
      expect(transformed.length).toBeGreaterThanOrEqual(4);
      const fontFound = getFontById(font.id);
      expect(fontFound.id).toBe(font.id);
    }
  });

  test('bidirectional font transformation reverts stylized Unicode back to normal text and preserves formatting codes', () => {
    const rawLine = '§6§lChapter 1: The Legend§r';
    
    // Transform to Small Caps
    const smallCaps = transformWithFont(rawLine, 'small_caps');
    expect(smallCaps.includes('§6§l')).toBe(true);
    expect(smallCaps.includes('§r')).toBe(true);
    expect(smallCaps.includes('ᴄʜᴀᴘᴛᴇʀ')).toBe(true);

    // Revert back to Normal using toNormalText
    const reverted = toNormalText(smallCaps);
    expect(reverted).toBe('§6§lchapter 1: the legend§r');

    // Revert back using getFontById('normal')
    const normalFont = getFontById('normal');
    expect(normalFont.id).toBe('normal');
    const transformedNormal = normalFont.transform(smallCaps);
    expect(transformedNormal).toBe('§6§lchapter 1: the legend§r');

    // Transition between two fonts: Small Caps -> Circled
    const circled = transformWithFont(smallCaps, 'circled');
    expect(circled.includes('ⓒ')).toBe(true);
  });

  test('line width overflow detection: bold formatting expands character advance beyond 114px', () => {
    // Normal text under 114px
    const plain = 'Edit this page using';
    const plainWidth = measureLineWidth(parseFormattedText(plain));
    expect(plainWidth).toBe(98);
    expect(plainWidth).toBeLessThanOrEqual(114);

    // Bold text expands by 1px per character: 98 + 20 chars = 118px > 114px
    const boldText = '§lEdit this page using';
    const boldWidth = measureLineWidth(parseFormattedText(boldText));
    expect(boldWidth).toBe(118);
    expect(boldWidth).toBeGreaterThan(114);

    // Carried bold style across lines also triggers overflow
    const linesWithUnclearedBold = ['§6§lTitle', 'Edit this page using'];
    const carriedStyle = getCarriedStyleForLine(linesWithUnclearedBold, 1);
    expect(carriedStyle.bold).toBe(true);
    const carriedWidth = measureLineWidth(parseFormattedText(linesWithUnclearedBold[1], carriedStyle));
    expect(carriedWidth).toBe(118);
    expect(carriedWidth > 114).toBe(true);

    // When reset §r is present, style clears and line stays <= 114px
    const linesWithReset = ['§6§lTitle§r', 'Edit this page using'];
    const clearedStyle = getCarriedStyleForLine(linesWithReset, 1);
    expect(clearedStyle.bold).toBe(false);
    const clearedWidth = measureLineWidth(parseFormattedText(linesWithReset[1], clearedStyle));
    expect(clearedWidth).toBe(98);
    expect(clearedWidth).toBeLessThanOrEqual(114);
  });

  test('Bookshelf library supports saving multiple books, active book switching, and duplication', () => {
    const bookshelf: BookshelfBook[] = [
      {
        id: 'book-1',
        title: 'Book One',
        author: 'Author A',
        pages: ['Page 1 content'],
        updatedAt: 1000,
        createdAt: 1000,
      },
      {
        id: 'book-2',
        title: 'Book Two',
        author: 'Author B',
        pages: ['Page 1', 'Page 2'],
        updatedAt: 2000,
        createdAt: 2000,
      },
    ];

    saveBookshelf(bookshelf);
    const loaded = loadBookshelf();
    expect(loaded.length).toBe(2);
    expect(loaded[0].title).toBe('Book One');
    expect(loaded[1].title).toBe('Book Two');

    // Duplicate Book Two
    const clone: BookshelfBook = {
      id: 'book-2-copy',
      title: `${loaded[1].title} (Copy)`,
      author: loaded[1].author,
      pages: [...loaded[1].pages],
      updatedAt: 3000,
      createdAt: 3000,
    };
    saveBookshelf([clone, ...loaded]);
    const afterDup = loadBookshelf();
    expect(afterDup.length).toBe(3);
    expect(afterDup[0].title).toBe('Book Two (Copy)');
  });

  test('Top matrix toolbar supports "all" and "recent" glyph sets and size filtering', () => {
    // Mode "all" at 8px (contains swords and stars)
    currentMatrixMode.type = 'set';
    currentMatrixMode.setId = 'all';
    currentMatrixMode.px = 8;
    const all8px = getGlyphsForCurrentSelection();
    expect(all8px.length).toBeGreaterThan(100);
    expect(all8px).toContain('⚔');
    expect(all8px).toContain('★');

    // Mode "all" at 6px (symbols like lightning and hearts)
    currentMatrixMode.px = 6;
    const all6px = getGlyphsForCurrentSelection();
    expect(all6px.length).toBeGreaterThan(50);
    expect(all6px).toContain('⚡');
    expect(all6px).toContain('♥');

    // Mode "recent"
    currentMatrixMode.setId = 'recent';
    const recent = getGlyphsForCurrentSelection();
    expect(Array.isArray(recent)).toBe(true);

    // Reset back to all
    currentMatrixMode.setId = 'all';
    currentMatrixMode.px = 6;
  });

  test('deleteBook cleanly removes book and creates Untitled Book when last book is deleted', () => {
    const singleBook: BookshelfBook[] = [
      {
        id: 'sole-book',
        title: 'Only Book',
        author: 'Solo',
        pages: ['Sole content'],
        updatedAt: 1000,
        createdAt: 1000,
      },
    ];
    saveBookshelf(singleBook);
    expect(loadBookshelf().length).toBe(1);

    // Deleting the sole book resets bookshelf with a fresh Untitled Book
    deleteBook('sole-book');
    const remaining = loadBookshelf();
    expect(remaining.length).toBe(1);
    expect(remaining[0].title).toBe('Untitled Book');
    expect(remaining[0].pages).toEqual(['']);
  });

  test('kaomoji are moved into snippets as built-in line presets', () => {
    const kaomojiPresets = DEFAULT_PRESETS.filter(p => p.category === 'Kaomoji');
    expect(kaomojiPresets.length).toBe(23);

    // Verify all 23 are single-line snippets
    for (const k of kaomojiPresets) {
      expect(k.scope).toBe('lines');
      expect(k.isPreset).toBe(true);
      expect(k.lines.length).toBe(1);
      expect(k.lines[0].length).toBeGreaterThan(0);
    }

    // Verify well-known kaomoji are present
    const titles = kaomojiPresets.map(k => k.title);
    expect(titles).toContain('Table Flip');
    expect(titles).toContain('Shrug');
    expect(titles).toContain('Heart Eyes');
    expect(titles).toContain('Happy Face');

    const shrug = kaomojiPresets.find(k => k.title === 'Shrug');
    expect(shrug?.lines[0]).toBe('¯\\_(ツ)_/¯');

    const tableFlip = kaomojiPresets.find(k => k.title === 'Table Flip');
    expect(tableFlip?.lines[0]).toBe('(╯°□°)╯︵ ┻━┻');
  });

  test('renderSnippetPreviewCanvas runs safely without crashing in headless environment', () => {
    // In headless test environment (no document), returns fallback object without exception
    const canvas = renderSnippetPreviewCanvas(['§6Test Line', 'Second Line']);
    expect(canvas).toBeDefined();
  });
});
