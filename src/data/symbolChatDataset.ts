/**
 * Symbol Chat-Inspired Glyph Catalog for Minecraft Books
 *
 * Categorized symbols matching Symbol Chat's typography taxonomy:
 * - Borders & Box Drawing
 * - RPG & Emblems
 * - Arrows & Directionals
 * - Blocks & Dithering Shades
 * - Math, Numerals & Fractions
 * - Runes (Elder Futhark & Astrological)
 * - Braille Matrix Patterns
 * - Font Alphabets & Small Caps
 * - Kaomoji & Facial Expressions
 */

export type GlyphCategory =
  | 'all'
  | 'fav'
  | 'recent'
  | 'borders'
  | 'rpg'
  | 'arrows'
  | 'blocks'
  | 'math'
  | 'runes'
  | 'braille'
  | 'fonts'
  | 'kaomoji';

export interface GlyphCategoryMeta {
  id: GlyphCategory;
  label: string;
  icon: string;
  description: string;
}

export interface GlyphItem {
  char: string;
  name: string;
  category: GlyphCategory;
  codepoint: string;
  isSmp: boolean;
}

export const CATEGORY_DEFINITIONS: GlyphCategoryMeta[] = [
  { id: 'all', label: 'All', icon: '🌐', description: 'One large grid displaying all symbols at once' },
  { id: 'fav', label: 'Favorites', icon: '⭐', description: 'Starred characters' },
  { id: 'recent', label: 'Recent', icon: '🕒', description: 'Recently used symbols' },
  { id: 'borders', label: 'Borders', icon: '━', description: 'Box drawing & frames' },
  { id: 'rpg', label: 'RPG', icon: '⚔', description: 'Weapons, tools & emblems' },
  { id: 'arrows', label: 'Arrows', icon: '➔', description: 'Directionals & pointers' },
  { id: 'blocks', label: 'Blocks', icon: '█', description: 'Dithering & shading' },
  { id: 'math', label: 'Math', icon: '🔢', description: 'Superscripts, fractions & numerals' },
  { id: 'runes', label: 'Runes', icon: 'ᚠ', description: 'Elder Futhark & astrology' },
  { id: 'braille', label: 'Braille', icon: '⠟', description: 'Braille matrix art' },
  { id: 'fonts', label: 'Fonts', icon: '🔠', description: 'Symbol Chat font alphabets' },
  { id: 'kaomoji', label: 'Kaomoji', icon: '🔤', description: 'Faces & text expressions' },
];

export const DEFAULT_FAVORITES: string[] = [
  '★', '✦', '✧', '═', '║', '╔', '╗', '╚', '╝', '⚔', '⛏', '⚒', '⚖', '⚜', '⚡', '•', '█', '░', '▓'
];

function createGlyph(char: string, name: string, category: GlyphCategory): GlyphItem {
  const code = char.codePointAt(0) ?? 0;
  return {
    char,
    name,
    category,
    codepoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
    isSmp: code > 0xFFFF,
  };
}

// ── 1. Box Drawing & Borders ──────────────────────────────────────────
const BORDER_GLYPHS: GlyphItem[] = [
  // Heavy box
  createGlyph('━', 'Heavy Horizontal Line', 'borders'),
  createGlyph('┃', 'Heavy Vertical Line', 'borders'),
  createGlyph('┏', 'Heavy Top-Left Corner', 'borders'),
  createGlyph('┓', 'Heavy Top-Right Corner', 'borders'),
  createGlyph('┗', 'Heavy Bottom-Left Corner', 'borders'),
  createGlyph('┛', 'Heavy Bottom-Right Corner', 'borders'),
  createGlyph('┣', 'Heavy Left Tee', 'borders'),
  createGlyph('┫', 'Heavy Right Tee', 'borders'),
  createGlyph('┳', 'Heavy Top Tee', 'borders'),
  createGlyph('┻', 'Heavy Bottom Tee', 'borders'),
  createGlyph('╋', 'Heavy Cross', 'borders'),

  // Double box
  createGlyph('═', 'Double Horizontal Line', 'borders'),
  createGlyph('║', 'Double Vertical Line', 'borders'),
  createGlyph('╔', 'Double Top-Left Corner', 'borders'),
  createGlyph('╗', 'Double Top-Right Corner', 'borders'),
  createGlyph('╚', 'Double Bottom-Left Corner', 'borders'),
  createGlyph('╝', 'Double Bottom-Right Corner', 'borders'),
  createGlyph('╠', 'Double Left Tee', 'borders'),
  createGlyph('╣', 'Double Right Tee', 'borders'),
  createGlyph('╦', 'Double Top Tee', 'borders'),
  createGlyph('╩', 'Double Bottom Tee', 'borders'),
  createGlyph('╬', 'Double Cross', 'borders'),

  // Light / Single box
  createGlyph('─', 'Light Horizontal Line', 'borders'),
  createGlyph('│', 'Light Vertical Line', 'borders'),
  createGlyph('┌', 'Light Top-Left Corner', 'borders'),
  createGlyph('┐', 'Light Top-Right Corner', 'borders'),
  createGlyph('└', 'Light Bottom-Left Corner', 'borders'),
  createGlyph('┘', 'Light Bottom-Right Corner', 'borders'),
  createGlyph('├', 'Light Left Tee', 'borders'),
  createGlyph('┤', 'Light Right Tee', 'borders'),
  createGlyph('┬', 'Light Top Tee', 'borders'),
  createGlyph('┴', 'Light Bottom Tee', 'borders'),
  createGlyph('┼', 'Light Cross', 'borders'),

  // Rounded corners
  createGlyph('╭', 'Rounded Top-Left Corner', 'borders'),
  createGlyph('╮', 'Rounded Top-Right Corner', 'borders'),
  createGlyph('╯', 'Rounded Bottom-Right Corner', 'borders'),
  createGlyph('╰', 'Rounded Bottom-Left Corner', 'borders'),

  // Dashed lines
  createGlyph('┄', 'Dashed Light Horizontal', 'borders'),
  createGlyph('┅', 'Dashed Heavy Horizontal', 'borders'),
  createGlyph('┆', 'Dashed Light Vertical', 'borders'),
  createGlyph('┇', 'Dashed Heavy Vertical', 'borders'),
  createGlyph('┈', 'Quad-Dashed Light Horizontal', 'borders'),
  createGlyph('┉', 'Quad-Dashed Heavy Horizontal', 'borders'),
  createGlyph('┊', 'Quad-Dashed Light Vertical', 'borders'),
  createGlyph('┋', 'Quad-Dashed Heavy Vertical', 'borders'),

  // Diagonal / Cross
  createGlyph('╱', 'Diagonal Slash', 'borders'),
  createGlyph('╲', 'Diagonal Backslash', 'borders'),
  createGlyph('╳', 'Diagonal Cross', 'borders'),
  createGlyph('╒', 'Down Single Up Double Corner', 'borders'),
  createGlyph('╕', 'Down Single Left Double Corner', 'borders'),
  createGlyph('╘', 'Up Single Right Double Corner', 'borders'),
  createGlyph('╛', 'Up Single Left Double Corner', 'borders'),
  createGlyph('╞', 'Vertical Single Right Double Tee', 'borders'),
  createGlyph('╡', 'Vertical Single Left Double Tee', 'borders'),
  createGlyph('╤', 'Down Single Horizontal Double Tee', 'borders'),
  createGlyph('╧', 'Up Single Horizontal Double Tee', 'borders'),
  createGlyph('╪', 'Vertical Single Horizontal Double Cross', 'borders'),
  createGlyph('╫', 'Vertical Double Horizontal Single Cross', 'borders'),
];

