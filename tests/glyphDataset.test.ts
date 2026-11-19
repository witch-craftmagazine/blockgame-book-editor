import { describe, expect, test } from 'bun:test';
import {
  ALL_GLYPHS,
  CATEGORY_DEFINITIONS,
  GLYPHS_BY_CATEGORY,
  findGlyphItem,
} from '../src/data/symbolChatDataset';
import {
  SYMBOL_CHAT_FONTS,
  getFontById,
  transformWithFont,
} from '../src/data/symbolChatFonts';
import { getCharPixelAdvance } from '../src/components/glyphs/glyphRenderer';

describe('Symbol Chat Glyph Dataset & Taxonomy', () => {
  test('defines all 16 expected categories with labels, icons and "all" unified grid', () => {
    expect(CATEGORY_DEFINITIONS.length).toBe(16);
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
    expect(ids).toContain('kaomoji');
  });

  test('all static categories contain populated glyph collections', () => {
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
      'kaomoji',
    ] as const;
    for (const cat of categories) {
      const items = GLYPHS_BY_CATEGORY[cat];
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(10);
    }
  });

  test('every glyph item has valid character, descriptive name, and codepoint', () => {
    for (const item of ALL_GLYPHS) {
      expect(item.char.length).toBeGreaterThan(0);
      expect(item.name.length).toBeGreaterThan(0);
      expect(item.codepoint.length).toBeGreaterThan(0);
      if (item.category !== 'kaomoji') {
        expect(item.codepoint.startsWith('U+')).toBe(true);
      }
    }
  });

  test('findGlyphItem returns registered glyph or generates item for custom glyph', () => {
    const sword = findGlyphItem('⚔');
    expect(sword.name).toBe('Crossed Swords');
    expect(sword.codepoint).toBe('U+2694');
    expect(sword.isSmp).toBe(false);

    const custom = findGlyphItem('§');
    expect(custom.char).toBe('§');
    expect(custom.codepoint).toBe('U+00A7');
  });

  test('getCharPixelAdvance returns positive pixel widths for Minecraft symbols', () => {
    expect(getCharPixelAdvance('⚔')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('★')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('━')).toBeGreaterThanOrEqual(5);
    expect(getCharPixelAdvance('(•‿•)')).toBeGreaterThanOrEqual(15);
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
