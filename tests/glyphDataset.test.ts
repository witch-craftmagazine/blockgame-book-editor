import { describe, expect, test } from 'bun:test';
import {
  ALL_GLYPHS,
  CATEGORY_DEFINITIONS,
  GLYPHS_BY_CATEGORY,
  findGlyphItem,
  getUnicodeSubsetGlyphs,
} from '../src/data/symbolChatDataset';
import {
  SYMBOL_CHAT_FONTS,
  getFontById,
  transformWithFont,
} from '../src/data/symbolChatFonts';
import { getCharPixelAdvance } from '../src/components/glyphs/glyphRenderer';

describe('Symbol Chat Glyph Dataset & Taxonomy', () => {
  test('defines all 19 expected categories including large subsets (nonlatin, noncharacter, cjk, latin)', () => {
    expect(CATEGORY_DEFINITIONS.length).toBe(19);
    const ids = CATEGORY_DEFINITIONS.map((c) => c.id);
    expect(ids).toContain('all');
    expect(ids).toContain('fav');
    expect(ids).toContain('recent');
    expect(ids).toContain('faces');
    expect(ids).toContain('nature');
    expect(ids).toContain('things');
    expect(ids).toContain('activities');
    expect(ids).toContain('symbols');
    expect(ids).toContain('shapes');
    expect(ids).toContain('borders');
    expect(ids).toContain('rpg');
    expect(ids).toContain('arrows');
    expect(ids).toContain('blocks');
    expect(ids).toContain('math');
    expect(ids).toContain('runes');
    expect(ids).toContain('noncharacter');
    expect(ids).toContain('nonlatin');
    expect(ids).toContain('cjk');
    expect(ids).toContain('latin');
  });

  test('all static categories and large subsets contain populated glyph collections', () => {
    const categories = [
      'faces',
      'nature',
      'things',
      'activities',
      'symbols',
      'shapes',
      'borders',
      'rpg',
      'arrows',
      'blocks',
      'math',
      'runes',
      'braille',
      'fonts',
      'noncharacter',
      'nonlatin',
      'cjk',
      'latin',
    ] as const;
    for (const cat of categories) {
      const items = GLYPHS_BY_CATEGORY[cat];
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(10);
    }

    // Verify scale of large subsets
    expect(GLYPHS_BY_CATEGORY.noncharacter.length).toBeGreaterThanOrEqual(4000);
    expect(GLYPHS_BY_CATEGORY.nonlatin.length).toBeGreaterThanOrEqual(4000);
    expect(GLYPHS_BY_CATEGORY.cjk.length).toBeGreaterThanOrEqual(10000);
    expect(GLYPHS_BY_CATEGORY.latin.length).toBeGreaterThanOrEqual(1000);
  });

  test('getUnicodeSubsetGlyphs returns cached arrays with descriptive names and categories', () => {
    const cjk = getUnicodeSubsetGlyphs('cjk');
    expect(cjk.length).toBeGreaterThan(10000);
    const firstCjk = cjk[0];
    expect(firstCjk.category).toBe('cjk');
    expect(firstCjk.name).toContain('CJK');

    const nonlatin = getUnicodeSubsetGlyphs('nonlatin');
    expect(nonlatin.length).toBeGreaterThan(1000);
    const firstNonlatin = nonlatin[0];
    expect(firstNonlatin.category).toBe('nonlatin');

    const noncharacter = getUnicodeSubsetGlyphs('noncharacter');
    expect(noncharacter.length).toBeGreaterThan(1000);
    expect(noncharacter[0].category).toBe('noncharacter');
  });

  test('every glyph item has valid character, descriptive name, and single-char codepoint', () => {
    for (const item of ALL_GLYPHS) {
      expect(item.char.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.codepoint.length).toBeGreaterThan(0);
      expect(item.codepoint.startsWith('U+')).toBe(true);
    }
  });

  test('findGlyphItem returns registered glyph or generates item for custom glyph', () => {
    const sword = findGlyphItem('⚔');
    expect(sword.name).toBe('Crossed Swords');
    expect(sword.codepoint).toBe('U+2694');
    expect(sword.isSmp).toBe(false);

    // Large Circle (U+25EF) verified from official Minecraft Unifont assets
    const largeCircle = findGlyphItem('◯');
    expect(largeCircle.name).toBe('Large Circle');
    expect(largeCircle.codepoint).toBe('U+25EF');
    expect(largeCircle.category).toBe('shapes');
    expect(largeCircle.isSmp).toBe(false);

    const custom = findGlyphItem('§');
    expect(custom.char).toBe('§');
    expect(custom.codepoint).toBe('U+00A7');
  });

  test('includes all 96 authentic Minecraft Unicode Geometric Shapes (U+25A0..U+25FF)', () => {
    const shapeChars = GLYPHS_BY_CATEGORY.shapes.map((g) => g.char);
    for (let cp = 0x25a0; cp < 0x2600; cp++) {
      const ch = String.fromCodePoint(cp);
      expect(shapeChars).toContain(ch);
      const item = findGlyphItem(ch);
      expect(item.codepoint).toBe(`U+${cp.toString(16).toUpperCase()}`);
    }
  });

  test('getCharPixelAdvance returns positive pixel widths for Minecraft symbols', () => {
    expect(getCharPixelAdvance('⚔')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('★')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('━')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('░')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('◯')).toBe(7);
    expect(getCharPixelAdvance('○')).toBe(6);
  });

  test('Symbol Chat Unicode fonts transform text correctly', () => {
    expect(SYMBOL_CHAT_FONTS.length).toBeGreaterThanOrEqual(10);

    const smallCaps = transformWithFont('hello world', 'small_caps');
    expect(smallCaps).toBe('ʜᴇʟʟᴏ ᴡᴏʀʟᴅ');

    const circled = transformWithFont('abc 123', 'circled');
    expect(circled).toBe('ⓐⓑⓒ ①②③');

    const fullwidth = transformWithFont('hello', 'fullwidth');
    expect(fullwidth).toBe('ｈｅｌｌｏ');

    const superscript = transformWithFont('test 123', 'superscript');
    expect(superscript).toBe('ᵗᵉˢᵗ ¹²³');

    const font = getFontById('small_caps');
    expect(font.name).toBe('Small Caps');
    expect(font.isSmp).toBe(false);
  });
});
