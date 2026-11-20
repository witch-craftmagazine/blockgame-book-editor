import { DEFAULT_PRESETS, type SavedTemplate } from '../data/defaultPresets';
export type { SavedTemplate };
export { DEFAULT_PRESETS };

const STORAGE_KEY = 'blockgame_saved_art';
const HIDDEN_KEY = 'blockgame_hidden_presets';

export type LibraryFilter = 'all' | 'page' | 'lines' | 'kaomoji' | 'preset' | 'custom';

export function createLibraryStore() {
  let initialCustom: SavedTemplate[] = [];
  let initialHidden: string[] = [];

  if (typeof localStorage !== 'undefined') {
    try {
      const rawCustom = localStorage.getItem(STORAGE_KEY);
      if (rawCustom) initialCustom = JSON.parse(rawCustom);
      const rawHidden = localStorage.getItem(HIDDEN_KEY);
      if (rawHidden) initialHidden = JSON.parse(rawHidden);

      // Migrate legacy snippet records from history into saved art
      const rawHist = localStorage.getItem('blockgame_book_history_v1');
      if (rawHist) {
        const histSnapshots = JSON.parse(rawHist);
        if (Array.isArray(histSnapshots)) {
          const snippets = histSnapshots.filter((s: any) => s.type === 'snippet');
          if (snippets.length > 0) {
            let migrated = false;
            for (const s of snippets) {
              if (!initialCustom.some(t => t.id === s.id)) {
                initialCustom = [
                  {
                    id: s.id || `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                    title: s.title || 'Saved Snippet',
                    scope: 'lines',
                    category: 'Snippet',
                    lines: s.lines || [],
                    createdAt: s.timestamp || Date.now(),
                    isPreset: false,
                  },
                  ...initialCustom,
                ];
                migrated = true;
              }
            }
            if (migrated) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(initialCustom));
            }
            const purified = histSnapshots.filter((s: any) => s.type !== 'snippet');
            localStorage.setItem('blockgame_book_history_v1', JSON.stringify(purified));
          }
        }
      }
    } catch {}
  }

  let customTemplates = $state<SavedTemplate[]>(initialCustom);
  let hiddenPresetIds = $state<string[]>(initialHidden);
  let activeFilter = $state<LibraryFilter>('all');

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
      case 'kaomoji':
        return allItems.filter(i => i.category === 'Kaomoji');
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
