<script lang="ts">
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';
  import BookCanvas from './BookCanvas.svelte';
  import SplitButton from '../common/SplitButton.svelte';
</script>

<div class="preview-panel">
  <div class="preview-header">
    <div class="header-left">
      <span class="panel-title">Book Preview</span>
      <span class="mode-badge">{uiStore.viewMode === 'single' ? '1-Page' : '2-Page'}</span>
    </div>

    <div class="preview-nav-controls">
      <button
        type="button"
        class="nav-btn"
        disabled={bookStore.currentPageIndex <= 0}
        onclick={() => bookStore.prevPage()}
        title="Previous Page (ArrowLeft)"
      >
        ◀
      </button>

      <span class="page-badge">
        Page {bookStore.currentPageIndex + 1} / {bookStore.pages.length}
      </span>

      <button
        type="button"
        class="nav-btn"
        onclick={() => bookStore.nextPage()}
        title="Next Page (ArrowRight)"
      >
        ▶
      </button>

      <div class="split-wrapper">
        <SplitButton />
      </div>
    </div>

    <div class="header-right">
      <button
        type="button"
        class="view-toggle-btn"
        onclick={() => uiStore.toggleViewMode()}
        title="Toggle Single / Spread View"
      >
        {uiStore.viewMode === 'single' ? '📖 Spread' : '📄 Single'}
      </button>

      <button
        type="button"
        class="btn-icon"
        onclick={() => bookStore.addBlankPage()}
        title="Add Page at End"
      >
        + Add
      </button>

      <button
        type="button"
        class="btn-icon warn"
        onclick={() => bookStore.deleteCurrentPage()}
        title="Delete Current Page"
      >
        🗑
      </button>
    </div>
  </div>

  <div class="preview-body">
    <BookCanvas />
  </div>
</div>

<style>
  .preview-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel, #16151a);
    border: 1px solid var(--border-color, #2d2b36);
    border-radius: 8px;
    padding: 16px;
    box-sizing: border-box;
  }

  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-color, #2d2b36);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #f0e6d2);
  }

  .mode-badge {
    font-size: 10px;
    font-weight: 600;
    background: var(--bg-card, #23222a);
    color: var(--text-muted, #9e9ba8);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .preview-nav-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-btn {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .page-badge {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main, #f0e6d2);
    min-width: 90px;
    text-align: center;
  }

  .split-wrapper {
    margin-left: 6px;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .view-toggle-btn, .btn-icon {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-icon.warn:hover {
    background: #3e221d;
    color: #ffab91;
  }

  .preview-body {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card, #121116);
    border-radius: 6px;
    overflow: hidden;
  }
</style>
