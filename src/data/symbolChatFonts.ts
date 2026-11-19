/**
 * Symbol Chat Unicode Font Translators
 *
 * Implements Symbol Chat's font replacement feature:
 * Converts regular text into various Unicode stylized alphabets:
 * - Small Caps (BMP, Vanilla Compatible)
 * - Circled Letters & Numbers (BMP, Vanilla Compatible)
 * - Circled Black / Inverted (SMP)
 * - Fullwidth (BMP, Vanilla Compatible)
 * - Superscript (BMP, Vanilla Compatible)
 * - Subscript (BMP, Vanilla Compatible)
 * - Inverted / Upside Down (BMP, Vanilla Compatible)
 * - Fraktur / Gothic (SMP)
 * - Double-Struck / Blackboard (SMP)
 * - Script / Cursive (SMP)
 * - Bold Serif (SMP)
 * - Squared / Boxed (SMP)
 */

export interface SymbolChatFont {
  id: string;
  name: string;
  description: string;
  sample: string;
  isSmp: boolean;
  charMap: Record<string, string>;
  transform: (text: string) => string;
}

export const REVERSE_FONT_MAP: Record<string, string> = {};

// Inverted non-ASCII characters map
const INVERTED_SPECIALS: Record<string, string> = {
  'ɐ': 'a', 'ɔ': 'c', 'ǝ': 'e', 'ɟ': 'f', 'ƃ': 'g', 'ɥ': 'h', 'ᴉ': 'i', 'ɾ': 'j',
  'ʞ': 'k', 'ɯ': 'm', 'ɹ': 'r', 'ʇ': 't', 'ʌ': 'v', 'ʍ': 'w', 'ʎ': 'y',
};

function populateReverseMap(map: Record<string, string>) {
  for (const [orig, styled] of Object.entries(map)) {
    const cp = styled.codePointAt(0) || 0;
    if (cp > 127 && !REVERSE_FONT_MAP[styled]) {
      REVERSE_FONT_MAP[styled] = orig;
    }
  }
}

export function toNormalText(text: string): string {
  if (!text) return '';
  let out = '';
  let i = 0;
  while (i < text.length) {
    // Preserve formatting codes intact (§ codes)
    if (text[i] === '§' && i + 1 < text.length) {
      out += text[i] + text[i + 1];
      i += 2;
      continue;
    }
    const cp = text.codePointAt(i) || 0;
    const charStr = String.fromCodePoint(cp);
    out += REVERSE_FONT_MAP[charStr] ?? charStr;
    i += charStr.length;
  }
  return out;
}

export const NORMAL_FONT: SymbolChatFont = {
  id: 'normal',
  name: 'Normal',
  description: 'Standard plain Latin text (Restores normal characters)',
  sample: 'abc Text',
  isSmp: false,
  charMap: {},
  transform: (text: string) => toNormalText(text),
};

function buildFont(
  id: string,
  name: string,
  description: string,
  sample: string,
  isSmp: boolean,
  charMap: Record<string, string>,
  reverseText = false
): SymbolChatFont {
  populateReverseMap(charMap);
  return {
    id,
    name,
    description,
    sample,
    isSmp,
    charMap,
    transform: (text: string) => {
      // First normalize any previously stylized Unicode text back to normal
      const normalized = toNormalText(text);
      if (reverseText) {
        let result = '';
        let i = 0;
        while (i < normalized.length) {
          if (normalized[i] === '§' && i + 1 < normalized.length) {
            result += normalized[i] + normalized[i + 1];
            i += 2;
            continue;
          }
          const cp = normalized.codePointAt(i) || 0;
          const charStr = String.fromCodePoint(cp);
          result += charMap[charStr] ?? charStr;
          i += charStr.length;
        }
        return Array.from(result).reverse().join('');
      }

      let result = '';
      let i = 0;
      while (i < normalized.length) {
        if (normalized[i] === '§' && i + 1 < normalized.length) {
          result += normalized[i] + normalized[i + 1];
          i += 2;
          continue;
        }
        const cp = normalized.codePointAt(i) || 0;
        const charStr = String.fromCodePoint(cp);
        result += charMap[charStr] ?? charStr;
        i += charStr.length;
      }
      return result;
    },
  };
}

