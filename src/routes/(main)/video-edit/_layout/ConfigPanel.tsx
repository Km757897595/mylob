'use client';

import { Flexbox, Text, TextArea } from '@lobehub/ui';
import { Button, Select, Slider } from 'antd';
import { PlusCircle, Trash2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useVideoEditStore } from '@/store/videoEdit';

import FileUpload from './FileUpload';
import ModelSelect from './ModelSelect';

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

  const handleVideoChange = useCallback(
    (dataUrl: string | null) => {
      const url = dataUrl || '';
      if (!url) {
        setConfig({ sourceDuration: undefined, videoUrl: '' });
        return;
      }
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.muted = true;
      probe.src = url;
      probe.addEventListener(
        'loadedmetadata',
        () => {
          const d = Number.isFinite(probe.duration) ? probe.duration : undefined;
          // duration 必须 ≤ 源视频长度（DashScope 限制），向下取整。
          const maxAllowed = d ? Math.max(1, Math.floor(d)) : 5;
          setConfig({
            duration: Math.min(config.duration, Math.min(5, maxAllowed)),
            sourceDuration: d,
            videoUrl: url,
          });
        },
        { once: true },
      );
      probe.addEventListener(
        'error',
        () => setConfig({ sourceDuration: undefined, videoUrl: url }),
        { once: true },
      );
    },
    [config.duration, setConfig],
  );

  const durationMax = Math.min(5, Math.max(1, Math.floor(config.sourceDuration ?? 5)));

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
        <Text weight={500}>{t('config.model.label')}</Text>
        <ModelSelect />
      </Flexbox>

      <Flexbox gap={8}>
        <Text weight={500}>{t('config.videoUrl.label')}</Text>
        <FileUpload
          accept="video"
          maxSizeMB={50}
          value={config.videoUrl}
          onChange={handleVideoChange}
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
            { label: '480P', value: '480P' },
            { label: '720P', value: '720P' },
          ]}
          onChange={(v) => setConfig({ resolution: v })}
        />
      </Flexbox>

      <Flexbox gap={8}>
        <Text weight={500}>{t('config.duration.label', { value: config.duration })}</Text>
        <Slider
          max={durationMax}
          min={1}
          step={1}
          value={Math.min(config.duration, durationMax)}
          onChange={(v) => setConfig({ duration: v as number })}
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
