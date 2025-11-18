import { Injectable } from '@nestjs/common';
import { Kysely, sql } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { AssetVisibility } from 'src/enum';
import { DB } from 'src/schema';
import { asUuid } from 'src/utils/database';

export interface FolderSearchRow {
  folderPath: string;
  assetCount: number;
}

const FOLDER_SEARCH_LIMIT = 50;

@Injectable()
export class FolderSearchRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  async searchFolders(userId: string, query?: string | null): Promise<FolderSearchRow[]> {
    const normalizedQuery = query?.trim();
    const folderPathExpression = sql<string>`regexp_replace(regexp_replace("asset"."originalPath", '/[^/]+$', ''), '/+$', '')`;

    let builder = this.db
      .selectFrom('asset')
      .select([folderPathExpression.as('folderPath'), sql<number>`count(*)`.as('assetCount')])
      .where('asset.ownerId', '=', asUuid(userId))
      .where('asset.visibility', '=', AssetVisibility.Timeline)
      .where('asset.deletedAt', 'is', null)
      .where('asset.fileCreatedAt', 'is not', null)
      .where('asset.fileModifiedAt', 'is not', null)
      .where('asset.localDateTime', 'is not', null);

    if (normalizedQuery) {
      builder = builder.where(folderPathExpression, 'ilike', sql`${'%' + normalizedQuery + '%'}`);
    }

    const rows = await builder
      .groupBy(folderPathExpression)
      .orderBy('folderPath', 'asc')
      .limit(FOLDER_SEARCH_LIMIT)
      .execute();

    return rows.map((row) => ({
      folderPath: row.folderPath.replace(/\/+$/, ''),
      assetCount: Number(row.assetCount),
    }));
  }
}
