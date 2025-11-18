import { ApiProperty } from '@nestjs/swagger';
import { Optional } from 'src/validation';
import { IsString } from 'class-validator';

export class FolderSearchDto {
  @ApiProperty({ required: false, description: 'Partial folder path to search for.' })
  @IsString()
  @Optional({ trim: true })
  q?: string;
}

export class FolderSearchResponseDto {
  @ApiProperty({ description: 'The folder path relative to the original asset path.' })
  folderPath!: string;

  @ApiProperty({ description: 'Number of assets contained within the folder.' })
  assetCount!: number;
}
