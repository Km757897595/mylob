'use client';

import type { VoiceCatalogSelection } from '@lobechat/types';
import { Button, Empty, Flexbox, Select, Tag, Text } from '@lobehub/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type TTSServer } from '@/types/agent';

import { type VoiceCatalogItem } from './catalog';
import { filterVoiceCatalog } from './filters';
import VoicePreviewButton from './VoicePreviewButton';

interface VoiceCatalogPanelProps {
  catalog: VoiceCatalogItem[];
  onSelect: (selection: VoiceCatalogSelection) => void | Promise<void>;
  selectedVoice?: VoiceCatalogSelection;
}

interface VoiceCatalogFilterState {
  gender?: VoiceCatalogItem['gender'];
  locale?: string;
  service?: TTSServer;
  style?: string;
  timbre?: VoiceCatalogItem['timbre'];
}

const uniq = <T extends string>(list: (T | undefined)[]) =>
  [...new Set(list.filter((item): item is T => Boolean(item)))].sort();

const toSelection = (item: VoiceCatalogItem): VoiceCatalogSelection => ({
  gender: item.gender,
  label: item.label,
  locale: item.locale,
  service: item.service,
  style: item.style,
  timbre: item.timbre,
  voiceId: item.voiceId,
});

const tagColor: Partial<Record<TTSServer, string>> = {
  edge: 'gold',
  microsoft: 'blue',
  offline: 'green',
  openai: 'purple',
};

const VoiceCatalogPanel = ({ catalog, selectedVoice, onSelect }: VoiceCatalogPanelProps) => {
  const { t } = useTranslation('setting');
  const [filters, setFilters] = useState<VoiceCatalogFilterState>({});

  const serviceOptions = uniq(catalog.map((item) => item.service)).map((service) => ({
    label: service,
    value: service,
  }));
  const genderOptions = uniq(catalog.map((item) => item.gender)).map((gender) => ({
    label: gender,
    value: gender,
  }));
  const timbreOptions = uniq(catalog.map((item) => item.timbre)).map((timbre) => ({
    label: timbre,
    value: timbre,
  }));
  const styleOptions = uniq(catalog.map((item) => item.style)).map((style) => ({
    label: style,
    value: style,
  }));
  const localeOptions = uniq(catalog.map((item) => item.locale)).map((locale) => ({
    label: locale,
    value: locale,
  }));

  const filteredCatalog = filterVoiceCatalog(catalog, {
    gender: filters.gender,
    locale: filters.locale,
    service: filters.service,
    style: filters.style,
    timbre: filters.timbre,
  });

  return (
    <Flexbox gap={12}>
      <Flexbox horizontal gap={8} style={{ flexWrap: 'wrap' }}>
        <Select
          allowClear
          options={serviceOptions}
          placeholder={t('settingTTS.catalog.service')}
          style={{ minWidth: 130 }}
          value={filters.service}
          onChange={(service) =>
            setFilters((state) => ({ ...state, service: service as TTSServer }))
          }
        />
        <Select
          allowClear
          options={genderOptions}
          placeholder={t('settingTTS.catalog.gender')}
          style={{ minWidth: 130 }}
          value={filters.gender}
          onChange={(gender) =>
            setFilters((state) => ({
              ...state,
              gender: gender as VoiceCatalogItem['gender'],
            }))
          }
        />
        <Select
          allowClear
          options={timbreOptions}
          placeholder={t('settingTTS.catalog.timbre')}
          style={{ minWidth: 130 }}
          value={filters.timbre}
          onChange={(timbre) =>
            setFilters((state) => ({
              ...state,
              timbre: timbre as VoiceCatalogItem['timbre'],
            }))
          }
        />
        <Select
          allowClear
          options={styleOptions}
          placeholder={t('settingTTS.catalog.style')}
          style={{ minWidth: 130 }}
          value={filters.style}
          onChange={(style) => setFilters((state) => ({ ...state, style: style as string }))}
        />
        <Select
          allowClear
          options={localeOptions}
          placeholder={t('settingTTS.catalog.locale')}
          style={{ minWidth: 130 }}
          value={filters.locale}
          onChange={(locale) => setFilters((state) => ({ ...state, locale: locale as string }))}
        />
      </Flexbox>

      {filteredCatalog.length === 0 ? (
        <Empty description={t('settingTTS.catalog.empty')} />
      ) : (
        filteredCatalog.map((item) => {
          const isSelected =
            selectedVoice?.voiceId === item.voiceId && selectedVoice?.service === item.service;

          return (
            <Flexbox
              horizontal
              align={'center'}
              gap={8}
              justify={'space-between'}
              key={`${item.service}:${item.voiceId}`}
              style={{
                background: isSelected ? 'var(--lobe-color-fill-secondary)' : 'transparent',
                border: '1px solid var(--lobe-color-border)',
                borderRadius: 8,
                padding: '8px 10px',
              }}
            >
              <Flexbox gap={4}>
                <Text strong as={'div'}>
                  {item.label}
                </Text>
                <Flexbox horizontal gap={4} style={{ flexWrap: 'wrap' }}>
                  <Tag color={tagColor[item.service]}>{item.service}</Tag>
                  {item.gender && <Tag>{item.gender}</Tag>}
                  {item.timbre && <Tag>{item.timbre}</Tag>}
                  {item.style && <Tag>{item.style}</Tag>}
                  {item.locale && <Tag>{item.locale}</Tag>}
                </Flexbox>
              </Flexbox>
              <Flexbox horizontal align={'center'} gap={8}>
                <VoicePreviewButton selection={toSelection(item)} />
                <Button
                  size={'small'}
                  type={isSelected ? 'primary' : 'default'}
                  onClick={() => onSelect(toSelection(item))}
                >
                  {item.label}
                </Button>
              </Flexbox>
            </Flexbox>
          );
        })
      )}
    </Flexbox>
  );
};

export { VoiceCatalogPanel };

export default VoiceCatalogPanel;
