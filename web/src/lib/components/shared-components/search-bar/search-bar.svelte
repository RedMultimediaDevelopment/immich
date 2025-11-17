<script lang="ts">
  import { goto } from '$app/navigation';
  import { focusOutside } from '$lib/actions/focus-outside';
  import { shortcuts } from '$lib/actions/shortcut';
  import { AppRoute, QueryParameter, timeDebounceOnSearch } from '$lib/constants';
  import SearchFilterModal from '$lib/modals/SearchFilterModal.svelte';
  import { searchStore } from '$lib/stores/search.svelte';
  import { handlePromiseError } from '$lib/utils';
  import { generateId } from '$lib/utils/generate-id';
  import { getMetadataSearchQuery } from '$lib/utils/metadata-search';
  import FolderSearchResults from '$lib/components/shared-components/search-bar/folder-search-results.svelte';
  import { searchFolders, type FolderSearchResult } from '$lib/services/folder-search.service';
  import type { MetadataSearchDto, SmartSearchDto } from '@immich/sdk';
  import { IconButton, modalManager } from '@immich/ui';
  import { mdiClose, mdiMagnify, mdiTune } from '@mdi/js';
  import { onDestroy, onMount, tick } from 'svelte';
  import { SvelteURLSearchParams } from 'svelte/reactivity';
  import { t } from 'svelte-i18n';
  import SearchHistoryBox from './search-history-box.svelte';

  interface Props {
    value?: string;
    grayTheme: boolean;
    searchQuery?: MetadataSearchDto | SmartSearchDto;
  }

  let { value = $bindable(''), grayTheme, searchQuery = {} }: Props = $props();

  type SearchMode = 'photos' | 'folders';
  const searchModeStorageKey = 'globalSearchMode';

  let showClearIcon = $derived(value.length > 0);
  let searchMode = $state<SearchMode>('photos');
  let folderResults = $state<FolderSearchResult[]>([]);
  let folderSearchLoading = $state(false);
  let folderSearchError = $state<string | null>(null);
  let folderSearchAbortController: AbortController | null = null;
  let folderSearchTimeout: ReturnType<typeof setTimeout> | undefined;

  let input = $state<HTMLInputElement>();
  let searchHistoryBox = $state<ReturnType<typeof SearchHistoryBox>>();
  let showSuggestions = $state(false);
  let isSearchSuggestions = $state(false);
  let selectedId: string | undefined = $state();
  let close: (() => Promise<void>) | undefined;
  let isFolderMode = $derived(searchMode === 'folders');
  let folderSuggestionsOpen = $derived(isFolderMode && showSuggestions && value.trim().length > 0);

  const listboxId = generateId();
  const searchTypeId = generateId();

  onDestroy(() => {
    searchStore.isSearchEnabled = false;
  });

  onMount(() => {
    const storedMode = localStorage.getItem(searchModeStorageKey);
    if (storedMode === 'photos' || storedMode === 'folders') {
      searchMode = storedMode;
    }
  });

  $effect(() => {
    if (isFolderMode) {
      isSearchSuggestions = false;
    }
  });

  const resetFolderSearch = () => {
    folderResults = [];
    folderSearchLoading = false;
    folderSearchError = null;
    if (folderSearchTimeout) {
      clearTimeout(folderSearchTimeout);
      folderSearchTimeout = undefined;
    }
    folderSearchAbortController?.abort();
    folderSearchAbortController = null;
  };

  const setSearchMode = (mode: SearchMode) => {
    if (searchMode === mode) {
      return;
    }
    searchMode = mode;
    localStorage.setItem(searchModeStorageKey, mode);
    selectedId = undefined;
    if (mode === 'folders') {
      if (value.trim()) {
        showSuggestions = true;
        scheduleFolderSearch(value);
      } else {
        resetFolderSearch();
        showSuggestions = false;
      }
    } else {
      resetFolderSearch();
      showSuggestions = false;
    }
  };

  const scheduleFolderSearch = (term: string) => {
    if (!isFolderMode) {
      return;
    }
    if (folderSearchTimeout) {
      clearTimeout(folderSearchTimeout);
    }
    folderSearchLoading = term.trim().length > 0;
    folderSearchError = null;
    folderSearchTimeout = setTimeout(() => {
      folderSearchTimeout = undefined;
      void executeFolderSearch(term);
    }, timeDebounceOnSearch);
  };

  const executeFolderSearch = async (term: string) => {
    const query = term.trim();
    folderSearchAbortController?.abort();

    if (!query) {
      resetFolderSearch();
      return;
    }

    const controller = new AbortController();
    folderSearchAbortController = controller;

    try {
      const results = await searchFolders(query, controller.signal);
      if (folderSearchAbortController !== controller || controller.signal.aborted) {
        return;
      }
      folderResults = results;
      folderSearchError = null;
    } catch {
      if (controller.signal.aborted) {
        return;
      }
      folderSearchError = 'errors.something_went_wrong';
    } finally {
      if (folderSearchAbortController === controller && !controller.signal.aborted) {
        folderSearchLoading = false;
      }
    }
  };

  const handleFolderNavigation = async (folderPath: string) => {
    const params = new SvelteURLSearchParams();
    if (folderPath) {
      params.set(QueryParameter.PATH, folderPath);
    }
    const query = params.toString();
    closeDropdown();
    searchStore.isSearchEnabled = false;
    await goto(query ? `${AppRoute.FOLDERS}?${query}` : AppRoute.FOLDERS);
  };

  const handleSearch = async (payload: SmartSearchDto | MetadataSearchDto) => {
    const params = getMetadataSearchQuery(payload);

    closeDropdown();
    searchStore.isSearchEnabled = false;
    await goto(`${AppRoute.SEARCH}?${params}`);
  };

  const clearSearchTerm = (searchTerm: string) => {
    input?.focus();
    searchStore.savedSearchTerms = searchStore.savedSearchTerms.filter((item) => item !== searchTerm);
  };

  const saveSearchTerm = (saveValue: string) => {
    const filteredSearchTerms = searchStore.savedSearchTerms.filter(
      (item) => item.toLowerCase() !== saveValue.toLowerCase(),
    );
    searchStore.savedSearchTerms = [saveValue, ...filteredSearchTerms];

    if (searchStore.savedSearchTerms.length > 5) {
      searchStore.savedSearchTerms = searchStore.savedSearchTerms.slice(0, 5);
    }
  };

  const clearAllSearchTerms = () => {
    input?.focus();
    searchStore.savedSearchTerms = [];
  };

  const onFocusIn = () => {
    searchStore.isSearchEnabled = true;
  };

  const onFocusOut = () => {
    searchStore.isSearchEnabled = false;
  };

  const onHistoryTermClick = async (searchTerm: string) => {
    value = searchTerm;
    const searchPayload = { query: searchTerm };
    await handleSearch(searchPayload);
  };

  const onFilterClick = async () => {
    if (isFolderMode) {
      return;
    }
    value = '';

    if (close) {
      await close();
      close = undefined;
      return;
    }

    const result = modalManager.open(SearchFilterModal, { searchQuery });
    close = () => result.close();
    closeDropdown();

    const searchResult = await result.onClose;
    close = undefined;

    if (!searchResult) {
      return;
    }

    await handleSearch(searchResult);
  };

  const onSubmit = () => {
    if (isFolderMode) {
      if (folderResults.length > 0) {
        handlePromiseError(handleFolderNavigation(folderResults[0].folderPath));
      }
      return;
    }
    const searchType = getSearchType();
    let payload = {} as SmartSearchDto | MetadataSearchDto;

    switch (searchType) {
      case 'smart': {
        payload = { query: value } as SmartSearchDto;
        break;
      }
      case 'metadata': {
        payload = { originalFileName: value } as MetadataSearchDto;
        break;
      }
      case 'description': {
        payload = { description: value } as MetadataSearchDto;
        break;
      }
      case 'ocr': {
        payload = { ocr: value } as MetadataSearchDto;
        break;
      }
    }

    handlePromiseError(handleSearch(payload));
    saveSearchTerm(value);
  };

  const onClear = () => {
    value = '';
    if (isFolderMode) {
      resetFolderSearch();
      showSuggestions = false;
    }
    input?.focus();
  };

  const onEscape = () => {
    closeDropdown();
  };

  const onArrow = async (direction: 1 | -1) => {
    if (isFolderMode) {
      return;
    }
    openDropdown();
    await tick();
    searchHistoryBox?.moveSelection(direction);
  };

  const onEnter = (event: KeyboardEvent) => {
    if (isFolderMode) {
      if (folderResults.length > 0) {
        event.preventDefault();
        handlePromiseError(handleFolderNavigation(folderResults[0].folderPath));
      }
      return;
    }
    if (selectedId) {
      event.preventDefault();
      searchHistoryBox?.selectActiveOption();
    }
  };

  const onInput = () => {
    openDropdown();
    if (isFolderMode) {
      if (!value.trim()) {
        resetFolderSearch();
        showSuggestions = false;
        return;
      }
      scheduleFolderSearch(value);
      return;
    }
    searchHistoryBox?.clearSelection();
  };

  const openDropdown = () => {
    if (isFolderMode) {
      showSuggestions = value.trim().length > 0;
      return;
    }
    showSuggestions = true;
  };

  const closeDropdown = () => {
    showSuggestions = false;
    searchHistoryBox?.clearSelection();
  };

  const onsubmit = (event: Event) => {
    event.preventDefault();
    onSubmit();
  };

  function getSearchType() {
    const searchType = localStorage.getItem('searchQueryType');
    switch (searchType) {
      case 'smart':
      case 'metadata':
      case 'description':
      case 'ocr': {
        return searchType;
      }
      default: {
        return 'smart';
      }
    }
  }

  function getSearchTypeText(): string {
    const searchType = getSearchType();
    switch (searchType) {
      case 'smart': {
        return $t('context');
      }
      case 'metadata': {
        return $t('filename');
      }
      case 'description': {
        return $t('description');
      }
      case 'ocr': {
        return $t('ocr');
      }
    }
  }