// 1. Small Caps (All BMP <= 0xFFFF)
const SMALL_CAPS_MAP: Record<string, string> = {
  a: 'ᴀ', b: 'ʙ', c: 'ᴄ', d: 'ᴅ', e: 'ᴇ', f: 'ғ', g: 'ɢ', h: 'ʜ', i: 'ɪ', j: 'ᴊ',
  k: 'ᴋ', l: 'ʟ', m: 'ᴍ', n: 'ɴ', o: 'ᴏ', p: 'ᴘ', q: 'ǫ', r: 'ʀ', s: 's', t: 'ᴛ',
  u: 'ᴜ', v: 'ᴠ', w: 'ᴡ', x: 'x', y: 'ʏ', z: 'ᴢ',
  A: 'ᴀ', B: 'ʙ', C: 'ᴄ', D: 'ᴅ', E: 'ᴇ', F: 'ғ', G: 'ɢ', H: 'ʜ', I: 'ɪ', J: 'ᴊ',
  K: 'ᴋ', L: 'ʟ', M: 'ᴍ', N: 'ɴ', O: 'ᴏ', P: 'ᴘ', Q: 'ǫ', R: 'ʀ', S: 's', T: 'ᴛ',
  U: 'ᴜ', V: 'ᴠ', W: 'ᴡ', X: 'x', Y: 'ʏ', Z: 'ᴢ',
};

// 2. Circled (All BMP <= 0xFFFF)
const CIRCLED_MAP: Record<string, string> = {
  A: 'Ⓐ', B: 'Ⓑ', C: 'Ⓒ', D: 'Ⓓ', E: 'Ⓔ', F: 'Ⓕ', G: 'Ⓖ', H: 'Ⓗ', I: 'Ⓘ', J: 'Ⓙ',
  K: 'Ⓚ', L: 'Ⓛ', M: 'Ⓜ', N: 'Ⓝ', O: 'Ⓞ', P: 'Ⓟ', Q: 'Ⓠ', R: 'Ⓡ', S: 'Ⓢ', T: 'Ⓣ',
  U: 'Ⓤ', V: 'Ⓥ', W: 'Ⓦ', X: 'Ⓧ', Y: 'Ⓨ', Z: 'Ⓩ',
  a: 'ⓐ', b: 'ⓑ', c: 'ⓒ', d: 'ⓓ', e: 'ⓔ', f: 'ⓕ', g: 'ⓖ', h: 'ⓗ', i: 'ⓘ', j: 'ⓙ',
  k: 'ⓚ', l: 'ⓛ', m: 'ⓜ', n: 'ⓝ', o: 'ⓞ', p: 'ⓟ', q: 'ⓠ', r: 'ⓡ', s: 'ⓢ', t: 'ⓣ',
  u: 'ⓤ', v: 'ⓥ', w: 'ⓦ', x: 'ⓧ', y: 'ⓨ', z: 'ⓩ',
  '0': '⓪', '1': '①', '2': '②', '3': '③', '4': '④', '5': '⑤', '6': '⑥', '7': '⑦', '8': '⑧', '9': '⑨',
};

// 3. Circled Black / Inverted (SMP > 0xFFFF)
const CIRCLED_BLACK_MAP: Record<string, string> = {
  A: '🅐', B: '🅑', C: '🅒', D: '🅓', E: '🅔', F: '🅕', G: '🅖', H: '🅗', I: '🅘', J: '🅙',
  K: '🅚', L: '🅛', M: '🅜', N: '🅝', O: '🅞', P: '🅟', Q: '🅠', R: '🅡', S: '🅢', T: '🅣',
  U: '🅤', V: '🅥', W: '🅦', X: '🅧', Y: '🅨', Z: '🅩',
  a: '🅐', b: '🅑', c: '🅒', d: '🅓', e: '🅔', f: '🅕', g: '🅖', h: '🅗', i: '🅘', j: '🅙',
  k: '🅚', l: '🅛', m: '🅜', n: '🅝', o: '🅞', p: '🅟', q: '🅠', r: '🅡', s: '🅢', t: '🅣',
  u: '🅤', v: '🅥', w: '🅦', x: '🅧', y: '🅨', z: '🅩',
  '0': '⓿', '1': '❶', '2': '❷', '3': '❸', '4': '❹', '5': '❺', '6': '❻', '7': '❼', '8': '❽', '9': '❾',
};

