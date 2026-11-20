import {
  type GlyphCategory,
  type GlyphItem,
  ALL_GLYPHS,
  GLYPHS_BY_CATEGORY,
  DEFAULT_FAVORITES,
  findGlyphItem,
} from '../data/symbolChatDataset';
import {
  SYMBOL_CHAT_FONTS,
  getFontById,
  transformWithFont,
} from '../data/symbolChatFonts';

const FAVS_KEY = 'blockgame_user_fav_glyphs';
const RECENTS_KEY = 'blockgame_user_recent_glyphs';
const MAX_RECENTS = 36;

export function createGlyphStore() {
  let initialFavs: string[] = [...DEFAULT_FAVORITES];
  let initialRecents: string[] = [];

  if (typeof localStorage !== 'undefined') {
    try {
      const rawFavs = localStorage.getItem(FAVS_KEY);
      if (rawFavs) {
        const parsed = JSON.parse(rawFavs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialFavs = parsed;
        }
      }
    } catch {}

    try {
      const rawRecents = localStorage.getItem(RECENTS_KEY);
      if (rawRecents) {
        const parsed = JSON.parse(rawRecents);
        if (Array.isArray(parsed)) {
          initialRecents = parsed;
        }
      }
    } catch {}
  }

  let isOpen = $state(false);
  let favorites = $state<string[]>(initialFavs);
  let recents = $state<string[]>(initialRecents);
  let activeCategory = $state<GlyphCategory>('symbols');
  let searchQuery = $state('');
  let previewColor = $state('#1D1D21');
  let inspectorGlyph = $state<GlyphItem | null>(null);
  let activeFontId = $state<string>('small_caps');
  let fontInputText = $state<string>('');

  function saveFavs() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(FAVS_KEY, JSON.stringify(favorites));
    } catch {}
  }

  function saveRecents() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(RECENTS_KEY, JSON.stringify(recents));
    } catch {}
  }

  function toggleFavorite(char: string) {
    if (favorites.includes(char)) {
      favorites = favorites.filter((c) => c !== char);
    } else {
      favorites = [char, ...favorites];
    }
    saveFavs();
  }

  function isFavorite(char: string): boolean {
    return favorites.includes(char);
  }

  function addRecent(char: string) {
    recents = [char, ...recents.filter((c) => c !== char)].slice(0, MAX_RECENTS);
    saveRecents();
  }

  function open() {
    isOpen = true;
  }

  function close() {
    isOpen = false;
  }

  function toggle() {
    isOpen = !isOpen;
  }

  function setCategory(cat: GlyphCategory) {
    activeCategory = cat;
    searchQuery = '';
  }

  function setSearchQuery(q: string) {
    searchQuery = q;
  }

  function setPreviewColor(c: string) {
    previewColor = c;
  }

  function setInspectorGlyph(g: GlyphItem | null) {
    inspectorGlyph = g;
  }

  function setActiveFont(id: string) {
    activeFontId = id;
  }

  const activeFont = $derived(getFontById(activeFontId));

  // Reactive derived filtered glyph list
  const filteredGlyphs = $derived.by<GlyphItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      // Global search across all symbols
      return ALL_GLYPHS.filter((item) => {
        if (item.char.toLowerCase().includes(q)) return true;
        if (item.name.toLowerCase().includes(q)) return true;
        if (item.codepoint.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    if (activeCategory === 'all') {
      return ALL_GLYPHS;
    }

    if (activeCategory === 'fav') {
      return favorites.map((char) => findGlyphItem(char));
    }

    if (activeCategory === 'recent') {
      return recents.map((char) => findGlyphItem(char));
    }

    return GLYPHS_BY_CATEGORY[activeCategory] ?? [];
  });

  return {
    get isOpen() { return isOpen; },
    set isOpen(v: boolean) { isOpen = v; },
    get favorites() { return favorites; },
    get recents() { return recents; },
    get activeCategory() { return activeCategory; },
    get searchQuery() { return searchQuery; },
    set searchQuery(v: string) { searchQuery = v; },
    get previewColor() { return previewColor; },
    set previewColor(v: string) { previewColor = v; },
    get inspectorGlyph() { return inspectorGlyph; },
    get filteredGlyphs() { return filteredGlyphs; },
    get activeFontId() { return activeFontId; },
    set activeFontId(id: string) { activeFontId = id; },
    get fontInputText() { return fontInputText; },
    set fontInputText(txt: string) { fontInputText = txt; },
    get activeFont() { return activeFont; },
    fonts: SYMBOL_CHAT_FONTS,
    toggleFavorite,
    isFavorite,
    addRecent,
    open,
    close,
    toggle,
    setCategory,
    setSearchQuery,
    setPreviewColor,
    setInspectorGlyph,
    setActiveFont,
    transformWithFont,
  };
}

export const glyphStore = createGlyphStore();
