'use client';

import { Flexbox, Text, TextArea } from '@lobehub/ui';
import { Button, Select } from 'antd';
import { PlusCircle, Trash2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useVideoEditStore } from '@/store/videoEdit';

import FileUpload from './FileUpload';

const ConfigPanel = memo(() => {
  const { t } = useTranslation('videoEdit');
  const config = useVideoEditStore((s) => s.config);
  const setConfig = useVideoEditStore((s) => s.setConfig);

  const handleAddRefImage = useCallback(() => {
    setConfig({ referenceImages: [...config.referenceImages, ''] });
  }, [config.referenceImages, setConfig]);

  const handleRemoveRefImage = useCallback(
    (index: number) => {
      setConfig({ referenceImages: config.referenceImages.filter((_, i) => i !== index) });
    },
    [config.referenceImages, setConfig],
  );

  const handleRefImageChange = useCallback(
    (index: number, value: string | null) => {
      const next = [...config.referenceImages];
      next[index] = value || '';
      setConfig({ referenceImages: next });
    },
    [config.referenceImages, setConfig],
  );

  return (
    <Flexbox gap={16} padding={10}>
      <Flexbox gap={8}>
        <Text weight={500}>{t('config.videoUrl.label')}</Text>
        <FileUpload
          accept="video"
          maxSizeMB={50}
          value={config.videoUrl}
          onChange={(dataUrl) => setConfig({ videoUrl: dataUrl || '' })}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Text weight={500}>{t('config.prompt.label')}</Text>
        <TextArea
          autoSize={{ maxRows: 6, minRows: 3 }}
          placeholder={t('config.prompt.placeholder')}
          value={config.prompt}
          onChange={(e) => setConfig({ prompt: (e.target as HTMLTextAreaElement).value })}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Text weight={500}>{t('config.resolution.label')}</Text>
        <Select
          style={{ width: '100%' }}
          value={config.resolution}
          options={[
            { label: '720P', value: '720P' },
            { label: '1080P', value: '1080P' },
          ]}
          onChange={(v) => setConfig({ resolution: v })}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Flexbox horizontal align="center" justify="space-between">
          <Text weight={500}>{t('config.referenceImages.label')}</Text>
          <Button
            disabled={config.referenceImages.length >= 4}
            icon={<PlusCircle size={14} />}
            size="small"
            type="text"
            onClick={handleAddRefImage}
          />
        </Flexbox>
        {config.referenceImages.map((url, i) => (
          <Flexbox gap={4} key={i}>
            <Flexbox horizontal align="center" justify="space-between">
              <Text fontSize={12} type="secondary">
                #{i + 1}
              </Text>
              <Button
                icon={<Trash2 size={12} />}
                size="small"
                type="text"
                onClick={() => handleRemoveRefImage(i)}
              />
            </Flexbox>
            <FileUpload
              accept="image"
              maxSizeMB={10}
              value={url || null}
              onChange={(dataUrl) => handleRefImageChange(i, dataUrl)}
            />
          </Flexbox>
        ))}
      </Flexbox>
    </Flexbox>
  );
});

ConfigPanel.displayName = 'VideoEditConfigPanel';

export default ConfigPanel;