// 4. Fullwidth (BMP <= 0xFFFF)
const FULLWIDTH_MAP: Record<string, string> = {};
for (let i = 33; i <= 126; i++) {
  FULLWIDTH_MAP[String.fromCharCode(i)] = String.fromCharCode(i + 0xFEE0);
}
FULLWIDTH_MAP[' '] = '\u3000';

// 5. Superscript (BMP <= 0xFFFF)
const SUPERSCRIPT_MAP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  a: 'ᵃ', b: 'ᵇ', c: 'ᶜ', d: 'ᵈ', e: 'ᵉ', f: 'ᶠ', g: 'ᵍ', h: 'ʰ', i: 'ⁱ', j: 'ʲ',
  k: 'ᵏ', l: 'ˡ', m: 'ᵐ', n: 'ⁿ', o: 'ᵒ', p: 'ᵖ', r: 'ʳ', s: 'ˢ', t: 'ᵗ', u: 'ᵘ',
  v: 'ᵛ', w: 'ʷ', x: 'ˣ', y: 'ʸ', z: 'ᶻ',
  A: 'ᴬ', B: 'ᴮ', C: 'ᶜ', D: 'ᴰ', E: 'ᴱ', F: 'ᶠ', G: 'ᴳ', H: 'ᴴ', I: 'ᴵ', J: 'ᴶ',
  K: 'ᴷ', L: 'ᴸ', M: 'ᴹ', N: 'ᴺ', O: 'ᴼ', P: 'ᴾ', R: 'ᴿ', T: 'ᵀ', U: 'ᵁ', V: 'ⱽ',
  W: 'ᵂ', X: 'ˣ', Y: 'ʸ', Z: 'ᶻ',
};

// 6. Subscript (BMP <= 0xFFFF)
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
  a: 'ₐ', e: 'ₑ', h: 'ₕ', i: 'ᵢ', j: 'ⱼ', k: 'ₖ', l: 'ₗ', m: 'ₘ', n: 'ₙ', o: 'ₒ',
  p: 'ₚ', r: 'ᵣ', s: 'ₛ', t: 'ₜ', u: 'ᵤ', v: 'ᵥ', x: 'ₓ',
};

// 7. Inverted / Upside Down (BMP <= 0xFFFF)
const INVERTED_MAP: Record<string, string> = {
  a: 'ɐ', b: 'q', c: 'ɔ', d: 'p', e: 'ǝ', f: 'ɟ', g: 'ƃ', h: 'ɥ', i: 'ı', j: 'ɾ',
  k: 'ʞ', l: 'l', m: 'ɯ', n: 'u', o: 'o', p: 'd', q: 'b', r: 'ɹ', s: 's', t: 'ʇ',
  u: 'n', v: 'ʌ', w: 'ʍ', x: 'x', y: 'ʎ', z: 'z',
  A: '∀', B: '𐐒', C: 'Ɔ', D: '◖', E: 'Ǝ', F: 'Ⅎ', G: '⅁', H: 'H', I: 'I', J: 'ſ',
  K: '⋊', L: '⅂', M: 'W', N: 'N', O: 'O', P: 'Ԁ', Q: 'Ό', R: 'ᴚ', S: 'S', T: '⊥',
  U: '∩', V: 'Λ', W: 'M', X: 'X', Y: '⅄', Z: 'Z',
  '1': '⇂', '2': 'ᄅ', '3': 'Ɛ', '4': 'ㄣ', '5': 'ϛ', '6': '9', '7': 'ㄥ', '8': '8', '9': '6', '0': '0',
  '?': '¿', '!': '¡', '.': '˙', ',': '\'', '\'': ',', '"': '„',
};

// 8. Fraktur / Gothic (SMP > 0xFFFF)
const FRAKTUR_MAP: Record<string, string> = {
  A: '𝔄', B: '𝔅', C: 'ℭ', D: '𝔇', E: '𝔈', F: '𝔉', G: '𝔊', H: 'ℌ', I: 'ℑ', J: '𝔍',
  K: '𝔎', L: '𝔏', M: '𝔐', N: '𝔑', O: '𝔒', P: '𝔓', Q: '𝔔', R: 'ℜ', S: '𝔖', T: '𝔗',
  U: '𝔘', V: '𝔙', W: '𝔚', X: '𝔛', Y: '𝔜', Z: 'ℨ',
  a: '𝔞', b: '𝔟', c: '𝔠', d: '𝔡', e: '𝔢', f: '𝔣', g: '𝔤', h: '𝔥', i: '𝔦', j: '𝔧',
  k: '𝔨', l: '𝔩', m: '𝔪', n: '𝔫', o: '𝔬', p: '𝔭', q: '𝔮', r: '𝔯', s: '𝔰', t: '𝔱',
  u: '𝔲', v: '𝔳', w: '𝔴', x: '𝔵', y: '𝔶', z: '𝔷',
};

