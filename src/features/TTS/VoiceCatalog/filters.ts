import type { TTSServer } from '@/types/agent';

import type { VoiceCatalogItem } from './catalog';

type FilterValue<T> = T | T[];

export interface VoiceCatalogFilters {
  gender?: FilterValue<NonNullable<VoiceCatalogItem['gender']>>;
  locale?: FilterValue<string>;
  service?: FilterValue<TTSServer>;
  style?: FilterValue<NonNullable<VoiceCatalogItem['style']>>;
  timbre?: FilterValue<NonNullable<VoiceCatalogItem['timbre']>>;
}

const matchesFilter = <T>(value: T | undefined, filter?: FilterValue<T>) => {
  if (filter === undefined) return true;
  if (value === undefined) return false;
  const candidates = Array.isArray(filter) ? filter : [filter];
  if (candidates.length === 0) return true;
  return candidates.includes(value);
};

export const filterVoiceCatalog = (
  catalog: VoiceCatalogItem[],
  filters: VoiceCatalogFilters = {},
): VoiceCatalogItem[] =>
  catalog.filter(
    (item) =>
      matchesFilter(item.service, filters.service) &&
      matchesFilter(item.gender, filters.gender) &&
      matchesFilter(item.timbre, filters.timbre) &&
      matchesFilter(item.style, filters.style) &&
      matchesFilter(item.locale, filters.locale),
  );
