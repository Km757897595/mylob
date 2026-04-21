'use client';

import type { VoiceCatalogSelection } from '@lobechat/types';
import { Button, Empty, Flexbox, Select, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { CheckCircle2 } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
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

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    cursor: pointer;

    position: relative;

    padding-block: 12px;
    padding-inline: 16px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    transition: all 0.2s ${token.motionEaseInOut};

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      box-shadow: 0 2px 8px ${token.colorBgElevated};
    }
  `,
  cardSelected: css`
    border-color: ${token.colorPrimary};
    background: ${token.colorPrimaryBg};

    &:hover {
      border-color: ${token.colorPrimary};
    }
  `,
  filterBar: css`
    flex-wrap: wrap;
    gap: 8px;
  `,
  list: css`
    overflow-y: auto;
    max-height: 480px;
  `,
  selectedIcon: css`
    color: ${token.colorPrimary};
  `,
}));

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

const SERVICE_TAG_COLOR: Partial<Record<TTSServer, string>> = {
  edge: 'gold',
  microsoft: 'blue',
  offline: 'green',
  openai: 'purple',
};

const VoiceCatalogPanel = memo(({ catalog, selectedVoice, onSelect }: VoiceCatalogPanelProps) => {
  const { t } = useTranslation('setting');
  const { cx, styles } = useStyles();
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

  const handleFilterChange = useCallback(
    (key: keyof VoiceCatalogFilterState) => (value: string | undefined) => {
      setFilters((state) => ({ ...state, [key]: value }));
    },
    [],
  );

  return (
    <Flexbox gap={16}>
      <Flexbox horizontal className={styles.filterBar}>
        <Select
          allowClear
          options={serviceOptions}
          placeholder={t('settingTTS.catalog.service')}
          style={{ minWidth: 130 }}
          value={filters.service}
          onChange={handleFilterChange('service')}
        />
        <Select
          allowClear
          options={genderOptions}
          placeholder={t('settingTTS.catalog.gender')}
          style={{ minWidth: 120 }}
          value={filters.gender}
          onChange={handleFilterChange('gender')}
        />
        <Select
          allowClear
          options={timbreOptions}
          placeholder={t('settingTTS.catalog.timbre')}
          style={{ minWidth: 120 }}
          value={filters.timbre}
          onChange={handleFilterChange('timbre')}
        />
        <Select
          allowClear
          options={styleOptions}
          placeholder={t('settingTTS.catalog.style')}
          style={{ minWidth: 120 }}
          value={filters.style}
          onChange={handleFilterChange('style')}
        />
        <Select
          allowClear
          options={localeOptions}
          placeholder={t('settingTTS.catalog.locale')}
          style={{ minWidth: 120 }}
          value={filters.locale}
          onChange={handleFilterChange('locale')}
        />
      </Flexbox>

      {filteredCatalog.length === 0 ? (
        <Empty description={t('settingTTS.catalog.empty')}>
          <Button size={'small'} type={'primary'} onClick={() => setFilters({})}>
            {t('settingTTS.catalog.clearFilters')}
          </Button>
        </Empty>
      ) : (
        <Flexbox className={styles.list} gap={8}>
          {filteredCatalog.map((item) => {
            const isSelected =
              selectedVoice?.voiceId === item.voiceId && selectedVoice?.service === item.service;

            return (
              <Flexbox
                horizontal
                align={'center'}
                className={cx(styles.card, isSelected && styles.cardSelected)}
                justify={'space-between'}
                key={`${item.service}:${item.voiceId}`}
                onClick={() => onSelect(toSelection(item))}
              >
                <Flexbox gap={6}>
                  <Flexbox horizontal align={'center'} gap={8}>
                    {isSelected && <CheckCircle2 className={styles.selectedIcon} size={16} />}
                    <Text strong>{item.label}</Text>
                  </Flexbox>
                  <Flexbox horizontal gap={4} style={{ flexWrap: 'wrap' }}>
                    <Tag color={SERVICE_TAG_COLOR[item.service]}>{item.service}</Tag>
                    {item.gender && <Tag>{item.gender}</Tag>}
                    {item.timbre && <Tag>{item.timbre}</Tag>}
                    {item.style && <Tag>{item.style}</Tag>}
                    {item.locale && <Tag>{item.locale}</Tag>}
                  </Flexbox>
                </Flexbox>
                <VoicePreviewButton selection={toSelection(item)} />
              </Flexbox>
            );
          })}
        </Flexbox>
      )}
    </Flexbox>
  );
});

export { VoiceCatalogPanel };

export default VoiceCatalogPanel;
