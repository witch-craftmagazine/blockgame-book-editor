<script lang="ts">
  import { onMount } from 'svelte';
  import { glyphStore } from '../../state/glyphStore.svelte';
  import { bookStore } from '../../state/bookStore.svelte';
  import { CATEGORY_DEFINITIONS, type GlyphCategory, findGlyphItem } from '../../data/symbolChatDataset';
  import GlyphTile from './GlyphTile.svelte';
  import GlyphCanvas from './GlyphCanvas.svelte';
  import { getCharPixelAdvance } from './glyphRenderer';

  const PREVIEW_PALETTE = [
    { name: 'Dark Slate', hex: '#1D1D21' },
    { name: 'Pure White', hex: '#FFFFFF' },
    { name: 'Gold', hex: '#FFAA00' },
    { name: 'Aqua', hex: '#55FFFF' },
    { name: 'Green', hex: '#55FF55' },
    { name: 'Red', hex: '#FF5555' },
    { name: 'Light Purple', hex: '#FF55FF' },
  ];

  let searchInputEl: HTMLInputElement | null = $state(null);

  // Inspector item falls back to the first favorite or first item
  const inspectorItem = $derived.by(() => {
    if (glyphStore.inspectorGlyph) return glyphStore.inspectorGlyph;
    if (glyphStore.filteredGlyphs.length > 0) return glyphStore.filteredGlyphs[0];
    return findGlyphItem('★');
  });

  const inspectorAdvance = $derived(getCharPixelAdvance(inspectorItem.char));

  function handleClose() {
    glyphStore.close();
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  }

  function handleQuickInsert(char: string) {
    bookStore.insertAtCursor(char);
    glyphStore.addRecent(char);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });

  $effect(() => {
    if (glyphStore.isOpen && searchInputEl) {
      setTimeout(() => searchInputEl?.focus(), 50);
    }
  });
</script>

