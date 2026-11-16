import {
  BOOK_TEXT_WIDTH,
  MINECRAFT_LINES_PER_PAGE,
  MINECRAFT_PAGE_MAX_CHARS,
  MINECRAFT_MAX_PAGES,
  detectUnsupportedMinecraftChars,
  parseFormattedText,
  measureLineWidth,
  centerLineText,
  type BlockgameBook,
} from 'blockgame-book-viewer';
import { normalizeBook } from '../utils/bookNormalization';

export interface BookState {
  title: string;
  author: string;
  pages: string[];
}

export interface LineMetrics {
  text: string;
  width: number;
  remainingWidth: number;
  isOverWidth: boolean;
}

const AUTOSAVE_KEY = 'blockgame-book-studio:autosave';
const MAX_UNDO = 40;

export function createBookStore() {
  // Load initial book from localStorage if available
  let initialBook: BookState = normalizeBook({
    title: 'Untitled Book',
    author: 'Author',
    pages: ['§6§lWelcome to the Book!§r\n\nEdit this page using the toolbar or type §-codes directly.'],
  });

  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.pages) && parsed.pages.length > 0) {
          const normalized = normalizeBook({
            title: parsed.title || 'Untitled Book',
            author: parsed.author || 'Author',
            pages: parsed.pages,
          });
          initialBook = {
            title: normalized.title,
            author: normalized.author,
            pages: normalized.pages,
          };
        }
      }
    } catch {}
  }

  // Reactive state runes
  let title = $state(initialBook.title);
  let author = $state(initialBook.author);
  let pages = $state<string[]>([...initialBook.pages]);
  let currentPageIndex = $state(0);
  let activeLineIndex = $state(0);
  let activeCursorPos = $state<number | null>(null);

  // Undo / Redo history stacks
  let undoStack = $state<BookState[]>([]);
  let redoStack = $state<BookState[]>([]);

  // Snapshot active book for undo history
  function takeSnapshot() {
    undoStack = [...undoStack.slice(-MAX_UNDO + 1), {
      title,
      author,
      pages: [...pages],
    }];
    redoStack = [];
  }

  // Persist to local storage
  function saveToLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        title,
        author,
        pages,
      }));
    } catch {}
  }

  // Derived metrics for the active page
  const currentPageText = $derived(pages[currentPageIndex] ?? '');
  
  const currentLines = $derived.by(() => {
    const raw = (pages[currentPageIndex] ?? '').split('\n');
    const result = Array(MINECRAFT_LINES_PER_PAGE).fill('');
    for (let i = 0; i < Math.min(MINECRAFT_LINES_PER_PAGE, raw.length); i++) {
      result[i] = raw[i];
    }
    return result;
  });

  const totalPageChars = $derived(currentPageText.length);
  const isCharLimitExceeded = $derived(totalPageChars > MINECRAFT_PAGE_MAX_CHARS);

  const unsupportedChars = $derived.by(() => {
    return detectUnsupportedMinecraftChars(currentPageText);
  });

  const lineMetrics = $derived.by(() => {
    return currentLines.map((line) => {
      const spans = parseFormattedText(line);
      const width = Math.round(measureLineWidth(spans));
      return {
        text: line,
        width,
        remainingWidth: Math.max(0, BOOK_TEXT_WIDTH - width),
        isOverWidth: width > BOOK_TEXT_WIDTH,
      };
    });
  });

  // Actions
  function setLine(index: number, text: string) {
    if (index < 0 || index >= MINECRAFT_LINES_PER_PAGE) return;
    const newLines = [...currentLines];
    newLines[index] = text;

    // Check 1024 char limit
    const joined = newLines.join('\n').replace(/\n+$/, '');
    if (joined.length > MINECRAFT_PAGE_MAX_CHARS) {
      return false;
    }

    takeSnapshot();
    pages[currentPageIndex] = joined;
    saveToLocalStorage();
    return true;
  }

  function setPageText(text: string) {
    takeSnapshot();
    pages[currentPageIndex] = text;
    saveToLocalStorage();
  }

  function insertAtCursor(text: string) {
    const current = currentLines[activeLineIndex] ?? '';
    let updated: string;
    let nextPos: number;
    if (activeCursorPos === null || activeCursorPos < 0 || activeCursorPos > current.length) {
      updated = current + text;
      nextPos = updated.length;
    } else {
      updated = current.slice(0, activeCursorPos) + text + current.slice(activeCursorPos);
      nextPos = activeCursorPos + text.length;
    }
    const ok = setLine(activeLineIndex, updated);
    if (ok) {
      activeCursorPos = nextPos;
    }
    return ok;
  }

  function clearActivePage() {
    takeSnapshot();
    pages[currentPageIndex] = '';
    saveToLocalStorage();
  }

  function centerActiveLine() {
    const line = currentLines[activeLineIndex];
    if (!line || !line.trim()) return;
    const centered = centerLineText(line, BOOK_TEXT_WIDTH);
    setLine(activeLineIndex, centered);
  }

  function nextPage() {
    if (currentPageIndex < pages.length - 1) {
      currentPageIndex++;
    } else if (pages.length < MINECRAFT_MAX_PAGES) {
      takeSnapshot();
      pages = [...pages, ''];
      currentPageIndex++;
      saveToLocalStorage();
    }
  }

  function prevPage() {
    if (currentPageIndex > 0) {
      currentPageIndex--;
    }
  }

  function goToPage(idx: number) {
    if (idx >= 0 && idx < pages.length) {
      currentPageIndex = idx;
    }
  }

  function addBlankPage() {
    if (pages.length >= MINECRAFT_MAX_PAGES) return;
    takeSnapshot();
    pages = [...pages, ''];
    currentPageIndex = pages.length - 1;
    saveToLocalStorage();
  }

  function deleteCurrentPage() {
    if (pages.length <= 1) {
      clearActivePage();
      return;
    }
    takeSnapshot();
    pages = pages.filter((_, i) => i !== currentPageIndex);
    if (currentPageIndex >= pages.length) {
      currentPageIndex = pages.length - 1;
    }
    saveToLocalStorage();
  }

  function undo() {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    undoStack = undoStack.slice(0, -1);
    redoStack = [...redoStack, { title, author, pages: [...pages] }];

    title = prev.title;
    author = prev.author;
    pages = [...prev.pages];
    if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
    saveToLocalStorage();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    redoStack = redoStack.slice(0, -1);
    undoStack = [...undoStack, { title, author, pages: [...pages] }];

    title = next.title;
    author = next.author;
    pages = [...next.pages];
    if (currentPageIndex >= pages.length) currentPageIndex = pages.length - 1;
    saveToLocalStorage();
  }

  function loadBook(newBook: BlockgameBook, targetWidth = BOOK_TEXT_WIDTH) {
    takeSnapshot();
    const normalized = normalizeBook(newBook, { maxWidth: targetWidth });
    title = normalized.title;
    author = normalized.author;
    pages = [...normalized.pages];
    currentPageIndex = 0;
    activeLineIndex = 0;
    saveToLocalStorage();
  }

  return {
    get title() { return title; },
    set title(v: string) { title = v; saveToLocalStorage(); },
    get author() { return author; },
    set author(v: string) { author = v; saveToLocalStorage(); },
    get pages() { return pages; },
    get currentPageIndex() { return currentPageIndex; },
    set currentPageIndex(idx: number) { goToPage(idx); },
    get activeLineIndex() { return activeLineIndex; },
    set activeLineIndex(idx: number) { activeLineIndex = idx; },
    get activeCursorPos() { return activeCursorPos; },
    set activeCursorPos(pos: number | null) { activeCursorPos = pos; },
    get currentPageText() { return currentPageText; },
    get currentLines() { return currentLines; },
    get lineMetrics() { return lineMetrics; },
    get totalPageChars() { return totalPageChars; },
    get isCharLimitExceeded() { return isCharLimitExceeded; },
    get unsupportedChars() { return unsupportedChars; },
    get canUndo() { return undoStack.length > 0; },
    get canRedo() { return redoStack.length > 0; },
    setLine,
    insertAtCursor,
    setPageText,
    clearActivePage,
    centerActiveLine,
    nextPage,
    prevPage,
    goToPage,
    addBlankPage,
    deleteCurrentPage,
    undo,
    redo,
    loadBook,
    takeSnapshot,
  };
}

export const bookStore = createBookStore();
