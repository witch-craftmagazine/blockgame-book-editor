<script lang="ts">
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';
  import { SYMBOL_CHAT_FONTS, transformWithFont } from '../../data/symbolChatFonts';

  function applyFontToSelection() {
    if (bookStore.activeFontId === 'normal') {
      uiStore.showToast('Select a stylized font from the chips/dropdown first', 'info');
      return;
    }
    let count = 0;
    bookStore.selectedLineIndices.forEach(idx => {
      const cur = bookStore.currentLines[idx] ?? '';
      const converted = transformWithFont(cur, bookStore.activeFontId);
      if (converted !== cur) {
        bookStore.setLine(idx, converted);
        count++;
      }
    });
    uiStore.showToast(`Applied ${bookStore.activeFontId} font to ${count || bookStore.selectedLineIndices.size} line(s)`, 'success');
  }
</script>

<section class="panel-font-switcher" id="panel-font-switcher" aria-label="Symbol Chat Font Switcher">
  <div class="font-switcher-header">
    <div class="header-left">
      <span class="panel-title">
        <span class="font-icon">🔤</span> Font Switcher
      </span>
      <span class="font-badge">Active: {bookStore.activeFontId === 'normal' ? 'Normal' : bookStore.activeFontId}</span>
    </div>
    <div class="header-actions">
      <button
        type="button"
        class="btn-font-apply"
        onclick={applyFontToSelection}
        title="Apply active font style to selected line(s)"
      >
        ⚡ Transform Lines
      </button>
    </div>
  </div>

  <div class="font-switcher-body font-switcher-ribbon" id="font-switcher-ribbon" role="toolbar" aria-label="Symbol Chat Font Switcher">
    <div class="font-select-group">
      <label for="font-switcher-select-svelte" class="font-ribbon-label">Style:</label>
      <select id="font-switcher-select-svelte" class="font-select" bind:value={bookStore.activeFontId}>
        <option value="normal">Normal</option>
        {#each SYMBOL_CHAT_FONTS as f}
          <option value={f.id}>{f.name} ({f.sample})</option>
        {/each}
      </select>
    </div>
    <div class="font-quick-chips">
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'normal'} onclick={() => bookStore.activeFontId = 'normal'}>Normal</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'small_caps'} onclick={() => bookStore.activeFontId = 'small_caps'}>ꜱᴍᴀʟʟ</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'fullwidth'} onclick={() => bookStore.activeFontId = 'fullwidth'}>Ｆｕｌｌ</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'circled'} onclick={() => bookStore.activeFontId = 'circled'}>Ⓒⓘⓡ</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'superscript'} onclick={() => bookStore.activeFontId = 'superscript'}>ˢᵘᵖ</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'fraktur'} onclick={() => bookStore.activeFontId = 'fraktur'}>𝔉𝔯𝔞</button>
      <button type="button" class="font-chip" class:active={bookStore.activeFontId === 'script'} onclick={() => bookStore.activeFontId = 'script'}>𝒮𝒸𝓇</button>
    </div>
  </div>
</section>

<style>
  .panel-font-switcher {
    flex: 0 0 auto;
    background: var(--bg-panel, #16151a);
    border: 1px solid var(--border-color, #2d2b36);
    border-radius: 8px;
    padding: 8px 12px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .font-switcher-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border-color, #2d2b36);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-main, #f0e6d2);
    display: flex;
    align-items: center;
    gap: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .font-badge {
    font-size: 10px;
    font-weight: 600;
    color: var(--accent, #90caf9);
    background: rgba(144, 202, 249, 0.12);
    padding: 1px 6px;
    border-radius: 3px;
    font-family: monospace;
  }

  .header-actions {
    display: flex;
    align-items: center;
  }

  .font-switcher-body {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .font-select-group {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .font-ribbon-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted, #9e9ba8);
  }

  .font-select {
    background: var(--bg-card, #201f26);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 4px;
    padding: 3px 6px;
    font-size: 11px;
    outline: none;
    cursor: pointer;
  }

  .font-quick-chips {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
  }

  .font-chip {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 3px;
    padding: 2px 6px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .font-chip:hover {
    background: var(--btn-hover, #3a3746);
  }

  .font-chip.active {
    border-color: var(--accent, #90caf9);
    color: var(--accent, #90caf9);
    background: rgba(144, 202, 249, 0.1);
    font-weight: 700;
  }

  .btn-font-apply {
    background: var(--accent, #90caf9);
    color: #0d0c10;
    border: none;
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
    white-space: nowrap;
  }

  .btn-font-apply:hover {
    opacity: 0.9;
  }

  @media (max-width: 768px) {
    .panel-font-switcher {
      margin: 0 4px 6px;
      padding: 6px 8px;
    }
  }
</style>