// 9. Double-Struck / Blackboard (SMP > 0xFFFF)
const DOUBLE_STRUCK_MAP: Record<string, string> = {
  A: '𝔸', B: '𝔹', C: 'ℂ', D: '𝔻', E: '𝔼', F: '𝔽', G: '𝔾', H: 'ℍ', I: '𝕀', J: '𝕁',
  K: '𝕂', L: '𝕃', M: '𝕄', N: 'ℕ', O: '𝕆', P: 'ℙ', Q: 'ℚ', R: 'ℝ', S: '𝕊', T: '𝕋',
  U: '𝕌', V: '𝕍', W: '𝕎', X: '𝕏', Y: '𝕐', Z: 'ℤ',
  a: '𝕒', b: '𝕓', c: '𝕔', d: '𝕕', e: '𝕖', f: '𝕗', g: '𝕘', h: '𝕙', i: '𝕚', j: '𝕛',
  k: '𝕜', l: '𝕝', m: '𝕞', n: '𝕟', o: '𝕠', p: '𝕡', q: '𝕢', r: '𝕣', s: '𝕤', t: '𝕥',
  u: '𝕦', v: '𝕧', w: '𝕨', x: '𝕩', y: '𝕪', z: '𝕫',
  '0': '𝟘', '1': '𝟙', '2': '𝕚', '3': '𝟛', '4': '𝟜', '5': '𝟝', '6': '𝟞', '7': '𝟟', '8': '𝟠', '9': '𝟡',
};

// 10. Script / Cursive (SMP > 0xFFFF)
const SCRIPT_MAP: Record<string, string> = {
  A: '𝒜', B: 'ℬ', C: '𝒞', D: '𝒟', E: 'ℰ', F: 'ℱ', G: '𝒢', H: 'ℋ', I: 'ℐ', J: '𝒥',
  K: '𝒦', L: 'ℒ', M: 'ℳ', N: '𝒩', O: '𝒪', P: '𝒫', Q: '𝒬', R: 'ℛ', S: '𝒮', T: '𝒯',
  U: '𝒰', V: '𝒱', W: '𝒲', X: '𝒳', Y: '𝒴', Z: '𝒵',
  a: '𝒶', b: '𝒷', c: '𝒸', d: '𝒹', e: 'ℯ', f: '𝒻', g: 'ℊ', h: '𝒽', i: '𝒾', j: '𝒿',
  k: '𝓀', l: '𝓁', m: '𝓂', n: '𝓃', o: 'ℴ', p: '𝓅', q: '𝓆', r: '𝓇', s: '𝓈', t: '𝓉',
  u: '𝓊', v: '𝓋', w: '𝓌', x: '𝓍', y: '𝓎', z: '𝓏',
};

// 11. Bold Serif (SMP > 0xFFFF)
const BOLD_SERIF_MAP: Record<string, string> = {
  A: '𝐀', B: '𝐁', C: '𝐂', D: '𝐃', E: '𝐄', F: '𝐅', G: '𝐆', H: '𝐇', I: '𝐈', J: '𝐉',
  K: '𝐊', L: '𝐋', M: '𝐌', N: '𝐍', O: '𝐎', P: '𝐏', Q: '𝐐', R: '𝐑', S: '𝐒', T: '𝐓',
  U: '𝐔', V: '𝐕', W: '𝐖', X: '𝐗', Y: '𝐘', Z: '𝐙',
  a: '𝐚', b: '𝐛', c: '𝐜', d: '𝐝', e: '𝐞', f: '𝐟', g: '𝐠', h: '𝐡', i: '𝐢', j: '𝐣',
  k: '𝐤', l: '𝐥', m: '𝐦', n: '𝐧', o: '𝐨', p: '𝐩', q: '𝐪', r: '𝐫', s: '𝐬', t: '𝐭',
  u: '𝐮', v: '𝐯', w: '𝐰', x: '𝐱', y: '𝐲', z: '𝐳',
  '0': '𝟎', '1': '𝟏', '2': '𝟐', '3': '𝟑', '4': '𝟒', '5': '𝟓', '6': '𝟔', '7': '𝟕', '8': '𝟖', '9': '𝟗',
};

