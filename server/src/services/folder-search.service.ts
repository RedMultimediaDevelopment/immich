import { Injectable } from '@nestjs/common';
import { AuthDto } from 'src/dtos/auth.dto';
import { FolderSearchDto, FolderSearchResponseDto } from 'src/dtos/folder-search.dto';
import { FolderSearchRepository } from 'src/repositories/folder-search.repository';

@Injectable()
export class FolderSearchService {
  constructor(private repository: FolderSearchRepository) {}

  search(auth: AuthDto, dto: FolderSearchDto): Promise<FolderSearchResponseDto[]> {
    return this.repository.searchFolders(auth.user.id, dto.q);
  }
}