// ── 2. RPG & Emblems ──────────────────────────────────────────────────
const RPG_GLYPHS: GlyphItem[] = [
  createGlyph('⚔', 'Crossed Swords', 'rpg'),
  createGlyph('⛏', 'Pickaxe', 'rpg'),
  createGlyph('⚒', 'Hammer and Pick', 'rpg'),
  createGlyph('⚖', 'Scales of Justice', 'rpg'),
  createGlyph('⚗', 'Alembic / Flask', 'rpg'),
  createGlyph('⚙', 'Gear / Cog', 'rpg'),
  createGlyph('⚚', 'Hermes Staff / Caduceus', 'rpg'),
  createGlyph('⚛', 'Atom Symbol', 'rpg'),
  createGlyph('⚜', 'Fleur-de-lis', 'rpg'),
  createGlyph('⚡', 'High Voltage / Lightning', 'rpg'),
  createGlyph('☕', 'Hot Beverage / Potion', 'rpg'),
  createGlyph('☠', 'Skull and Crossbones', 'rpg'),
  createGlyph('⚰', 'Coffin', 'rpg'),
  createGlyph('⚱', 'Funeral Urn', 'rpg'),
  createGlyph('☘', 'Shamrock / Herb', 'rpg'),
  createGlyph('❄', 'Snowflake / Ice Magic', 'rpg'),
  createGlyph('♟', 'Pawn', 'rpg'),
  createGlyph('♙', 'White Pawn', 'rpg'),
  createGlyph('♔', 'White King', 'rpg'),
  createGlyph('♚', 'Black King', 'rpg'),
  createGlyph('♕', 'White Queen', 'rpg'),
  createGlyph('♛', 'Black Queen', 'rpg'),
  createGlyph('♖', 'White Rook', 'rpg'),
  createGlyph('♜', 'Black Rook', 'rpg'),
  createGlyph('♗', 'White Bishop', 'rpg'),
  createGlyph('♝', 'Black Bishop', 'rpg'),
  createGlyph('♘', 'White Knight', 'rpg'),
  createGlyph('♞', 'Black Knight', 'rpg'),
  createGlyph('⛨', 'Black Cross Shield', 'rpg'),
  createGlyph('⚓', 'Anchor', 'rpg'),
  createGlyph('⌛', 'Hourglass Done', 'rpg'),
  createGlyph('⏳', 'Hourglass Flowing', 'rpg'),
  createGlyph('✉', 'Envelope / Letter', 'rpg'),
  createGlyph('✂', 'Scissors / Shears', 'rpg'),
  createGlyph('✎', 'Pencil / Quill', 'rpg'),
  createGlyph('✒', 'Fountain Pen', 'rpg'),
  createGlyph('♈', 'Aries', 'rpg'),
  createGlyph('✡', 'Star of David', 'rpg'),
  createGlyph('☯', 'Yin Yang', 'rpg'),
  createGlyph('☸', 'Wheel of Dharma', 'rpg'),
  createGlyph('☥', 'Ankh', 'rpg'),
  createGlyph('☦', 'Orthodox Cross', 'rpg'),
  createGlyph('☧', 'Chi Rho', 'rpg'),
  createGlyph('☨', 'Cross of Lorraine', 'rpg'),
  createGlyph('☩', 'Jerusalem Cross', 'rpg'),
  createGlyph('☪', 'Star and Crescent', 'rpg'),
  createGlyph('✝', 'Latin Cross', 'rpg'),
  createGlyph('†', 'Dagger Mark', 'rpg'),
  createGlyph('‡', 'Double Dagger Mark', 'rpg'),
  createGlyph('♥', 'Black Heart', 'rpg'),
  createGlyph('♡', 'White Heart', 'rpg'),
  createGlyph('♦', 'Diamond Suit', 'rpg'),
  createGlyph('♠', 'Spade Suit', 'rpg'),
  createGlyph('♣', 'Club Suit', 'rpg'),
  createGlyph('♨', 'Hot Springs', 'rpg'),
  createGlyph('☄', 'Comet', 'rpg'),
  createGlyph('☽', 'First Quarter Moon', 'rpg'),
  createGlyph('☾', 'Last Quarter Moon', 'rpg'),
  createGlyph('☉', 'Sun Symbol', 'rpg'),
  createGlyph('✓', 'Checkmark', 'rpg'),
  createGlyph('✕', 'Cross Mark', 'rpg'),
  createGlyph('✔', 'Heavy Checkmark', 'rpg'),
  createGlyph('✖', 'Heavy Cross Mark', 'rpg'),
];

