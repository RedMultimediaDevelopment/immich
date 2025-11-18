<script lang="ts">
  import type { FolderSearchResult } from '$lib/services/folder-search.service';
  import { Icon } from '@immich/ui';
  import { mdiFolderOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';
  import { fly } from 'svelte/transition';

  interface Props {
    id: string;
    results?: FolderSearchResult[];
    isOpen?: boolean;
    isLoading?: boolean;
    error?: string | null;
    onSelect?: (folderPath: string) => void;
  }

  let {
    id,
    results = [],
    isOpen = false,
    isLoading = false,
    error = null,
    onSelect,
  }: Props = $props();

  const handleSelect = (folderPath: string) => {
    onSelect?.(folderPath);
  };

  const formatFolderPath = (folderPath: string) => folderPath || '/';
</script>

<div role="listbox" {id} aria-label={$t('folders')}>
  {#if isOpen}
    <div
      transition:fly={{ y: 25, duration: 150 }}
      class="absolute w-full rounded-b-3xl border-2 border-t-0 border-gray-200 bg-white pb-3 shadow-2xl transition-all dark:border-gray-700 dark:bg-immich-dark-gray dark:text-gray-300 z-1"
    >
      {#if isLoading}
        <div class="px-5 py-4 text-sm text-gray-500 dark:text-gray-300">{$t('loading')}</div>
      {:else if error}
        <div class="px-5 py-4 text-sm text-red-600 dark:text-red-400">{$t(error)}</div>
      {:else if results.length === 0}
        <div class="px-5 py-4 text-sm text-gray-500 dark:text-gray-300">{$t('no_results')}</div>
      {:else}
        <div class="px-2 py-2 text-xs uppercase text-gray-500 dark:text-gray-400">{$t('folders')}</div>
        {#each results as result (result.folderPath)}
          <button
            type="button"
            role="option"
            class="flex w-full items-center gap-3 rounded-xl px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-500/30"
            onclick={() => handleSelect(result.folderPath)}
          >
            <Icon icon={mdiFolderOutline} size="1.25rem" aria-hidden />
            <div class="flex flex-col">
              <span class="font-medium text-black dark:text-gray-200">{formatFolderPath(result.folderPath)}</span>
              <span class="text-xs text-gray-500 dark:text-gray-400">
                {result.assetCount.toLocaleString()} {$t('photos')}
              </span>
            </div>
          </button>
        {/each}
      {/if}
    </div>
  {/if}
</div>
