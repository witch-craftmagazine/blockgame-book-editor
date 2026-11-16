<script lang="ts">
  import { parseFormattedText, type SinglePageExportFormat } from 'blockgame-book-viewer';
  import { bookStore } from '../../state/bookStore.svelte';
  import { libraryStore, type SavedTemplate } from '../../state/libraryStore.svelte';
  import { uiStore } from '../../state/uiStore.svelte';

  interface Props {
    template: SavedTemplate;
  }

  let { template }: Props = $props();

  function applyTemplate() {
    if (template.scope === 'page') {
      bookStore.takeSnapshot();
      bookStore.setPageText(template.lines.join('\n'));
      uiStore.showToast(`Applied page preset "${template.title}"`, 'success');
    } else {
      // Lines scope: insert starting at active line
      bookStore.takeSnapshot();
      let startIdx = bookStore.activeLineIndex;
      template.lines.forEach((line, offset) => {
        const targetIdx = startIdx + offset;
        if (targetIdx < 14) {
          bookStore.setLine(targetIdx, line);
        }
      });
      uiStore.showToast(`Inserted "${template.title}" at line ${startIdx + 1}`, 'success');
    }
  }

  function handleDelete(e: MouseEvent) {
    e.stopPropagation();
    if (template.isPreset) {
      libraryStore.hidePreset(template.id);
      uiStore.showToast(`Preset "${template.title}" hidden`, 'info');
    } else {
      libraryStore.deleteTemplate(template.id);
      uiStore.showToast(`Deleted custom save "${template.title}"`, 'info');
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="preset-card" onclick={applyTemplate}>
  <div class="card-header">
    <span class="card-title">{template.title}</span>
    <span class="card-scope-badge">{template.scope}</span>
  </div>

  <div class="mini-parchment">
    {#each template.lines.slice(0, 5) as line}
      <div class="mini-line">
        {#each parseFormattedText(line) as span}
          <span
            style="color: {span.color}; font-weight: {span.bold ? 'bold' : 'normal'}; font-style: {span.italic ? 'italic' : 'normal'};"
          >
            {span.text || ' '}
          </span>
        {/each}
      </div>
    {/each}
    {#if template.lines.length > 5}
      <div class="mini-ellipsis">... ({template.lines.length} lines total)</div>
    {/if}
  </div>

  <div class="card-footer">
    <button type="button" class="btn-card-action" onclick={applyTemplate}>
      Apply
    </button>

    <button
      type="button"
      class="btn-card-delete"
      title={template.isPreset ? 'Hide Preset' : 'Delete Custom Save'}
      onclick={handleDelete}
    >
      {template.isPreset ? '✕ Hide' : '🗑 Delete'}
    </button>
  </div>
</div>

<style>
  .preset-card {
    background: var(--bg-card, #23222a);
    border: 1px solid var(--border-color, #383542);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    cursor: pointer;
    transition: transform 0.15s ease, border-color 0.15s ease;
  }

  .preset-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent, #90caf9);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-title {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main, #f0e6d2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
  }

  .card-scope-badge {
    font-size: 10px;
    background: rgba(255, 255, 255, 0.08);
    color: var(--text-muted, #9e9ba8);
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .mini-parchment {
    background: #e8dcb8;
    color: #1a1a1a;
    padding: 6px 8px;
    border-radius: 4px;
    font-family: 'Minecraft', monospace;
    font-size: 10px;
    line-height: 1.2;
    min-height: 60px;
    max-height: 70px;
    overflow: hidden;
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .mini-line {
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .mini-ellipsis {
    font-size: 9px;
    color: #777;
    margin-top: 2px;
  }

  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
  }

  .btn-card-action {
    background: var(--btn-bg, #2e2c38);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #444152);
    border-radius: 3px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-card-action:hover {
    background: var(--btn-hover, #3d3b4a);
  }

  .btn-card-delete {
    background: transparent;
    color: var(--text-muted, #9e9ba8);
    border: none;
    font-size: 11px;
    cursor: pointer;
    padding: 3px 6px;
  }

  .btn-card-delete:hover {
    color: #ef5350;
  }
</style>