// 12. Squared / Boxed (SMP > 0xFFFF)
const SQUARED_MAP: Record<string, string> = {
  A: '🄰', B: '🄱', C: '🄲', D: '🄳', E: '🄴', F: '🄵', G: '🄶', H: '🄷', I: '🄸', J: '🄹',
  K: '🄺', L: '🄻', M: '🄼', N: '🄽', O: '🄾', P: '🄿', Q: '🅀', R: '🅁', S: '🅂', T: '🅃',
  U: '🅄', V: '🅅', W: '🅆', X: '🅇', Y: '🅈', Z: '🅉',
  a: '🄰', b: '🄱', c: '🄲', d: '🄳', e: '🄴', f: '🄵', g: '🄶', h: '🄷', i: '🄸', j: '🄹',
  k: '🄺', l: '🄻', m: '🄼', n: '🄽', o: '🄾', p: '🄿', q: '🅀', r: '🅁', s: '🅂', t: '🅃',
  u: '🅄', v: '🅅', w: '🅆', x: '🅇', y: '🅈', z: '🅉',
};

export const SYMBOL_CHAT_FONTS: SymbolChatFont[] = [
  buildFont('small_caps', 'Small Caps', 'Classic Minecraft book titling (Vanilla BMP)', 'ᴀʙᴄ ᴛᴇxᴛ', false, SMALL_CAPS_MAP),
  buildFont('circled', 'Circled', 'Numbered and lettered badges (Vanilla BMP)', 'ⒶⒷⒸ ①②③', false, CIRCLED_MAP),
  buildFont('fullwidth', 'Fullwidth', 'Wide aesthetic monospace spacing (Vanilla BMP)', 'ｔｅｘｔ', false, FULLWIDTH_MAP),
  buildFont('superscript', 'Superscript', 'Tiny elevated numbers & runes (Vanilla BMP)', 'ᵗᵉˣᵗ ¹²³', false, SUPERSCRIPT_MAP),
  buildFont('subscript', 'Subscript', 'Tiny chemical/index subscripts (Vanilla BMP)', 'ₜₑₓₜ ₁₂₃', false, SUBSCRIPT_MAP),
  buildFont('inverted', 'Upside Down', 'Rotated text for puzzles & secrets (Vanilla BMP)', 'ʇxǝʇ', false, INVERTED_MAP, true),
  buildFont('fraktur', 'Fraktur / Gothic', 'Medieval German blackletter script', '𝔉𝔯𝔞𝔨𝔱𝔲𝔯', true, FRAKTUR_MAP),
  buildFont('double_struck', 'Double Struck', 'Blackboard bold mathematical letters', '𝔻𝕠𝕦𝕓𝕝𝕖', true, DOUBLE_STRUCK_MAP),
  buildFont('script', 'Script / Cursive', 'Handwritten cursive calligraphy', '𝒮𝒸𝓇𝒾𝓅𝓉', true, SCRIPT_MAP),
  buildFont('bold_serif', 'Bold Serif', 'Heavy authoritative serif typography', '𝐁𝐨𝐥𝐝', true, BOLD_SERIF_MAP),
  buildFont('circled_black', 'Circled Black', 'Solid inverted badge tiles', '🅐🅑🅒 ❶❷❸', true, CIRCLED_BLACK_MAP),
  buildFont('squared', 'Squared', 'Boxed keyboard keycaps', '🄰🄱🄲', true, SQUARED_MAP),
];

// Inverted specials
Object.assign(REVERSE_FONT_MAP, INVERTED_SPECIALS);

export function getFontById(id: string): SymbolChatFont {
  if (id === 'normal') return NORMAL_FONT;
  return SYMBOL_CHAT_FONTS.find((f) => f.id === id) || NORMAL_FONT;
}

export function transformWithFont(text: string, fontId: string): string {
  const font = getFontById(fontId);
  return font ? font.transform(text) : text;
}
