<script lang="ts">
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';
  import SplitButton from '../common/SplitButton.svelte';

  const COLOR_SWATCHES = [
    { code: '§0', name: 'Black', hex: '#000000' },
    { code: '§1', name: 'Dark Blue', hex: '#0000AA' },
    { code: '§2', name: 'Dark Green', hex: '#00AA00' },
    { code: '§3', name: 'Dark Aqua', hex: '#00AAAA' },
    { code: '§4', name: 'Dark Red', hex: '#AA0000' },
    { code: '§5', name: 'Dark Purple', hex: '#AA00AA' },
    { code: '§6', name: 'Gold', hex: '#FFAA00' },
    { code: '§7', name: 'Gray', hex: '#AAAAAA' },
    { code: '§8', name: 'Dark Gray', hex: '#555555' },
    { code: '§9', name: 'Blue', hex: '#5555FF' },
    { code: '§a', name: 'Green', hex: '#55FF55' },
    { code: '§b', name: 'Aqua', hex: '#55FFFF' },
    { code: '§c', name: 'Red', hex: '#FF5555' },
    { code: '§d', name: 'Light Purple', hex: '#FF55FF' },
    { code: '§e', name: 'Yellow', hex: '#FFFF55' },
    { code: '§f', name: 'White', hex: '#FFFFFF' },
  ];

  const STYLE_CODES = [
    { code: '§l', label: 'B', title: 'Bold (§l)', class: 'bold' },
    { code: '§o', label: 'I', title: 'Italic (§o)', class: 'italic' },
    { code: '§n', label: 'U', title: 'Underline (§n)', class: 'underline' },
    { code: '§m', label: 'S', title: 'Strikethrough (§m)', class: 'strike' },
    { code: '§k', label: '?', title: 'Obfuscated (§k)', class: 'obfuscated' },
    { code: '§r', label: '✕ Reset', title: 'Reset Formatting (§r)', class: 'reset' },
  ];

  function insertFormatting(code: string) {
    const activeIdx = bookStore.activeLineIndex;
    const currentLine = bookStore.currentLines[activeIdx] ?? '';
    bookStore.setLine(activeIdx, currentLine + code);
  }
</script>

<div class="formatting-toolbar">
  <div class="swatches-group" role="toolbar" aria-label="Minecraft Colors">
    {#each COLOR_SWATCHES as swatch}
      <button
        type="button"
        class="swatch-btn"
        style="background-color: {swatch.hex};"
        title="{swatch.name} ({swatch.code})"
        onclick={() => insertFormatting(swatch.code)}
      ></button>
    {/each}
  </div>

  <div class="styles-group" role="toolbar" aria-label="Text Formatting">
    {#each STYLE_CODES as style}
      <button
        type="button"
        class="style-btn {style.class}"
        title={style.title}
        onclick={() => insertFormatting(style.code)}
      >
        {style.label}
      </button>
    {/each}
  </div>

  <div class="actions-group">
    <button
      type="button"
      class="action-btn"
      title="Center text on current line with optimal bold-space padding"
      onclick={() => bookStore.centerActiveLine()}
    >
      ≡ Center
    </button>

    <button
      type="button"
      class="action-btn warn"
      title="Clear all 14 lines on active page (Ctrl+Z to Undo)"
      onclick={() => bookStore.clearActivePage()}
    >
      🗑 Clear Page
    </button>

    <SplitButton />
  </div>
</div>

<style>
  .formatting-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-toolbar, #1e1d24);
    border: 1px solid var(--border-color, #383542);
    border-radius: 6px;
    margin-bottom: 12px;
  }

  .swatches-group {
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .swatch-btn {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s ease;
  }

  .swatch-btn:hover {
    transform: scale(1.2);
    z-index: 2;
  }

  .styles-group {
    display: flex;
    align-items: center;
    gap: 3px;
    border-left: 1px solid var(--border-color, #383542);
    padding-left: 8px;
  }

  .style-btn {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 3px;
    padding: 3px 7px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 500;
  }

  .style-btn:hover {
    background: var(--btn-hover, #3a3746);
  }

  .style-btn.bold { font-weight: 800; }
  .style-btn.italic { font-style: italic; }
  .style-btn.underline { text-decoration: underline; }
  .style-btn.strike { text-decoration: line-through; }
  .style-btn.reset { color: #ff8a80; }

  .actions-group {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
  }

  .action-btn {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 5px 9px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .action-btn:hover {
    background: var(--btn-hover, #3a3746);
  }

  .action-btn.warn {
    color: #ffab91;
  }

  .action-btn.warn:hover {
    background: #3e221d;
  }
</style>
