<script lang="ts">
  import { uiStore } from '../../state/uiStore.svelte';
</script>

<header class="app-header">
  <div class="brand">
    <span class="icon">📖</span>
    <span class="title">Blockgame Book Studio</span>
    <span class="tag">Svelte 5</span>
  </div>

  <div class="header-actions">
    <button
      type="button"
      class="btn-header"
      onclick={() => uiStore.toggleTheme()}
      title="Toggle Light / Dark Theme"
    >
      {uiStore.theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>

    <button
      type="button"
      class="btn-header"
      class:active={uiStore.isPresetsDrawerOpen}
      onclick={() => uiStore.isPresetsDrawerOpen = !uiStore.isPresetsDrawerOpen}
    >
      🎨 Presets & Saved Art {uiStore.isPresetsDrawerOpen ? '▲' : '▼'}
    </button>
  </div>
</header>

<style>
  .app-header {
    height: 48px;
    background: var(--bg-header, #1b1a20);
    border-bottom: 1px solid var(--border-color, #2d2b36);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    box-sizing: border-box;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand .icon {
    font-size: 18px;
  }

  .brand .title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-main, #f0e6d2);
    letter-spacing: 0.3px;
  }

  .brand .tag {
    font-size: 10px;
    font-weight: 600;
    background: rgba(255, 62, 0, 0.15);
    color: #ff5722;
    padding: 2px 5px;
    border-radius: 4px;
    border: 1px solid rgba(255, 62, 0, 0.3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-header {
    background: var(--btn-bg, #2a2833);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-header:hover {
    background: var(--btn-hover, #3a3746);
  }

  .btn-header.active {
    border-color: var(--accent, #90caf9);
    color: var(--accent, #90caf9);
  }
</style>