// ── 3. Arrows & Pointers ──────────────────────────────────────────────
const ARROW_GLYPHS: GlyphItem[] = [
  createGlyph('←', 'Left Arrow', 'arrows'),
  createGlyph('↑', 'Up Arrow', 'arrows'),
  createGlyph('→', 'Right Arrow', 'arrows'),
  createGlyph('↓', 'Down Arrow', 'arrows'),
  createGlyph('↔', 'Left-Right Arrow', 'arrows'),
  createGlyph('↕', 'Up-Down Arrow', 'arrows'),
  createGlyph('↖', 'North-West Arrow', 'arrows'),
  createGlyph('↗', 'North-East Arrow', 'arrows'),
  createGlyph('↘', 'South-East Arrow', 'arrows'),
  createGlyph('↙', 'South-West Arrow', 'arrows'),
  createGlyph('↚', 'Left Arrow Stroke', 'arrows'),
  createGlyph('↛', 'Right Arrow Stroke', 'arrows'),
  createGlyph('↞', 'Left Double Head Arrow', 'arrows'),
  createGlyph('↠', 'Right Double Head Arrow', 'arrows'),
  createGlyph('↢', 'Left Arrow Tail', 'arrows'),
  createGlyph('↣', 'Right Arrow Tail', 'arrows'),
  createGlyph('↦', 'Right Arrow From Bar', 'arrows'),
  createGlyph('↩', 'Left Arrow Hook', 'arrows'),
  createGlyph('↪', 'Right Arrow Hook', 'arrows'),
  createGlyph('↵', 'Down Left Return Arrow', 'arrows'),
  createGlyph('↶', 'Counter-Clockwise Top Curve', 'arrows'),
  createGlyph('↷', 'Clockwise Top Curve', 'arrows'),
  createGlyph('↺', 'Counter-Clockwise Circle Arrow', 'arrows'),
  createGlyph('↻', 'Clockwise Circle Arrow', 'arrows'),
  createGlyph('⇄', 'Right Over Left Arrow', 'arrows'),
  createGlyph('⇅', 'Up Down Parallel Arrow', 'arrows'),
  createGlyph('⇆', 'Left Over Right Arrow', 'arrows'),
  createGlyph('⇇', 'Left Left Double Arrow', 'arrows'),
  createGlyph('⇈', 'Up Up Double Arrow', 'arrows'),
  createGlyph('⇉', 'Right Right Double Arrow', 'arrows'),
  createGlyph('⇊', 'Down Down Double Arrow', 'arrows'),
  createGlyph('⇐', 'Left Double Arrow', 'arrows'),
  createGlyph('⇑', 'Up Double Arrow', 'arrows'),
  createGlyph('⇒', 'Right Double Arrow', 'arrows'),
  createGlyph('⇓', 'Down Double Arrow', 'arrows'),
  createGlyph('⇔', 'Left Right Double Arrow', 'arrows'),
  createGlyph('⇕', 'Up Down Double Arrow', 'arrows'),
  createGlyph('➔', 'Heavy Right Arrow', 'arrows'),
  createGlyph('➜', 'Heavy Round Right Arrow', 'arrows'),
  createGlyph('◄', 'Black Left Pointer', 'arrows'),
  createGlyph('►', 'Black Right Pointer', 'arrows'),
  createGlyph('▲', 'Black Up Pointer', 'arrows'),
  createGlyph('▼', 'Black Down Pointer', 'arrows'),
  createGlyph('◀', 'Black Left Triangle', 'arrows'),
  createGlyph('▶', 'Black Right Triangle', 'arrows'),
  createGlyph('◁', 'White Left Triangle', 'arrows'),
  createGlyph('▷', 'White Right Triangle', 'arrows'),
  createGlyph('△', 'White Up Triangle', 'arrows'),
  createGlyph('▽', 'White Down Triangle', 'arrows'),
  createGlyph('⇦', 'Left White Arrow', 'arrows'),
  createGlyph('⇨', 'Right White Arrow', 'arrows'),
  createGlyph('⇧', 'Up White Arrow', 'arrows'),
  createGlyph('⇩', 'Down White Arrow', 'arrows'),
  createGlyph('◈', 'White Diamond with Centered Dot', 'arrows'),
  createGlyph('⬢', 'Black Hexagon', 'arrows'),
  createGlyph('⬡', 'White Hexagon', 'arrows'),
];

