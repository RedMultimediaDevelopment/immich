import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Endpoint, HistoryBuilder } from 'src/decorators';
import { AuthDto } from 'src/dtos/auth.dto';
import { FolderSearchDto, FolderSearchResponseDto } from 'src/dtos/folder-search.dto';
import { ApiTag } from 'src/enum';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { FolderSearchService } from 'src/services/folder-search.service';

@ApiTags(ApiTag.Search)
@Controller('folder-search')
export class FolderSearchController {
  constructor(private service: FolderSearchService) {}

  @Get()
  @Authenticated()
  @Endpoint({
    summary: 'Search for folders by original path',
    description: 'Search distinct folder paths derived from asset original paths and return asset counts per folder.',
    history: new HistoryBuilder().added('v2'),
  })
  search(@Auth() auth: AuthDto, @Query() dto: FolderSearchDto): Promise<FolderSearchResponseDto[]> {
    return this.service.search(auth, dto);
  }
}
