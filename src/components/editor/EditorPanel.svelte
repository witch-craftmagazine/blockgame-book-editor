<script lang="ts">
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';
  import FormattingBar from './FormattingBar.svelte';

  function updateCursor(target: HTMLInputElement) {
    bookStore.activeCursorPos = target.selectionStart;
  }

  function handleLineInput(idx: number, e: Event) {
    const target = e.target as HTMLInputElement;
    const ok = bookStore.setLine(idx, target.value);
    if (!ok) {
      uiStore.showToast('Page character limit (1024) exceeded', 'warn');
      target.value = bookStore.currentLines[idx] ?? '';
    }
    updateCursor(target);
  }

  function handleLineFocus(idx: number, e: FocusEvent) {
    bookStore.activeLineIndex = idx;
    const target = e.target as HTMLInputElement;
    updateCursor(target);
  }

  function handleLineCursorChange(e: Event) {
    const target = e.target as HTMLInputElement;
    updateCursor(target);
  }
</script>

<div class="editor-panel">
  <div class="meta-inputs">
    <div class="input-group">
      <label for="book-title">Title</label>
      <input
        id="book-title"
        type="text"
        bind:value={bookStore.title}
        placeholder="Untitled Book"
        maxlength="32"
      />
    </div>

    <div class="input-group">
      <label for="book-author">Author</label>
      <input
        id="book-author"
        type="text"
        bind:value={bookStore.author}
        placeholder="Author"
        maxlength="16"
      />
    </div>
  </div>

  <FormattingBar />

  <!-- Mobile Focused Line Deck with Traffic Light Dot Indicator -->
  <div class="mobile-line-deck">
    <div class="mobile-line-header">
      <div class="mobile-line-nav">
        <button
          type="button"
          class="stepper-btn"
          disabled={bookStore.activeLineIndex <= 0}
          onclick={() => { bookStore.activeLineIndex = Math.max(0, bookStore.activeLineIndex - 1); }}
        >▲</button>
        <span class="mobile-line-pill">Line {bookStore.activeLineIndex + 1} / 14</span>
        <button
          type="button"
          class="stepper-btn"
          disabled={bookStore.activeLineIndex >= 13}
          onclick={() => { bookStore.activeLineIndex = Math.min(13, bookStore.activeLineIndex + 1); }}
        >▼</button>
      </div>
      <div class="mobile-traffic-dot-wrap" title="Width traffic light indicator">
        {#if bookStore.lineMetrics[bookStore.activeLineIndex]}
          {@const activeMetric = bookStore.lineMetrics[bookStore.activeLineIndex]!}
          {@const isOver = activeMetric.isOverWidth}
          {@const isWarn = activeMetric.width >= 102 && !isOver}
          <span
            class="mobile-traffic-dot"
            class:dot-ok={!isOver && !isWarn}
            class:dot-warn={isWarn}
            class:dot-overflow={isOver}
          ></span>
        {/if}
      </div>
    </div>
    <div class="mobile-line-input-wrap">
      <input
        type="text"
        class="mobile-line-input"
        placeholder="Type line {bookStore.activeLineIndex + 1} text…"
        value={bookStore.currentLines[bookStore.activeLineIndex] ?? ''}
        oninput={(e) => handleLineInput(bookStore.activeLineIndex, e)}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (bookStore.activeLineIndex < 13) bookStore.activeLineIndex++;
          }
        }}
        onclick={handleLineCursorChange}
        onkeyup={handleLineCursorChange}
        spellcheck="false"
        autocomplete="off"
      />
    </div>
  </div>

  <div class="lines-container" role="region" aria-label="Minecraft 14-Line Editor">
    {#each bookStore.lineMetrics as metric, idx}
      <div class="line-row" class:active={bookStore.activeLineIndex === idx}>
        <span class="line-number">{idx + 1}</span>
        
        <div class="input-wrapper">
          <input
            type="text"
            class="line-input"
            class:overflown={metric.isOverWidth}
            value={metric.text}
            oninput={(e) => handleLineInput(idx, e)}
            onfocus={(e) => handleLineFocus(idx, e)}
            onclick={handleLineCursorChange}
            onkeyup={handleLineCursorChange}
            spellcheck="false"
            autocomplete="off"
          />

          <div class="line-ruler-bar" style="width: {Math.min(100, (metric.width / 114) * 100)}%;"></div>
        </div>

        <span class="line-px-badge" class:overflown={metric.isOverWidth}>
          {metric.width}px
        </span>
      </div>
    {/each}
  </div>

  <div class="editor-footer">
    <div class="stats-left">
      <span class="stat-badge" class:warn={bookStore.isCharLimitExceeded}>
        {bookStore.totalPageChars} / 1024 chars
      </span>

      {#if bookStore.unsupportedChars.count > 0}
        <span class="stat-badge warn" title="SMP characters render as missing glyph boxes in vanilla Minecraft">
          ⚠️ {bookStore.unsupportedChars.count} SMP glyph(s) &gt;U+FFFF ({bookStore.unsupportedChars.chars.slice(0, 3).join('')})
        </span>
      {/if}
    </div>

    <div class="history-controls">
      <button
        type="button"
        class="btn-tool"
        disabled={!bookStore.canUndo}
        onclick={() => bookStore.undo()}
        title="Undo (Ctrl+Z)"
      >
        ↶ Undo
      </button>

      <button
        type="button"
        class="btn-tool"
        disabled={!bookStore.canRedo}
        onclick={() => bookStore.redo()}
        title="Redo (Ctrl+Y)"
      >
        ↷ Redo
      </button>
    </div>
  </div>
</div>

<style>
  .editor-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-panel, #16151a);
    border: 1px solid var(--border-color, #2d2b36);
    border-radius: 8px;
    padding: 16px;
    box-sizing: border-box;
  }

  .meta-inputs {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
  }

  .input-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .input-group label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-muted, #9e9ba8);
  }

  .input-group input {
    background: var(--bg-card, #201f26);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 8px 10px;
    font-size: 13px;
    color: var(--text-main, #f0e6d2);
    outline: none;
    transition: border-color 0.15s ease;
  }

  .input-group input:focus {
    border-color: var(--accent, #90caf9);
  }

  .lines-container {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    overflow-y: auto;
  }

  .line-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px;
    border-radius: 4px;
    transition: background 0.1s ease;
  }

  .line-row.active {
    background: rgba(255, 255, 255, 0.04);
  }

  .line-number {
    font-size: 11px;
    font-family: monospace;
    color: var(--text-muted, #6d6a78);
    width: 18px;
    text-align: right;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
  }

  .line-input {
    width: 100%;
    background: var(--bg-card, #1f1e24);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 4px;
    padding: 5px 8px;
    font-family: 'Minecraft', monospace;
    font-size: 13px;
    color: var(--text-main, #f0e6d2);
    outline: none;
    box-sizing: border-box;
  }

  .line-input:focus {
    border-color: var(--accent, #90caf9);
    background: var(--bg-hover, #282630);
  }

  .line-input.overflown {
    border-color: #d32f2f;
    background: rgba(211, 47, 47, 0.1);
  }

  .line-ruler-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--accent, #90caf9);
    border-radius: 0 0 0 4px;
    pointer-events: none;
    opacity: 0.6;
  }

  .line-px-badge {
    font-size: 11px;
    font-family: monospace;
    color: var(--text-muted, #9e9ba8);
    width: 44px;
    text-align: right;
  }

  .line-px-badge.overflown {
    color: #ef5350;
    font-weight: 700;
  }

  .editor-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid var(--border-color, #2d2b36);
  }

  .stats-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-badge {
    font-size: 11px;
    padding: 3px 6px;
    border-radius: 4px;
    background: var(--bg-card, #23222a);
    color: var(--text-muted, #9e9ba8);
  }

  .stat-badge.warn {
    background: rgba(244, 67, 54, 0.15);
    color: #ef5350;
    font-weight: 600;
  }

  .history-controls {
    display: flex;
    gap: 6px;
  }

  .btn-tool {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-tool:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .mobile-line-deck {
    display: none;
  }

  @media (max-width: 768px) {
    .lines-container {
      display: none !important;
    }

    .meta-inputs {
      display: none !important;
    }

    .editor-footer {
      display: none !important;
    }

    .mobile-line-deck {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 10px;
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .mobile-line-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .mobile-line-nav {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .stepper-btn {
      background: var(--btn-bg);
      border: 1px solid var(--border-color);
      color: var(--text-main);
      border-radius: 4px;
      padding: 2px 8px;
      cursor: pointer;
    }

    .mobile-line-pill {
      font-family: monospace;
      font-size: 13px;
      font-weight: 700;
      color: var(--accent);
      background: var(--bg-toolbar);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .mobile-traffic-dot-wrap {
      display: flex;
      align-items: center;
      padding-right: 4px;
    }

    .mobile-traffic-dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      transition: background-color 0.2s, box-shadow 0.2s;
    }

    .mobile-traffic-dot.dot-ok {
      background-color: #55ff55;
      box-shadow: 0 0 6px rgba(85, 255, 85, 0.6);
    }

    .mobile-traffic-dot.dot-warn {
      background-color: #ffaa00;
      box-shadow: 0 0 6px rgba(255, 170, 0, 0.6);
    }

    .mobile-traffic-dot.dot-overflow {
      background-color: #ff5555;
      box-shadow: 0 0 8px rgba(255, 85, 85, 0.8);
    }

    .mobile-line-input {
      width: 100%;
      box-sizing: border-box;
      height: 38px;
      padding: 6px 10px;
      font-family: 'Minecraft', monospace;
      font-size: 14px;
      background: var(--bg-root);
      color: var(--text-main);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      outline: none;
    }

    .mobile-line-input:focus {
      border-color: var(--accent);
    }
  }
</style>