// ── 4. Blocks & Shades ────────────────────────────────────────────────
const BLOCK_GLYPHS: GlyphItem[] = [
  createGlyph('█', 'Full Block', 'blocks'),
  createGlyph('▓', 'Dark Shade', 'blocks'),
  createGlyph('▒', 'Medium Shade', 'blocks'),
  createGlyph('░', 'Light Shade', 'blocks'),
  createGlyph(' ', 'Lower One Eighth Block', 'blocks'),
  createGlyph('▂', 'Lower One Quarter Block', 'blocks'),
  createGlyph('▃', 'Lower Three Eighths Block', 'blocks'),
  createGlyph('▄', 'Lower Half Block', 'blocks'),
  createGlyph('▅', 'Lower Five Eighths Block', 'blocks'),
  createGlyph('▆', 'Lower Three Quarters Block', 'blocks'),
  createGlyph('▇', 'Lower Seven Eighths Block', 'blocks'),
  createGlyph('▀', 'Upper Half Block', 'blocks'),
  createGlyph('▌', 'Left Half Block', 'blocks'),
  createGlyph('▐', 'Right Half Block', 'blocks'),
  createGlyph('▔', 'Upper One Eighth Block', 'blocks'),
  createGlyph('▕', 'Right One Eighth Block', 'blocks'),
  createGlyph('▏', 'Left One Eighth Block', 'blocks'),
  createGlyph('▎', 'Left One Quarter Block', 'blocks'),
  createGlyph('▍', 'Left Three Eighths Block', 'blocks'),
  createGlyph('▋', 'Left Five Eighths Block', 'blocks'),
  createGlyph('▊', 'Left Three Quarters Block', 'blocks'),
  createGlyph('▉', 'Left Seven Eighths Block', 'blocks'),
  createGlyph('▖', 'Quadrant Lower Left', 'blocks'),
  createGlyph('▗', 'Quadrant Lower Right', 'blocks'),
  createGlyph('▘', 'Quadrant Upper Left', 'blocks'),
  createGlyph('▙', 'Quadrant Upper Left and Lower', 'blocks'),
  createGlyph('▚', 'Quadrant Upper Left and Lower Right', 'blocks'),
  createGlyph('▛', 'Quadrant Upper and Lower Left', 'blocks'),
  createGlyph('▜', 'Quadrant Upper and Lower Right', 'blocks'),
  createGlyph('▟', 'Quadrant Lower and Upper Right', 'blocks'),
  createGlyph('■', 'Black Square', 'blocks'),
  createGlyph('□', 'White Square', 'blocks'),
  createGlyph('▪', 'Black Small Square', 'blocks'),
  createGlyph('▫', 'White Small Square', 'blocks'),
  createGlyph('▬', 'Black Rectangle', 'blocks'),
  createGlyph('▭', 'White Rectangle', 'blocks'),
  createGlyph('▮', 'Black Vertical Rectangle', 'blocks'),
  createGlyph('▯', 'White Vertical Rectangle', 'blocks'),
  createGlyph('▰', 'Black Parallelogram', 'blocks'),
  createGlyph('▱', 'White Parallelogram', 'blocks'),
  createGlyph('◆', 'Black Diamond', 'blocks'),
  createGlyph('◇', 'White Diamond', 'blocks'),
  createGlyph('◈', 'White Diamond Containing Black Small Diamond', 'blocks'),
  createGlyph('◉', 'Fisheye / Target', 'blocks'),
  createGlyph('◊', 'Lozenge', 'blocks'),
  createGlyph('○', 'White Circle', 'blocks'),
  createGlyph('●', 'Black Circle', 'blocks'),
  createGlyph('◐', 'Circle Left Half Black', 'blocks'),
  createGlyph('◑', 'Circle Right Half Black', 'blocks'),
  createGlyph('◒', 'Circle Bottom Half Black', 'blocks'),
  createGlyph('◓', 'Circle Top Half Black', 'blocks'),
  createGlyph('◔', 'Circle Upper Right Quadrant Black', 'blocks'),
  createGlyph('◕', 'Circle All Except Upper Left Black', 'blocks'),
];

