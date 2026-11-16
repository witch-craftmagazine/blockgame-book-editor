<script lang="ts">
  import { onMount } from 'svelte';
  import { BookCanvas } from 'blockgame-book-viewer';
  import { bookStore } from '../../state/bookStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';

  let canvasContainer = $state<HTMLDivElement | null>(null);
  let bookCanvasInstance: BookCanvas | null = null;

  onMount(() => {
    if (!canvasContainer) return;

    bookCanvasInstance = new BookCanvas(canvasContainer, {
      viewMode: uiStore.viewMode,
      interactive: true,
      onPageChange: (newPage: number) => {
        bookStore.goToPage(newPage);
      },
    });

    renderCurrentBook();

    return () => {
      bookCanvasInstance?.destroy();
      bookCanvasInstance = null;
    };
  });

  function renderCurrentBook() {
    if (!bookCanvasInstance) return;
    bookCanvasInstance.setViewMode(uiStore.viewMode);
    bookCanvasInstance.setBook({
      title: bookStore.title,
      author: bookStore.author,
      pages: bookStore.pages,
    });
    bookCanvasInstance.setPage(bookStore.currentPageIndex);
  }

  // Reactively update canvas whenever store values change
  $effect(() => {
    const _pages = bookStore.pages;
    const _pageIdx = bookStore.currentPageIndex;
    const _view = uiStore.viewMode;
    const _title = bookStore.title;
    const _author = bookStore.author;

    renderCurrentBook();
  });
</script>

<div class="book-canvas-wrapper" bind:this={canvasContainer}>
  <!-- Canvas is blitted directly by blockgame-book-viewer into this container -->
</div>

<style>
  .book-canvas-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
</style>
