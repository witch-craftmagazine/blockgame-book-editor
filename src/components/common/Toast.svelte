<script lang="ts">
  import { uiStore } from '../../state/uiStore.svelte';
</script>

{#if uiStore.toasts.length > 0}
  <div class="toast-container" role="status" aria-live="polite">
    {#each uiStore.toasts as toast (toast.id)}
      <div class="toast-item {toast.type}">
        {toast.text}
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: 24px;
    right: 24px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    z-index: 9999;
    pointer-events: none;
  }

  .toast-item {
    background: var(--bg-card, #232228);
    color: var(--text-main, #f0e6d2);
    border: 1px solid var(--border-color, #44414d);
    padding: 10px 18px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    animation: toast-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .toast-item.success {
    border-color: #2e7d32;
    background: #1b2e1e;
    color: #a5d6a7;
  }

  .toast-item.warn {
    border-color: #f57f17;
    background: #332611;
    color: #ffe082;
  }

  .toast-item.error {
    border-color: #c62828;
    background: #381a1a;
    color: #ef9a9a;
  }

  @keyframes toast-in {
    from {
      opacity: 0;
      transform: translateY(12px) scale(0.96);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
