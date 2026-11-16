<script lang="ts">
  import { onMount } from 'svelte';
  import { ensureAtlasLoaded, renderGlyphToCanvas } from './glyphRenderer';

  interface Props {
    char: string;
    colorHex?: string;
    size?: number;
    scale?: number;
  }

  let {
    char,
    colorHex = '#f0e6d2',
    size = 28,
    scale = 2,
  }: Props = $props();

  let canvasEl: HTMLCanvasElement | null = $state(null);

  function draw() {
    if (!canvasEl) return;
    renderGlyphToCanvas(canvasEl, char, colorHex, scale);
  }

  onMount(() => {
    let unmounted = false;
    ensureAtlasLoaded().then(() => {
      if (!unmounted) {
        draw();
      }
    });
    return () => {
      unmounted = true;
    };
  });

  $effect(() => {
    // Re-draw whenever char, colorHex, size, or scale changes
    if (canvasEl && char) {
      draw();
    }
  });
</script>

<canvas
  bind:this={canvasEl}
  width={size}
  height={size}
  class="glyph-canvas"
  style="width: {size}px; height: {size}px;"
></canvas>

<style>
  .glyph-canvas {
    display: block;
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-crisp-edges;
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    pointer-events: none;
  }
</style>