// ── 5. Math, Numerals & Fractions ─────────────────────────────────────
const MATH_GLYPHS: GlyphItem[] = [
  // Superscripts
  createGlyph('⁰', 'Superscript Zero', 'math'),
  createGlyph('¹', 'Superscript One', 'math'),
  createGlyph('²', 'Superscript Two', 'math'),
  createGlyph('³', 'Superscript Three', 'math'),
  createGlyph('⁴', 'Superscript Four', 'math'),
  createGlyph('⁵', 'Superscript Five', 'math'),
  createGlyph('⁶', 'Superscript Six', 'math'),
  createGlyph('⁷', 'Superscript Seven', 'math'),
  createGlyph('⁸', 'Superscript Eight', 'math'),
  createGlyph('⁹', 'Superscript Nine', 'math'),
  createGlyph('⁺', 'Superscript Plus', 'math'),
  createGlyph('⁻', 'Superscript Minus', 'math'),
  createGlyph('⁼', 'Superscript Equals', 'math'),
  createGlyph('⁽', 'Superscript Open Paren', 'math'),
  createGlyph('⁾', 'Superscript Close Paren', 'math'),

  // Subscripts
  createGlyph('₀', 'Subscript Zero', 'math'),
  createGlyph('₁', 'Subscript One', 'math'),
  createGlyph('₂', 'Subscript Two', 'math'),
  createGlyph('₃', 'Subscript Three', 'math'),
  createGlyph('₄', 'Subscript Four', 'math'),
  createGlyph('₅', 'Subscript Five', 'math'),
  createGlyph('₆', 'Subscript Six', 'math'),
  createGlyph('₇', 'Subscript Seven', 'math'),
  createGlyph('₈', 'Subscript Eight', 'math'),
  createGlyph('₉', 'Subscript Nine', 'math'),
  createGlyph('₊', 'Subscript Plus', 'math'),
  createGlyph('₋', 'Subscript Minus', 'math'),
  createGlyph('₌', 'Subscript Equals', 'math'),
  createGlyph('₍', 'Subscript Open Paren', 'math'),
  createGlyph('₎', 'Subscript Close Paren', 'math'),

  // Fractions
  createGlyph('½', 'Fraction One Half', 'math'),
  createGlyph('⅓', 'Fraction One Third', 'math'),
  createGlyph('⅔', 'Fraction Two Thirds', 'math'),
  createGlyph('¼', 'Fraction One Quarter', 'math'),
  createGlyph('¾', 'Fraction Three Quarters', 'math'),
  createGlyph('⅛', 'Fraction One Eighth', 'math'),
  createGlyph('⅜', 'Fraction Three Eighths', 'math'),
  createGlyph('⅝', 'Fraction Five Eighths', 'math'),
  createGlyph('⅞', 'Fraction Seven Eighths', 'math'),

  // Roman Numerals
  createGlyph('Ⅰ', 'Roman Numeral One', 'math'),
  createGlyph('Ⅱ', 'Roman Numeral Two', 'math'),
  createGlyph('Ⅲ', 'Roman Numeral Three', 'math'),
  createGlyph('Ⅳ', 'Roman Numeral Four', 'math'),
  createGlyph('Ⅴ', 'Roman Numeral Five', 'math'),
  createGlyph('Ⅵ', 'Roman Numeral Six', 'math'),
  createGlyph('Ⅶ', 'Roman Numeral Seven', 'math'),
  createGlyph('Ⅷ', 'Roman Numeral Eight', 'math'),
  createGlyph('Ⅸ', 'Roman Numeral Nine', 'math'),
  createGlyph('Ⅹ', 'Roman Numeral Ten', 'math'),
  createGlyph('Ⅺ', 'Roman Numeral Eleven', 'math'),
  createGlyph('Ⅻ', 'Roman Numeral Twelve', 'math'),
  createGlyph('Ⅼ', 'Roman Numeral Fifty', 'math'),
  createGlyph('Ⅽ', 'Roman Numeral One Hundred', 'math'),
  createGlyph('Ⅾ', 'Roman Numeral Five Hundred', 'math'),
  createGlyph('Ⅿ', 'Roman Numeral One Thousand', 'math'),

  // Operators & Sets
  createGlyph('±', 'Plus Minus', 'math'),
  createGlyph('×', 'Multiplication Sign', 'math'),
  createGlyph('÷', 'Division Sign', 'math'),
  createGlyph('≠', 'Not Equal', 'math'),
  createGlyph('≈', 'Almost Equal', 'math'),
  createGlyph('≤', 'Less Than or Equal', 'math'),
  createGlyph('≥', 'Greater Than or Equal', 'math'),
  createGlyph('∞', 'Infinity', 'math'),
  createGlyph('√', 'Square Root', 'math'),
  createGlyph('∑', 'Summation', 'math'),
  createGlyph('∏', 'N-ary Product', 'math'),
  createGlyph('π', 'Pi', 'math'),
  createGlyph('∫', 'Integral', 'math'),
  createGlyph('∂', 'Partial Differential', 'math'),
  createGlyph('∆', 'Increment / Delta', 'math'),
  createGlyph('∇', 'Nabla / Del', 'math'),
  createGlyph('∈', 'Element Of', 'math'),
  createGlyph('∉', 'Not An Element Of', 'math'),
  createGlyph('∩', 'Intersection', 'math'),
  createGlyph('∪', 'Union', 'math'),
  createGlyph('°', 'Degree Sign', 'math'),
  createGlyph('%', 'Percent Sign', 'math'),
  createGlyph('‰', 'Per Mille Sign', 'math'),
];

