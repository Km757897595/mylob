'use client';

import { Select } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/slices/aiProvider/selectors';
import { useVideoEditStore } from '@/store/videoEdit';

interface VideoEditModelOption {
  description?: string;
  id: string;
  name: string;
  provider: string;
}

/**
 * 内置兜底模型，即使用户未在 /settings/provider 中配置，
 * 也能演示在线 / 离线两条链路。
 */
const BUILTIN_OPTIONS: VideoEditModelOption[] = [
  {
    description: '在线 · 阿里云 DashScope',
    id: 'wan2.7-videoedit',
    name: 'Wan 2.7 VideoEdit',
    provider: 'dashscope',
  },
  {
    description: '在线 · 阿里云 DashScope',
    id: 'wan2.5-videoedit',
    name: 'Wan 2.5 VideoEdit',
    provider: 'dashscope',
  },
  {
    description: '离线 · 本地 ComfyUI 工作流',
    id: 'video-edit-default',
    name: 'ComfyUI Workflow (本地)',
    provider: 'comfyui',
  },
];

const ModelSelect = memo(() => {
  const { t } = useTranslation('videoEdit');
  const model = useVideoEditStore((s) => s.config.model);
  const provider = useVideoEditStore((s) => s.config.provider);
  const setConfig = useVideoEditStore((s) => s.setConfig);

  const enabledVideoModelList = useAiInfraStore(aiProviderSelectors.enabledVideoModelList);

  const options = useMemo(() => {
    const fromInfra: VideoEditModelOption[] = enabledVideoModelList.flatMap((p) =>
      p.children.map((m) => ({
        description: p.name,
        id: m.id,
        name: m.displayName || m.id,
        provider: p.id,
      })),
    );

    const merged = [...fromInfra];
    for (const item of BUILTIN_OPTIONS) {
      const existed = merged.some((x) => x.provider === item.provider && x.id === item.id);
      if (!existed) merged.push(item);
    }

    const groupMap = new Map<string, VideoEditModelOption[]>();
    for (const item of merged) {
      const arr = groupMap.get(item.provider) || [];
      arr.push(item);
      groupMap.set(item.provider, arr);
    }

    return [...groupMap.entries()].map(([providerId, items]) => ({
      label: providerId,
      options: items.map((item) => ({
        label: item.name,
        title: item.description,
        value: `${item.provider}/${item.id}`,
      })),
    }));
  }, [enabledVideoModelList]);

  return (
    <Select
      options={options}
      placeholder={t('config.model.placeholder')}
      style={{ width: '100%' }}
      value={`${provider}/${model}`}
      onChange={(v) => {
        const [nextProvider, ...rest] = v.split('/');
        setConfig({ model: rest.join('/'), provider: nextProvider });
      }}
    />
  );
});

ModelSelect.displayName = 'VideoEditModelSelect';

export default ModelSelect;
