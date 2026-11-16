<script lang="ts">
  import { onMount } from 'svelte';
  import TopHeader from './components/layout/TopHeader.svelte';
  import EditorPanel from './components/editor/EditorPanel.svelte';
  import PreviewPanel from './components/preview/PreviewPanel.svelte';
  import BottomDrawer from './components/layout/BottomDrawer.svelte';
  import Toast from './components/common/Toast.svelte';
  import GlyphBrowser from './components/glyphs/GlyphBrowser.svelte';
  import { bookStore } from './state/bookStore.svelte';
  import { uiStore } from './state/uiStore.svelte';
  import { glyphStore } from './state/glyphStore.svelte';

  onMount(() => {
    // Sync initial theme
    document.documentElement.setAttribute('data-theme', uiStore.theme);

    // Global keyboard shortcuts
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        // Trigger quick copy
        const firstCopyBtn = document.querySelector('.btn-copy-main') as HTMLButtonElement;
        firstCopyBtn?.click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (!e.shiftKey) {
          // Undo
          if (bookStore.canUndo) {
            e.preventDefault();
            bookStore.undo();
            uiStore.showToast('Undo', 'info');
          }
        } else {
          // Redo
          if (bookStore.canRedo) {
            e.preventDefault();
            bookStore.redo();
            uiStore.showToast('Redo', 'info');
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        glyphStore.toggle();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        if (bookStore.canRedo) {
          e.preventDefault();
          bookStore.redo();
          uiStore.showToast('Redo', 'info');
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="app-root" data-theme={uiStore.theme}>
  <TopHeader />

  <main class="workspace">
    <div class="workspace-column left">
      <EditorPanel />
    </div>

    <div class="workspace-column right">
      <PreviewPanel />
    </div>
  </main>

  <BottomDrawer />
  <GlyphBrowser />
  <Toast />
</div>

<style>
  :global(:root) {
    --bg-root: #0d0c10;
    --bg-header: #1b1a20;
    --bg-panel: #16151a;
    --bg-card: #201f26;
    --bg-toolbar: #1e1d24;
    --bg-hover: #2d2b36;
    --border-color: #312f3b;
    --text-main: #f0e6d2;
    --text-muted: #9e9ba8;
    --btn-bg: #2a2833;
    --btn-hover: #3a3746;
    --accent: #90caf9;
  }

  :global([data-theme="light"]) {
    --bg-root: #f4f1ea;
    --bg-header: #e6e0d2;
    --bg-panel: #ede8dc;
    --bg-card: #f9f7f1;
    --bg-toolbar: #e4decfa0;
    --bg-hover: #ded6c3;
    --border-color: #cfc5b0;
    --text-main: #2b261f;
    --text-muted: #6e6454;
    --btn-bg: #ded7c6;
    --btn-hover: #cfc6b0;
    --accent: #1976d2;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background: var(--bg-root);
    color: var(--text-main);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    user-select: none;
    overflow: hidden;
  }

  .app-root {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
    background: var(--bg-root);
    box-sizing: border-box;
  }

  .workspace {
    flex: 1;
    display: flex;
    padding: 12px;
    gap: 12px;
    overflow: hidden;
    box-sizing: border-box;
  }

  .workspace-column {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .workspace-column.left {
    flex: 1.1;
    min-width: 440px;
  }

  .workspace-column.right {
    flex: 1.2;
    min-width: 440px;
  }
</style>