// ── 6. Runes & Ancient ────────────────────────────────────────────────
const RUNE_GLYPHS: GlyphItem[] = [
  // Elder Futhark
  createGlyph('ᚠ', 'Fehu (Wealth / Cattle)', 'runes'),
  createGlyph('ᚢ', 'Uruz (Ox / Strength)', 'runes'),
  createGlyph('ᚦ', 'Thurisaz (Giant / Thorn)', 'runes'),
  createGlyph('ᚨ', 'Ansuz (Odin / Breath)', 'runes'),
  createGlyph('ᚱ', 'Raidho (Journey / Ride)', 'runes'),
  createGlyph('ᚲ', 'Kaunan (Torch / Ulcer)', 'runes'),
  createGlyph('ᚷ', 'Gebo (Gift)', 'runes'),
  createGlyph('ᚹ', 'Wunjo (Joy)', 'runes'),
  createGlyph('ᚺ', 'Hagalaz (Hail)', 'runes'),
  createGlyph('ᚾ', 'Naudiz (Need)', 'runes'),
  createGlyph('ᛁ', 'Isaz (Ice)', 'runes'),
  createGlyph('ᛃ', 'Jera (Year / Harvest)', 'runes'),
  createGlyph('ᛇ', 'Eihwaz (Yew Tree)', 'runes'),
  createGlyph('ᛈ', 'Perthro (Fate / Lot)', 'runes'),
  createGlyph('ᛉ', 'Algiz (Elk / Protection)', 'runes'),
  createGlyph('ᛋ', 'Sowilo (Sun)', 'runes'),
  createGlyph('ᛏ', 'Tiwaz (Tyr)', 'runes'),
  createGlyph('ᛒ', 'Berkanan (Birch)', 'runes'),
  createGlyph('ᛖ', 'Ehwaz (Horse)', 'runes'),
  createGlyph('ᛗ', 'Mannaz (Man)', 'runes'),
  createGlyph('ᛚ', 'Laguz (Water)', 'runes'),
  createGlyph('ᛜ', 'Ingwaz (Ing / Earth)', 'runes'),
  createGlyph('ᛞ', 'Dagaz (Day / Dawn)', 'runes'),
  createGlyph('ᛟ', 'Othala (Heritage)', 'runes'),
  createGlyph('ᛥ', 'Stan (Stone)', 'runes'),
  createGlyph('ᛦ', 'Yr (Bow)', 'runes'),
  createGlyph('ᛩ', 'Qweorth', 'runes'),
  createGlyph('ᛪ', 'Calc (Chalk)', 'runes'),

  // Astrological & Alchemical
  createGlyph('♈', 'Aries', 'runes'),
  createGlyph('♉', 'Taurus', 'runes'),
  createGlyph('♊', 'Gemini', 'runes'),
  createGlyph('♋', 'Cancer', 'runes'),
  createGlyph('♌', 'Leo', 'runes'),
  createGlyph('♍', 'Virgo', 'runes'),
  createGlyph('♎', 'Libra', 'runes'),
  createGlyph('♏', 'Scorpio', 'runes'),
  createGlyph('♐', 'Sagittarius', 'runes'),
  createGlyph('♑', 'Capricorn', 'runes'),
  createGlyph('♒', 'Aquarius', 'runes'),
  createGlyph('♓', 'Pisces', 'runes'),
  createGlyph('☿', 'Mercury', 'runes'),
  createGlyph('♀', 'Venus', 'runes'),
  createGlyph('♂', 'Mars', 'runes'),
  createGlyph('♃', 'Jupiter', 'runes'),
  createGlyph('♄', 'Saturn', 'runes'),
  createGlyph('♅', 'Uranus', 'runes'),
  createGlyph('♆', 'Neptune', 'runes'),
  createGlyph('♇', 'Pluto', 'runes'),
];

// ── 7. Braille Matrix ─────────────────────────────────────────────────
const BRAILLE_GLYPHS: GlyphItem[] = [
  createGlyph('⠀', 'Braille Blank Space', 'braille'),
  createGlyph('⠁', 'Braille Dot-1', 'braille'),
  createGlyph('⠃', 'Braille Dots-12', 'braille'),
  createGlyph('⠇', 'Braille Dots-123', 'braille'),
  createGlyph('⡇', 'Braille Dots-1237', 'braille'),
  createGlyph('⣇', 'Braille Dots-12378', 'braille'),
  createGlyph('⣧', 'Braille Left Full Column', 'braille'),
  createGlyph('⣷', 'Braille Left Heavy Column', 'braille'),
  createGlyph('⣿', 'Braille All 8 Dots Full', 'braille'),
  createGlyph('⡿', 'Braille Full Minus Top Right', 'braille'),
  createGlyph('⠿', 'Braille 6 Dots Top', 'braille'),
  createGlyph('⠾', 'Braille 6 Dots Lower', 'braille'),
  createGlyph('⠽', 'Braille Diagonal Dots', 'braille'),
  createGlyph('⠻', 'Braille Upper Diagonal Dots', 'braille'),
  createGlyph('⠛', 'Braille 4 Dots Square', 'braille'),
  createGlyph('⠙', 'Braille Angle Top Right', 'braille'),
  createGlyph('⠉', 'Braille Top Bar 2 Dots', 'braille'),
  createGlyph('⠡', 'Braille Diagonal 2 Dots', 'braille'),
  createGlyph('⠱', 'Braille Angle Left', 'braille'),
  createGlyph('⠰', 'Braille Right Column Dots', 'braille'),
  createGlyph('⠤', 'Braille Middle Bar 2 Dots', 'braille'),
  createGlyph('⠢', 'Braille Low Diagonal', 'braille'),
  createGlyph('⠖', 'Braille Cross 4 Dots', 'braille'),
  createGlyph('⠒', 'Braille Horizontal Middle Bar', 'braille'),
  createGlyph('⠶', 'Braille 6 Dots Lower Bar', 'braille'),
  createGlyph('⠦', 'Braille Angle Bottom Left', 'braille'),
  createGlyph('⠔', 'Braille Diagonal Low', 'braille'),
  createGlyph('⠄', 'Braille Dot-3', 'braille'),
  createGlyph('⠂', 'Braille Dot-2', 'braille'),
  createGlyph('⠐', 'Braille Dot-5', 'braille'),
  createGlyph('⠠', 'Braille Dot-6', 'braille'),
  createGlyph('⡀', 'Braille Dot-7', 'braille'),
  createGlyph('⢀', 'Braille Dot-8', 'braille'),
  createGlyph('⣀', 'Braille Bottom Line Dots 78', 'braille'),
  createGlyph('⣄', 'Braille Bottom Quarter', 'braille'),
  createGlyph('⣤', 'Braille Bottom Half', 'braille'),
  createGlyph('⣴', 'Braille Bottom Three Quarters', 'braille'),
  createGlyph('⣶', 'Braille Lower 6 Dots', 'braille'),
];

