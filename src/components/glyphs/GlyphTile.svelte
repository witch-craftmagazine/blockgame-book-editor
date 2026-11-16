<script lang="ts">
  import { type GlyphItem } from '../../data/symbolChatDataset';
  import { glyphStore } from '../../state/glyphStore.svelte';
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';
  import GlyphCanvas from './GlyphCanvas.svelte';
  import { getCharPixelAdvance } from './glyphRenderer';

  interface Props {
    item: GlyphItem;
    previewColor?: string;
  }

  let { item, previewColor = '#f0e6d2' }: Props = $props();

  const isFav = $derived(glyphStore.isFavorite(item.char));
  const advance = $derived(getCharPixelAdvance(item.char));

  function handleInsert(e: MouseEvent) {
    e.stopPropagation();
    const ok = bookStore.insertAtCursor(item.char);
    glyphStore.addRecent(item.char);
    if (!ok) {
      uiStore.showToast('Page character limit (1024) exceeded', 'warn');
    }
  }

  function handleToggleStar(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    glyphStore.toggleFavorite(item.char);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    glyphStore.toggleFavorite(item.char);
  }

  function handleMouseEnter() {
    glyphStore.setInspectorGlyph(item);
  }
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="glyph-tile"
  class:is-fav={isFav}
  class:is-smp={item.isSmp}
  role="button"
  tabindex="0"
  onclick={handleInsert}
  oncontextmenu={handleContextMenu}
  onmouseenter={handleMouseEnter}
  title="{item.name} ({item.codepoint}) • {advance}px • Click to insert, Right-click to favorite"
>
  <button
    type="button"
    class="star-btn"
    class:starred={isFav}
    onclick={handleToggleStar}
    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
  >
    {isFav ? '★' : '☆'}
  </button>

  <div class="glyph-center">
    {#if item.category === 'kaomoji'}
      <span class="kaomoji-text">{item.char}</span>
    {:else}
      <GlyphCanvas char={item.char} colorHex={previewColor} size={26} scale={2} />
    {/if}
  </div>

  <span class="advance-badge" class:smp={item.isSmp}>
    {item.isSmp ? 'SMP' : `${advance}px`}
  </span>
</div>

<style>
  .glyph-tile {
    position: relative;
    width: 44px;
    height: 44px;
    background: var(--bg-card, #201f26);
    border: 1px solid var(--border-color, #312f3b);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-sizing: border-box;
    transition: background 0.12s ease, border-color 0.12s ease, transform 0.08s ease;
    user-select: none;
    overflow: hidden;
  }

  .glyph-tile:hover {
    background: var(--bg-hover, #2c2937);
    border-color: var(--accent, #90caf9);
    transform: translateY(-1px);
    z-index: 2;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.35);
  }

  .glyph-tile:active {
    transform: translateY(1px);
  }

  .glyph-tile.is-smp {
    border-color: rgba(255, 171, 0, 0.4);
  }

  .star-btn {
    position: absolute;
    top: 1px;
    left: 2px;
    background: transparent;
    border: none;
    padding: 0;
    margin: 0;
    font-size: 11px;
    line-height: 1;
    color: var(--text-muted, #726f7d);
    cursor: pointer;
    opacity: 0.35;
    transition: opacity 0.1s ease, color 0.1s ease, transform 0.1s ease;
    z-index: 3;
  }

  .glyph-tile:hover .star-btn {
    opacity: 0.9;
  }

  .star-btn.starred {
    color: #ffca28;
    opacity: 1;
  }

  .star-btn:hover {
    transform: scale(1.3);
    color: #ffd54f;
  }

  .glyph-center {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }

  .kaomoji-text {
    font-family: 'Minecraft', monospace;
    font-size: 9px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 0 4px;
    color: var(--text-main, #f0e6d2);
  }

  .advance-badge {
    position: absolute;
    bottom: 1px;
    right: 2px;
    font-size: 8px;
    font-family: monospace;
    color: var(--text-muted, #817e8c);
    line-height: 1;
    pointer-events: none;
    opacity: 0.75;
  }

  .advance-badge.smp {
    color: #ffb74d;
    font-weight: bold;
  }
</style>
