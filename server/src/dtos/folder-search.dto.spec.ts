import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { FolderSearchDto } from './folder-search.dto';

describe('FolderSearchDto', () => {
  const buildDto = (payload: Partial<FolderSearchDto>) => {
    const dto = plainToInstance(FolderSearchDto, payload);
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
    return dto;
  };

  it('trims the query string', () => {
    const dto = buildDto({ q: '  albums/family  ' });
    expect(dto.q).toBe('albums/family');
  });

  it('drops empty queries', () => {
    const dto = buildDto({ q: '   ' });
    expect(dto.q).toBeUndefined();
  });
});