// ── 8. Fonts, Small Caps & Decorations ────────────────────────────────
const FONT_GLYPHS: GlyphItem[] = [
  // Small Caps
  createGlyph('ᴀ', 'Small Capital A', 'fonts'),
  createGlyph('ʙ', 'Small Capital B', 'fonts'),
  createGlyph('ᴄ', 'Small Capital C', 'fonts'),
  createGlyph('ᴅ', 'Small Capital D', 'fonts'),
  createGlyph('ᴇ', 'Small Capital E', 'fonts'),
  createGlyph('ғ', 'Small Capital F', 'fonts'),
  createGlyph('ɢ', 'Small Capital G', 'fonts'),
  createGlyph('ʜ', 'Small Capital H', 'fonts'),
  createGlyph('ɪ', 'Small Capital I', 'fonts'),
  createGlyph('ᴊ', 'Small Capital J', 'fonts'),
  createGlyph('ᴋ', 'Small Capital K', 'fonts'),
  createGlyph('ʟ', 'Small Capital L', 'fonts'),
  createGlyph('ᴍ', 'Small Capital M', 'fonts'),
  createGlyph('ɴ', 'Small Capital N', 'fonts'),
  createGlyph('ᴏ', 'Small Capital O', 'fonts'),
  createGlyph('ᴘ', 'Small Capital P', 'fonts'),
  createGlyph('ǫ', 'Small Capital Q', 'fonts'),
  createGlyph('ʀ', 'Small Capital R', 'fonts'),
  createGlyph('s', 'Small Letter S', 'fonts'),
  createGlyph('ᴛ', 'Small Capital T', 'fonts'),
  createGlyph('ᴜ', 'Small Capital U', 'fonts'),
  createGlyph('ᴠ', 'Small Capital V', 'fonts'),
  createGlyph('ᴡ', 'Small Capital W', 'fonts'),
  createGlyph('x', 'Small Letter X', 'fonts'),
  createGlyph('ʏ', 'Small Capital Y', 'fonts'),
  createGlyph('ᴢ', 'Small Capital Z', 'fonts'),

  // Circled Numbers
  createGlyph('①', 'Circled Number 1', 'fonts'),
  createGlyph('②', 'Circled Number 2', 'fonts'),
  createGlyph('③', 'Circled Number 3', 'fonts'),
  createGlyph('④', 'Circled Number 4', 'fonts'),
  createGlyph('⑤', 'Circled Number 5', 'fonts'),
  createGlyph('⑥', 'Circled Number 6', 'fonts'),
  createGlyph('⑦', 'Circled Number 7', 'fonts'),
  createGlyph('⑧', 'Circled Number 8', 'fonts'),
  createGlyph('⑨', 'Circled Number 9', 'fonts'),
  createGlyph('⑩', 'Circled Number 10', 'fonts'),

  // Circled Letters
  createGlyph('Ⓐ', 'Circled Capital A', 'fonts'),
  createGlyph('Ⓑ', 'Circled Capital B', 'fonts'),
  createGlyph('Ⓒ', 'Circled Capital C', 'fonts'),
  createGlyph('Ⓓ', 'Circled Capital D', 'fonts'),
  createGlyph('Ⓔ', 'Circled Capital E', 'fonts'),
  createGlyph('Ⓕ', 'Circled Capital F', 'fonts'),
  createGlyph('Ⓖ', 'Circled Capital G', 'fonts'),
  createGlyph('Ⓗ', 'Circled Capital H', 'fonts'),
  createGlyph('Ⓘ', 'Circled Capital I', 'fonts'),

  // Stars & Ornaments
  createGlyph('★', 'Black Star', 'fonts'),
  createGlyph('☆', 'White Star', 'fonts'),
  createGlyph('✦', 'Black Four-Pointed Star', 'fonts'),
  createGlyph('✧', 'White Four-Pointed Star', 'fonts'),
  createGlyph('✪', 'Circled White Star', 'fonts'),
  createGlyph('✫', 'Open Centre Black Star', 'fonts'),
  createGlyph('✬', 'Black Centre White Star', 'fonts'),
  createGlyph('✭', 'Outlined Black Star', 'fonts'),
  createGlyph('✮', 'Heavy Outlined Black Star', 'fonts'),
  createGlyph('✯', 'Pinwheel Star', 'fonts'),
  createGlyph('✰', 'Shadowed White Star', 'fonts'),
  createGlyph('✱', 'Asterisk', 'fonts'),
  createGlyph('✲', 'Open Centre Asterisk', 'fonts'),
  createGlyph('✳', 'Eight Spoked Asterisk', 'fonts'),
  createGlyph('✴', 'Eight Pointed Black Star', 'fonts'),
  createGlyph('✵', 'Eight Pointed Pinwheel Star', 'fonts'),
  createGlyph('✶', 'Six Pointed Black Star', 'fonts'),
  createGlyph('✷', 'Eight Pointed Rectilinear Black Star', 'fonts'),
  createGlyph('✸', 'Heavy Eight Pointed Rectilinear Black Star', 'fonts'),
  createGlyph('✹', 'Twelve Pointed Black Star', 'fonts'),
  createGlyph('✺', 'Sixteen Pointed Asterisk', 'fonts'),
  createGlyph('✻', 'Teardrop-Spoked Asterisk', 'fonts'),
  createGlyph('✼', 'Open Centre Teardrop Asterisk', 'fonts'),
  createGlyph('✽', 'Heavy Teardrop Asterisk', 'fonts'),
  createGlyph('✾', 'Six Petalled Black and White Florette', 'fonts'),
  createGlyph('✿', 'Black Florette', 'fonts'),
  createGlyph('❀', 'White Florette', 'fonts'),
  createGlyph('❁', 'Eight Petalled Outlined Black Florette', 'fonts'),
  createGlyph('❂', 'Circled Open Centre Eight Pointed Star', 'fonts'),
  createGlyph('❃', 'Heavy Teardrop-Spoked Pinwheel Asterisk', 'fonts'),
  createGlyph('❄', 'Snowflake', 'fonts'),
  createGlyph('❅', 'Tight Trifoliate Snowflake', 'fonts'),
  createGlyph('❆', 'Heavy Chevron Snowflake', 'fonts'),
  createGlyph('❇', 'Sparkle', 'fonts'),
  createGlyph('❈', 'Heavy Sparkle', 'fonts'),
  createGlyph('❉', 'Balloon-Spoked Asterisk', 'fonts'),
  createGlyph('❊', 'Heavy Eight Teardrop-Spoked Propeller Asterisk', 'fonts'),
  createGlyph('❋', 'Heavy Eight Teardrop-Spoked Asterisk', 'fonts'),
  createGlyph('❖', 'Black Diamond Minus White X', 'fonts'),
  createGlyph('✢', 'Four Teardrop-Spoked Asterisk', 'fonts'),
  createGlyph('✣', 'Four Balloon-Spoked Asterisk', 'fonts'),
  createGlyph('✤', 'Heavy Four Balloon-Spoked Asterisk', 'fonts'),
  createGlyph('✥', 'Four Club-Spoked Asterisk', 'fonts'),
  createGlyph('•', 'Bullet Dot', 'fonts'),
  createGlyph('·', 'Middle Dot', 'fonts'),
  createGlyph('※', 'Reference Mark', 'fonts'),
  createGlyph('❦', 'Floral Heart', 'fonts'),
  createGlyph('❧', 'Rotated Floral Heart Bullet', 'fonts'),
];

