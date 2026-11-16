export interface SavedTemplate {
  id: string;
  title: string;
  scope: 'page' | 'lines';
  category: string;
  lines: string[];
  createdAt: number;
  isPreset?: boolean;
}

export const DEFAULT_PRESETS: SavedTemplate[] = [
  {
    id: 'preset-chapter-header',
    title: 'Chapter Header Banner',
    scope: 'lines',
    category: 'Header',
    lines: [
      '§6§l━━━━━━━━━━━━━━━',
      '§r§0§l   CHAPTER I',
      '§3§o  The Awakening',
      '§6§l━━━━━━━━━━━━━━━',
    ],
    createdAt: 1700000000000,
    isPreset: true,
  },
  {
    id: 'preset-toc-page',
    title: 'Table of Contents Page',
    scope: 'page',
    category: 'Table of Contents',
    lines: [
      '§0§lTABLE OF CONTENTS',
      '§8§m                 ',
      '§01. Introduction....§801',
      '§02. The Journey.....§804',
      '§03. Enchantments....§812',
      '§04. Nether Secrets..§818',
      '§05. Epilogue........§824',
      '',
      '',
      '',
      '',
      '',
      '',
      '§8§o-- Continued on p.2 --',
    ],
    createdAt: 1700000000001,
    isPreset: true,
  },
  {
    id: 'preset-boxed-border',
    title: 'Parchment Box Border',
    scope: 'lines',
    category: 'Divider / Border',
    lines: [
      '§1╔═════════════╗',
      '§1║ §0Official Notice§1║',
      '§1╚═════════════╝',
    ],
    createdAt: 1700000000002,
    isPreset: true,
  },
  {
    id: 'preset-decorative-star',
    title: 'Decorative Star Divider',
    scope: 'lines',
    category: 'Divider / Border',
    lines: [
      '§6§l---✦ ★ ✦---',
    ],
    createdAt: 1700000000003,
    isPreset: true,
  },
  {
    id: 'preset-signature-block',
    title: 'Author Signature Block',
    scope: 'lines',
    category: 'Signature',
    lines: [
      '',
      '§8§oRecorded by:',
      '§0§lThe Grand Archivist',
      '§8§oRealm of Craft',
    ],
    createdAt: 1700000000004,
    isPreset: true,
  },
  {
    id: 'preset-rules-page',
    title: 'Server Rules & Codex',
    scope: 'page',
    category: 'Page Layout',
    lines: [
      '§4§l   SERVER CODEX',
      '§8§m                 ',
      '§0§l1. §r§0No griefing',
      '§0§l2. §r§0Respect builds',
      '§0§l3. §r§0Fair trading',
      '§0§l4. §r§0Keep chat clean',
      '§0§l5. §r§0PvP in arenas only',
      '',
      '',
      '',
      '',
      '',
      '§8§oViolations lead to ban.',
      '§8Signed by: §0Staff',
    ],
    createdAt: 1700000000005,
    isPreset: true,
  },
];

const STORAGE_KEY = 'blockgame_saved_art';
const HIDDEN_KEY = 'blockgame_hidden_presets';

export type LibraryFilter = 'all' | 'page' | 'lines' | 'preset' | 'custom';

export function createLibraryStore() {
  let customTemplates = $state<SavedTemplate[]>([]);
  let hiddenPresetIds = $state<string[]>([]);
  let activeFilter = $state<LibraryFilter>('all');

  if (typeof localStorage !== 'undefined') {
    try {
      const rawCustom = localStorage.getItem(STORAGE_KEY);
      if (rawCustom) customTemplates = JSON.parse(rawCustom);
      const rawHidden = localStorage.getItem(HIDDEN_KEY);
      if (rawHidden) hiddenPresetIds = JSON.parse(rawHidden);
    } catch {}
  }

  function saveCustomToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customTemplates));
    } catch {}
  }

  function saveHiddenToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenPresetIds));
    } catch {}
  }

  // Combined visible items
  const allItems = $derived.by(() => {
    const visiblePresets = DEFAULT_PRESETS.filter(p => !hiddenPresetIds.includes(p.id));
    return [...visiblePresets, ...customTemplates];
  });

  const filteredItems = $derived.by(() => {
    switch (activeFilter) {
      case 'page':
        return allItems.filter(i => i.scope === 'page');
      case 'lines':
        return allItems.filter(i => i.scope === 'lines');
      case 'preset':
        return allItems.filter(i => i.isPreset);
      case 'custom':
        return allItems.filter(i => !i.isPreset);
      default:
        return allItems;
    }
  });

  function addCustomTemplate(title: string, scope: 'page' | 'lines', category: string, lines: string[]) {
    const item: SavedTemplate = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: title.trim() || 'Untitled Template',
      scope,
      category: category.trim() || 'Custom',
      lines: lines.filter(l => l !== undefined),
      createdAt: Date.now(),
      isPreset: false,
    };
    customTemplates = [item, ...customTemplates];
    saveCustomToStorage();
    return item;
  }

  function deleteTemplate(id: string) {
    customTemplates = customTemplates.filter(t => t.id !== id);
    saveCustomToStorage();
  }

  function hidePreset(id: string) {
    if (!hiddenPresetIds.includes(id)) {
      hiddenPresetIds = [...hiddenPresetIds, id];
      saveHiddenToStorage();
    }
  }

  function resetAllPresets() {
    hiddenPresetIds = [];
    saveHiddenToStorage();
  }

  return {
    get allItems() { return allItems; },
    get filteredItems() { return filteredItems; },
    get activeFilter() { return activeFilter; },
    set activeFilter(v: LibraryFilter) { activeFilter = v; },
    get hiddenCount() { return hiddenPresetIds.length; },
    addCustomTemplate,
    deleteTemplate,
    hidePreset,
    resetAllPresets,
  };
}

export const libraryStore = createLibraryStore();