{#if glyphStore.isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="glyph-modal-backdrop" onclick={handleBackdropClick}>
    <div class="glyph-modal-container" role="dialog" aria-modal="true" aria-label="Symbol Chat Glyph Browser">
      
      <!-- 1. Header -->
      <div class="modal-header">
        <div class="header-title-row">
          <span class="header-icon">✦</span>
          <h2 class="header-title">GLYPH BROWSER <span class="tag">Symbol Chat</span></h2>
        </div>

        <button
          type="button"
          class="btn-close"
          onclick={handleClose}
          aria-label="Close glyph browser"
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      <!-- 2. Search & Filter Bar -->
      <div class="search-bar-row">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input
            bind:this={searchInputEl}
            type="text"
            class="search-input"
            placeholder="Search glyphs by name, symbol, or hex (e.g. sword, 2694, ⚔)..."
            bind:value={glyphStore.searchQuery}
          />
          {#if glyphStore.searchQuery.length > 0}
            <button
              type="button"
              class="search-clear-btn"
              onclick={() => glyphStore.searchQuery = ''}
              title="Clear search"
            >
              ✕
            </button>
          {/if}
        </div>
      </div>

      <!-- 3. Category Tabs -->
      <div class="category-tabs-container" role="tablist">
        {#each CATEGORY_DEFINITIONS as cat}
          <button
            type="button"
            role="tab"
            class="cat-tab-btn"
            class:active={glyphStore.activeCategory === cat.id && glyphStore.searchQuery.length === 0}
            onclick={() => glyphStore.setCategory(cat.id)}
            title={cat.description}
            aria-selected={glyphStore.activeCategory === cat.id}
          >
            <span class="tab-icon">{cat.icon}</span>
            <span class="tab-label">{cat.label}</span>
            {#if cat.id === 'fav'}
              <span class="tab-badge">{glyphStore.favorites.length}</span>
            {:else if cat.id === 'recent'}
              <span class="tab-badge">{glyphStore.recents.length}</span>
            {/if}
          </button>
        {/each}
      </div>

      <!-- 4. Quick Favorites Strip -->
      {#if glyphStore.favorites.length > 0 && glyphStore.activeCategory !== 'fav'}
        <div class="quick-favorites-strip">
          <span class="strip-label">⭐ Quick Favs:</span>
          <div class="strip-list">
            {#each glyphStore.favorites.slice(0, 16) as favChar}
              <button
                type="button"
                class="quick-fav-chip"
                onclick={() => handleQuickInsert(favChar)}
                title="Quick insert {favChar}"
              >
                {favChar}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- 5. High-Density Glyph Grid -->
      <div class="grid-scroll-area">
        {#if glyphStore.filteredGlyphs.length === 0}
          <div class="empty-state">
            {#if glyphStore.searchQuery.length > 0}
              <p>No glyphs matching "{glyphStore.searchQuery}"</p>
            {:else if glyphStore.activeCategory === 'fav'}
              <p>No favorites yet! Click the star <strong>☆</strong> on any glyph tile to add it here.</p>
            {:else if glyphStore.activeCategory === 'recent'}
              <p>No recent glyphs yet. Click any glyph to insert it into your active book line.</p>
            {/if}
          </div>
        {:else}
          <div class="glyph-grid">
            {#each glyphStore.filteredGlyphs as item (item.char)}
              <GlyphTile {item} previewColor={glyphStore.previewColor} />
            {/each}
          </div>
        {/if}
      </div>

      <!-- 6. Inspector & Status Footer -->
      <div class="inspector-footer">
        <div class="inspector-left">
          <div class="inspector-preview-box">
            {#if inspectorItem.category === 'kaomoji'}
              <span class="inspector-kaomoji">{inspectorItem.char}</span>
            {:else}
              <GlyphCanvas
                char={inspectorItem.char}
                colorHex={glyphStore.previewColor}
                size={40}
                scale={3}
              />
            {/if}
          </div>

          <div class="inspector-meta">
            <div class="inspector-name-row">
              <span class="inspector-name">{inspectorItem.name}</span>
              <span class="inspector-char">{inspectorItem.char}</span>
            </div>
            <div class="inspector-details-row">
              <span class="detail-tag">{inspectorItem.codepoint}</span>
              <span class="detail-tag">{inspectorAdvance}px width</span>
              {#if inspectorItem.isSmp}
                <span class="detail-tag warn">⚠️ SMP (&gt;U+FFFF) Vanilla Box</span>
              {:else}
                <span class="detail-tag success">✓ Vanilla Java BMP</span>
              {/if}
            </div>
          </div>
        </div>

        <div class="inspector-right">
          <span class="tint-label">Preview Tint:</span>
          <div class="tint-swatches" role="group" aria-label="Preview Color Tint">
            {#each PREVIEW_PALETTE as swatch}
              <button
                type="button"
                class="tint-swatch-btn"
                class:active={glyphStore.previewColor === swatch.hex}
                style="background-color: {swatch.hex};"
                title="Preview tint: {swatch.name}"
                onclick={() => glyphStore.setPreviewColor(swatch.hex)}
              ></button>
            {/each}
          </div>
        </div>
      </div>

    </div>
  </div>
{/if}

<style>
  .glyph-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.72);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    box-sizing: border-box;
    animation: fadeIn 0.15s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .glyph-modal-container {
    width: 780px;
    max-width: 95vw;
    height: 600px;
    max-height: 92vh;
    background: var(--bg-panel, #16151a);
    border: 1px solid var(--border-color, #383542);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
    overflow: hidden;
  }

  /* 1. Header */
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-header, #1b1a20);
    border-bottom: 1px solid var(--border-color, #383542);
  }

  .header-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-icon {
    color: var(--accent, #90caf9);
    font-size: 16px;
  }

  .header-title {
    margin: 0;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--text-main, #f0e6d2);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title .tag {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
    background: rgba(144, 202, 249, 0.15);
    color: var(--accent, #90caf9);
    text-transform: uppercase;
  }

  .btn-close {
    background: transparent;
    border: none;
    color: var(--text-muted, #9e9ba8);
    font-size: 16px;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .btn-close:hover {
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-main, #f0e6d2);
  }

  /* 2. Search */
  .search-bar-row {
    padding: 10px 16px;
    background: var(--bg-panel, #16151a);
    border-bottom: 1px solid var(--border-color, #2d2b36);
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-icon {
    position: absolute;
    left: 10px;
    font-size: 13px;
    color: var(--text-muted, #9e9ba8);
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    background: var(--bg-card, #201f26);
    border: 1px solid var(--border-color, #383542);
    border-radius: 6px;
    padding: 8px 32px 8px 32px;
    font-size: 13px;
    color: var(--text-main, #f0e6d2);
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    border-color: var(--accent, #90caf9);
  }

  .search-clear-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: var(--text-muted, #9e9ba8);
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
  }

  /* 3. Category Tabs */
  .category-tabs-container {
    display: flex;
    gap: 4px;
    padding: 6px 12px;
    background: var(--bg-toolbar, #1e1d24);
    border-bottom: 1px solid var(--border-color, #2d2b36);
    overflow-x: auto;
    scrollbar-width: thin;
  }

  .cat-tab-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 9px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 5px;
    color: var(--text-muted, #9e9ba8);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.1s ease, color 0.1s ease;
  }

  .cat-tab-btn:hover {
    background: var(--bg-hover, #2d2b36);
    color: var(--text-main, #f0e6d2);
  }

  .cat-tab-btn.active {
    background: var(--btn-bg, #2a2833);
    border-color: var(--border-color, #383542);
    color: var(--accent, #90caf9);
    font-weight: 600;
  }

  .tab-icon {
    font-size: 13px;
  }

  .tab-badge {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-muted, #b3afbe);
    border-radius: 8px;
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 600;
  }

  /* 4. Quick Favs */
  .quick-favorites-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    background: rgba(255, 215, 0, 0.04);
    border-bottom: 1px solid var(--border-color, #2d2b36);
    overflow-x: auto;
  }

  .strip-label {
    font-size: 11px;
    font-weight: 600;
    color: #ffca28;
    white-space: nowrap;
  }

  .strip-list {
    display: flex;
    gap: 4px;
    align-items: center;
  }

  .quick-fav-chip {
    width: 26px;
    height: 26px;
    background: var(--bg-card, #201f26);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 4px;
    color: var(--text-main, #f0e6d2);
    font-size: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.1s ease, transform 0.08s ease;
    padding: 0;
  }

  .quick-fav-chip:hover {
    background: var(--bg-hover, #2d2b36);
    border-color: #ffca28;
    transform: scale(1.1);
  }

  /* 5. Main Grid */
  .grid-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    scrollbar-width: thin;
  }

  .glyph-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(44px, 1fr));
    gap: 6px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text-muted, #9e9ba8);
    font-size: 13px;
    text-align: center;
    padding: 32px;
  }

  /* 6. Inspector Footer */
  .inspector-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--bg-header, #1b1a20);
    border-top: 1px solid var(--border-color, #383542);
  }

  .inspector-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .inspector-preview-box {
    width: 44px;
    height: 44px;
    background: var(--bg-card, #201f26);
    border: 1px solid var(--border-color, #383542);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .inspector-kaomoji {
    font-size: 11px;
    font-family: 'Minecraft', monospace;
    color: var(--text-main, #f0e6d2);
  }

  .inspector-meta {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .inspector-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .inspector-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-main, #f0e6d2);
  }

  .inspector-char {
    font-size: 13px;
    color: var(--accent, #90caf9);
    font-weight: bold;
  }

  .inspector-details-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .detail-tag {
    font-size: 10px;
    font-family: monospace;
    padding: 2px 6px;
    background: var(--bg-card, #23222a);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 3px;
    color: var(--text-muted, #9e9ba8);
  }

  .detail-tag.success {
    color: #81c784;
    border-color: rgba(129, 199, 132, 0.3);
  }

  .detail-tag.warn {
    color: #ffb74d;
    border-color: rgba(255, 183, 77, 0.3);
  }

  .inspector-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tint-label {
    font-size: 11px;
    color: var(--text-muted, #9e9ba8);
  }

  .tint-swatches {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .tint-swatch-btn {
    width: 18px;
    height: 18px;
    border-radius: 3px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    cursor: pointer;
    padding: 0;
    transition: transform 0.1s ease, border-color 0.1s ease;
  }

  .tint-swatch-btn:hover {
    transform: scale(1.2);
  }

  .tint-swatch-btn.active {
    border: 2px solid var(--accent, #90caf9);
    transform: scale(1.2);
  }
</style>
