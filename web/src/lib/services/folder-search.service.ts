export interface FolderSearchResult {
  folderPath: string;
  assetCount: number;
}

export const searchFolders = async (query: string, signal?: AbortSignal): Promise<FolderSearchResult[]> => {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set('q', query.trim());
  }

  const searchParams = params.toString();
  const response = await fetch(searchParams ? `/api/folder-search?${searchParams}` : '/api/folder-search', { signal });
  if (!response.ok) {
    throw new Error('Failed to search folders');
  }

  return (await response.json()) as FolderSearchResult[];
};
