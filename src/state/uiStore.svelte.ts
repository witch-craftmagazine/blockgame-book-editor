export type ThemeMode = 'dark' | 'light';
export type ViewMode = 'single' | 'spread';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'warn' | 'error';
}

const THEME_KEY = 'blockgame_theme';
const VIEW_MODE_KEY = 'blockgame_view_mode';

export function createUiStore() {
  let initialTheme: ThemeMode = 'dark';
  let initialViewMode: ViewMode = 'single';

  if (typeof localStorage !== 'undefined') {
    const savedTheme = localStorage.getItem(THEME_KEY) as ThemeMode;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      initialTheme = savedTheme;
    }
    const savedView = localStorage.getItem(VIEW_MODE_KEY) as ViewMode;
    if (savedView === 'single' || savedView === 'spread') {
      initialViewMode = savedView;
    }
  }

  let theme = $state<ThemeMode>(initialTheme);
  let viewMode = $state<ViewMode>(initialViewMode);
  let isPresetsDrawerOpen = $state(false);
  let isSaveDialogOpen = $state(false);
  let toasts = $state<ToastMessage[]>([]);
  let toastCounter = 0;

  function setTheme(newTheme: ThemeMode) {
    theme = newTheme;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, newTheme);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
    }
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  function setViewMode(mode: ViewMode) {
    viewMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(VIEW_MODE_KEY, mode);
    }
  }

  function toggleViewMode() {
    setViewMode(viewMode === 'single' ? 'spread' : 'single');
  }

  function showToast(text: string, type: ToastMessage['type'] = 'info', durationMs = 2500) {
    const id = ++toastCounter;
    toasts = [...toasts, { id, text, type }];
    setTimeout(() => {
      toasts = toasts.filter((t) => t.id !== id);
    }, durationMs);
  }

  return {
    get theme() { return theme; },
    get viewMode() { return viewMode; },
    get isPresetsDrawerOpen() { return isPresetsDrawerOpen; },
    set isPresetsDrawerOpen(v: boolean) { isPresetsDrawerOpen = v; },
    get isSaveDialogOpen() { return isSaveDialogOpen; },
    set isSaveDialogOpen(v: boolean) { isSaveDialogOpen = v; },
    get toasts() { return toasts; },
    setTheme,
    toggleTheme,
    setViewMode,
    toggleViewMode,
    showToast,
  };
}

export const uiStore = createUiStore();