</script>

<svelte:document
  use:shortcuts={[
    { shortcut: { key: 'Escape' }, onShortcut: onEscape },
    { shortcut: { ctrl: true, key: 'k' }, onShortcut: () => input?.select() },
    { shortcut: { ctrl: true, shift: true, key: 'k' }, onShortcut: onFilterClick },
  ]}
/>

<div class="w-full relative z-auto" use:focusOutside={{ onFocusOut }} tabindex="-1">
  <form
    draggable="false"
    autocomplete="off"
    class="select-text text-sm"
    action={AppRoute.SEARCH}
    onreset={() => (value = '')}
    {onsubmit}
    onfocusin={onFocusIn}
    role="search"
  >
    <div use:focusOutside={{ onFocusOut: closeDropdown }} tabindex="-1">
      <div class="mb-2 flex gap-2 ps-2 text-xs font-semibold">
        <button
          type="button"
          class={`rounded-full border px-3 py-1 transition-colors ${
            searchMode === 'photos'
              ? 'bg-immich-primary text-white border-immich-primary dark:bg-immich-dark-primary/90 dark:text-black/75'
              : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
          }`}
          aria-pressed={searchMode === 'photos'}
          onclick={() => setSearchMode('photos')}
        >
          {$t('photos')}
        </button>
        <button
          type="button"
          class={`rounded-full border px-3 py-1 transition-colors ${
            searchMode === 'folders'
              ? 'bg-immich-primary text-white border-immich-primary dark:bg-immich-dark-primary/90 dark:text-black/75'
              : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-300'
          }`}
          aria-pressed={searchMode === 'folders'}
          onclick={() => setSearchMode('folders')}
        >
          {$t('folders')}
        </button>
      </div>
      <label for="main-search-bar" class="sr-only">{$t('search_your_photos')}</label>
      <input
        type="text"
        name="q"
        id="main-search-bar"
        class="w-full transition-all border-2 ps-14 py-4 max-md:py-2 text-immich-fg/75 dark:text-immich-dark-fg
        {showClearIcon ? 'pe-22.5' : 'pe-14'}
        {grayTheme ? 'dark:bg-immich-dark-gray' : 'dark:bg-immich-dark-bg'}
        {showSuggestions && isSearchSuggestions ? 'rounded-t-3xl' : 'rounded-3xl bg-gray-200'}
        {searchStore.isSearchEnabled ? 'border-gray-200 dark:border-gray-700 bg-white' : 'border-transparent'}"
        placeholder={isFolderMode ? $t('folders') : $t('search_your_photos')}
        required
        pattern="^(?!m:$).*$"
        bind:value
        bind:this={input}
        onfocus={openDropdown}
        oninput={onInput}
        role="combobox"
        aria-controls={listboxId}
        aria-activedescendant={selectedId ?? ''}
        aria-expanded={isFolderMode ? folderSuggestionsOpen : showSuggestions && isSearchSuggestions}
        aria-autocomplete="list"
        aria-describedby={isFolderMode ? undefined : searchTypeId}
        use:shortcuts={[
          { shortcut: { key: 'Escape' }, onShortcut: onEscape },
          { shortcut: { ctrl: true, shift: true, key: 'k' }, onShortcut: onFilterClick },
          { shortcut: { key: 'ArrowUp' }, onShortcut: () => onArrow(-1) },
          { shortcut: { key: 'ArrowDown' }, onShortcut: () => onArrow(1) },
          { shortcut: { key: 'Enter' }, onShortcut: onEnter, preventDefault: false },
          { shortcut: { key: 'ArrowDown', alt: true }, onShortcut: openDropdown },
        ]}
      />

      <!-- SEARCH HISTORY BOX -->
      {#if isFolderMode}
        <FolderSearchResults
          id={listboxId}
          results={folderResults}
          isOpen={folderSuggestionsOpen}
          isLoading={folderSearchLoading}
          error={folderSearchError}
          onSelect={(folderPath) => handlePromiseError(handleFolderNavigation(folderPath))}
        />
      {:else}
        <SearchHistoryBox
          bind:this={searchHistoryBox}
          bind:isSearchSuggestions
          id={listboxId}
          searchQuery={value}
          isOpen={showSuggestions}
          onClearAllSearchTerms={clearAllSearchTerms}
          onClearSearchTerm={(searchTerm) => clearSearchTerm(searchTerm)}
          onSelectSearchTerm={(searchTerm) => handlePromiseError(onHistoryTermClick(searchTerm))}
          onActiveSelectionChange={(id) => (selectedId = id)}
        />
      {/if}
    </div>

    <div class="absolute inset-y-0 {showClearIcon ? 'end-14' : 'end-2'} flex items-center ps-6 transition-all">
      <IconButton
        aria-label={$t('show_search_options')}
        shape="round"
        icon={mdiTune}
        onclick={onFilterClick}
        size="medium"
        color="secondary"
        variant="ghost"
        disabled={isFolderMode}
      />
    </div>

    {#if searchStore.isSearchEnabled && !isFolderMode}
      <div
        id={searchTypeId}
        class="absolute inset-y-0 flex items-center end-16"
        class:max-md:hidden={value}
        class:end-28={value.length > 0}
      >
        <p
          class="bg-immich-primary text-white dark:bg-immich-dark-primary/90 dark:text-black/75 rounded-full px-3 py-1 text-xs"
        >
          {getSearchTypeText()}
        </p>
      </div>
    {/if}

    {#if showClearIcon}
      <div class="absolute inset-y-0 end-0 flex items-center pe-2">
        <IconButton
          onclick={onClear}
          icon={mdiClose}
          aria-label={$t('clear')}
          size="medium"
          color="secondary"
          variant="ghost"
          shape="round"
        />
      </div>
    {/if}
    <div class="absolute inset-y-0 start-0 flex items-center ps-2">
      <IconButton
        type="submit"
        aria-label={$t('search')}
        icon={mdiMagnify}
        size="medium"
        onclick={() => {}}
        shape="round"
        color="secondary"
        variant="ghost"
      />
    </div>
  </form>
</div>
