<script lang="ts">
  import { uiStore } from '../../state/uiStore.svelte';
  import { libraryStore, type LibraryFilter } from '../../state/libraryStore.svelte';
  import PresetCard from '../library/PresetCard.svelte';

  const FILTERS: { id: LibraryFilter; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'page', label: 'Pages' },
    { id: 'lines', label: 'Lines / Snippets' },
    { id: 'kaomoji', label: 'Kaomoji' },
    { id: 'preset', label: 'Built-in Presets' },
    { id: 'custom', label: 'My Saves' },
  ];
</script>

{#if uiStore.isPresetsDrawerOpen}
  <aside class="floating-drawer" aria-label="Presets and Saved Art Drawer">
    <div class="drawer-header">
      <div class="header-left">
        <span class="drawer-title">🎨 Presets & Saved Art</span>
        
        <div class="filter-chips">
          {#each FILTERS as f}
            <button
              type="button"
              class="chip-btn"
              class:active={libraryStore.activeFilter === f.id}
              onclick={() => libraryStore.activeFilter = f.id}
            >
              {f.label}
            </button>
          {/each}
        </div>
      </div>

      <div class="header-right">
        {#if libraryStore.hiddenCount > 0}
          <button
            type="button"
            class="btn-reset"
            onclick={() => libraryStore.resetAllPresets()}
            title="Restore hidden built-in presets"
          >
            ↺ Restore Hidden ({libraryStore.hiddenCount})
          </button>
        {/if}

        <button
          type="button"
          class="btn-close"
          aria-label="Close presets drawer"
          onclick={() => uiStore.isPresetsDrawerOpen = false}
        >
          ✕
        </button>
      </div>
    </div>

    <div class="drawer-content">
      {#if libraryStore.filteredItems.length === 0}
        <div class="empty-state">No presets match the selected filter.</div>
      {:else}
        <div class="cards-grid">
          {#each libraryStore.filteredItems as template (template.id)}
            <PresetCard {template} />
          {/each}
        </div>
      {/if}
    </div>
  </aside>
{/if}

<style>
  .floating-drawer {
    position: fixed;
    bottom: 0;
    left: 12px;
    right: 12px;
    height: 280px;
    background: var(--bg-panel, #18171d);
    border: 1px solid var(--border-color, #383542);
    border-bottom: none;
    border-radius: 12px 12px 0 0;
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.5);
    z-index: 100;
    display: flex;
    flex-direction: column;
    animation: slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  @keyframes slide-up {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    border-bottom: 1px solid var(--border-color, #2d2b36);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .drawer-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-main, #f0e6d2);
  }

  .filter-chips {
    display: flex;
    gap: 6px;
  }

  .chip-btn {
    background: var(--bg-card, #23222a);
    color: var(--text-muted, #9e9ba8);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .chip-btn.active {
    background: var(--btn-hover, #3d3b4a);
    color: var(--accent, #90caf9);
    border-color: var(--accent, #90caf9);
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-reset {
    background: transparent;
    color: var(--accent, #90caf9);
    border: 1px solid var(--border-color, #383542);
    border-radius: 4px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .btn-close {
    background: transparent;
    color: var(--text-muted, #9e9ba8);
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 2px 6px;
  }

  .btn-close:hover {
    color: var(--text-main, #f0e6d2);
  }

  .drawer-content {
    flex: 1;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 12px 16px;
  }

  .cards-grid {
    display: flex;
    gap: 12px;
    height: 100%;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #9e9ba8);
    font-size: 13px;
  }

  @media (max-width: 768px) {
    .floating-drawer {
      bottom: auto;
      top: 200px;
      left: 8px;
      right: 8px;
      height: 195px;
      max-height: 195px;
      border-radius: 8px;
      border-bottom: 1px solid var(--border-color, #383542);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.7);
      animation: drawer-slide-down 0.18s ease-out;
    }

    @keyframes drawer-slide-down {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .drawer-header {
      padding: 6px 10px;
    }

    .header-left {
      gap: 8px;
    }

    .drawer-title {
      font-size: 11px;
    }

    .filter-chips {
      gap: 4px;
      overflow-x: auto;
    }

    .chip-btn {
      padding: 2px 6px;
      font-size: 10px;
    }

    .btn-reset {
      display: none;
    }

    .drawer-content {
      padding: 6px 10px;
    }

    .cards-grid {
      gap: 8px;
    }
  }
</style>
