<script lang="ts">
  import { formatSinglePage, type SinglePageExportFormat } from 'blockgame-book-viewer';
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';

  let isOpen = $state(false);
  let isCopied = $state(false);

  async function copyFormat(format: SinglePageExportFormat, label: string) {
    const text = formatSinglePage(bookStore.currentLines, format, {
      title: bookStore.title,
      author: bookStore.author,
    });

    if (!text) {
      uiStore.showToast('Active page is empty', 'warn');
      isOpen = false;
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }

      isCopied = true;
      isOpen = false;
      uiStore.showToast(`✓ Copied ${label} for Minecraft paste!`, 'success');
      setTimeout(() => {
        isCopied = false;
      }, 1500);
    } catch {
      uiStore.showToast('Failed to copy to clipboard', 'error');
    }
  }

  function handleDefaultCopy() {
    copyFormat('raw', 'page');
  }

  function toggleDropdown(e: MouseEvent) {
    e.stopPropagation();
    isOpen = !isOpen;
  }

  function handleWindowClick() {
    isOpen = false;
  }
</script>

<svelte:window onclick={handleWindowClick} />

<div class="split-button-container">
  <button
    type="button"
    class="btn-copy-main"
    class:copied={isCopied}
    onclick={handleDefaultCopy}
    title="Copy page to clipboard (Ctrl+Shift+C)"
  >
    {#if isCopied}
      ✓ Copied!
    {:else}
      📋 Copy Page
    {/if}
  </button>

  <button
    type="button"
    class="btn-copy-caret"
    aria-label="More copy formats"
    onclick={toggleDropdown}
  >
    ▾
  </button>

  {#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown-menu" onclick={(e) => e.stopPropagation()}>
      <button type="button" class="menu-item" onclick={() => copyFormat('raw', 'raw Book & Quill')}>
        <span class="item-title">📋 Book & Quill (§ Codes)</span>
        <span class="item-desc">Direct Ctrl+V into writable book</span>
      </button>

      <button type="button" class="menu-item" onclick={() => copyFormat('give', 'single page /give')}>
        <span class="item-title">📦 Single Page /give Command</span>
        <span class="item-desc">Modern 1.20.5+ SNBT command for this page</span>
      </button>

      <button type="button" class="menu-item" onclick={() => copyFormat('ampersand', 'plugin text (& codes)')}>
        <span class="item-title">🏷 Ampersand Codes (&)</span>
        <span class="item-desc">For EssentialsX / CMI server plugins</span>
      </button>

      <button type="button" class="menu-item" onclick={() => copyFormat('plain', 'plain text')}>
        <span class="item-title">📄 Plain Text</span>
        <span class="item-desc">Clean text with formatting stripped</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .split-button-container {
    position: relative;
    display: inline-flex;
    align-items: stretch;
    border-radius: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .btn-copy-main {
    background: var(--btn-bg, #3a3845);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #4e4a5d);
    border-right: none;
    border-radius: 4px 0 0 4px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-copy-main:hover {
    background: var(--btn-hover, #4a4759);
  }

  .btn-copy-main.copied {
    background: #1b5e20;
    color: #a5d6a7;
    border-color: #2e7d32;
  }

  .btn-copy-caret {
    background: var(--btn-bg, #3a3845);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #4e4a5d);
    border-radius: 0 4px 4px 0;
    padding: 6px 7px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-copy-caret:hover {
    background: var(--btn-hover, #4a4759);
  }

  .dropdown-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    min-width: 240px;
    background: var(--bg-card, #232228);
    border: 1px solid var(--border-color, #4e4a5d);
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .menu-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    background: transparent;
    border: none;
    border-radius: 4px;
    padding: 6px 10px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .menu-item:hover {
    background: var(--bg-hover, #33303d);
  }

  .item-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-main, #f0e6d2);
  }

  .item-desc {
    font-size: 11px;
    color: var(--text-muted, #9e9ba8);
    margin-top: 1px;
  }
</style>