// ── 9. Kaomoji & Faces ────────────────────────────────────────────────
const KAOMOJI_GLYPHS: GlyphItem[] = [
  { char: '(╯°□°)╯︵ ┻━┻', name: 'Table Flip', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '┬─┬ノ( º _ ºノ)', name: 'Put Table Back', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '¯\\_(ツ)_/¯', name: 'Shrug', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(｡♥‿♥｡)', name: 'Heart Eyes', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: 'ʕ•ᴥ•ʔ', name: 'Bear', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(づ｡◕‿‿◕｡)づ', name: 'Hug', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(•‿•)', name: 'Happy Face', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(¬_¬)', name: 'Side Eye / Suspicious', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(ง •̀_•́)ง', name: 'Ready to Fight', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(•ω•)', name: 'Cat Face', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(ノಠ益ಠ)ノ', name: 'Rage', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: 'ಠ_ಠ', name: 'Look of Disapproval', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(ಥ﹏ಥ)', name: 'Crying', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(´・ω・`)', name: 'Innocent', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(✿◠‿◠)', name: 'Flower Smile', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(◕‿◕✿)', name: 'Cute Flower', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(づ￣ ³￣)づ', name: 'Blow Kiss', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(⊙_☉)', name: 'Shocked', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(☞ﾟヮﾟ)☞', name: 'Finger Guns Right', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '☜(ﾟヮﾟ☜)', name: 'Finger Guns Left', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(*^▽^*)', name: 'Excited Laugh', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(´∀｀)', name: 'Peaceful Bliss', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
  { char: '(•_•)', name: 'Neutral Stare', category: 'kaomoji', codepoint: 'Multi', isSmp: false },
];

export const ALL_GLYPHS: GlyphItem[] = [
  ...BORDER_GLYPHS,
  ...RPG_GLYPHS,
  ...ARROW_GLYPHS,
  ...BLOCK_GLYPHS,
  ...MATH_GLYPHS,
  ...RUNE_GLYPHS,
  ...BRAILLE_GLYPHS,
  ...FONT_GLYPHS,
  ...KAOMOJI_GLYPHS,
];

export const GLYPHS_BY_CATEGORY: Record<Exclude<GlyphCategory, 'fav' | 'recent' | 'all'>, GlyphItem[]> = {
  borders: BORDER_GLYPHS,
  rpg: RPG_GLYPHS,
  arrows: ARROW_GLYPHS,
  blocks: BLOCK_GLYPHS,
  math: MATH_GLYPHS,
  runes: RUNE_GLYPHS,
  braille: BRAILLE_GLYPHS,
  fonts: FONT_GLYPHS,
  kaomoji: KAOMOJI_GLYPHS,
};

const GLYPH_MAP = new Map<string, GlyphItem>();
for (const item of ALL_GLYPHS) {
  GLYPH_MAP.set(item.char, item);
}

export function findGlyphItem(char: string): GlyphItem {
  const existing = GLYPH_MAP.get(char);
  if (existing) return existing;
  const code = char.codePointAt(0) ?? 0;
  return {
    char,
    name: `Symbol ${char}`,
    category: 'rpg',
    codepoint: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
    isSmp: code > 0xFFFF,
  };
}
