'use client';

import { Flexbox } from '@lobehub/ui';
import { Alert, Button, Progress, Spin, Typography } from 'antd';
import { Clapperboard } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useVideoEditStore } from '@/store/videoEdit';

const POLL_INTERVAL = 5000;

const EditWorkspace = memo(() => {
  const { t } = useTranslation('videoEdit');
  const config = useVideoEditStore((s) => s.config);
  const task = useVideoEditStore((s) => s.task);
  const setTask = useVideoEditStore((s) => s.setTask);
  const [progress, setProgress] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (task.status === 'processing' && task.taskId) {
      pollRef.current = setInterval(async () => {
        try {
          const resp = await fetch(`/api/video-edit?taskId=${task.taskId}`);
          const data = await resp.json();
          if (data.status === 'SUCCEEDED') {
            stopPolling();
            setTask({ resultUrl: data.videoUrl, status: 'succeeded' });
            setProgress(100);
          } else if (data.status === 'FAILED') {
            stopPolling();
            setTask({ error: t('task.failed'), status: 'failed' });
          } else {
            setProgress((p) => Math.min(p + 5, 90));
          }
        } catch {
          stopPolling();
          setTask({ error: t('task.networkError'), status: 'failed' });
        }
      }, POLL_INTERVAL);
    }
    return stopPolling;
  }, [task.status, task.taskId, stopPolling, setTask, t]);

  const handleSubmit = useCallback(async () => {
    if (!config.videoUrl || !config.prompt) return;
    setTask({ error: undefined, resultUrl: undefined, status: 'pending' });
    setProgress(0);
    try {
      const resp = await fetch('/api/video-edit', {
        body: JSON.stringify({
          prompt: config.prompt,
          referenceImages: config.referenceImages.filter(Boolean),
          resolution: config.resolution,
          videoUrl: config.videoUrl,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = await resp.json();
      if (!resp.ok || !data.taskId) {
        setTask({ error: data.error || t('task.submitError'), status: 'failed' });
        return;
      }
      setTask({ status: 'processing', taskId: data.taskId });
      setProgress(10);
    } catch {
      setTask({ error: t('task.networkError'), status: 'failed' });
    }
  }, [config, setTask, t]);

  const isLoading = task.status === 'pending' || task.status === 'processing';
  const canSubmit = !!config.videoUrl && !!config.prompt && !isLoading;

  return (
    <Flexbox gap={24} padding={24} style={{ height: '100%', overflowY: 'auto' }}>
      <Flexbox horizontal align="center" gap={8}>
        <Clapperboard size={20} />
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t('workspace.title')}
        </Typography.Title>
      </Flexbox>

      <Button
        disabled={!canSubmit}
        loading={isLoading}
        size="large"
        type="primary"
        onClick={handleSubmit}
      >
        {t('workspace.editButton')}
      </Button>

      {isLoading && (
        <Flexbox gap={12}>
          <Flexbox horizontal align="center" gap={12}>
            <Spin />
            <Typography.Text type="secondary">{t('task.processing')}</Typography.Text>
          </Flexbox>
          <Progress percent={progress} status="active" />
        </Flexbox>
      )}

      {task.status === 'failed' && (
        <Alert showIcon message={task.error || t('task.failed')} type="error" />
      )}

      {task.status === 'succeeded' && task.resultUrl && (
        <Flexbox gap={12}>
          <Typography.Text strong>{t('task.succeeded')}</Typography.Text>
          <video
            controls
            src={task.resultUrl}
            style={{ borderRadius: 8, maxHeight: 480, width: '100%' }}
          >
            <track kind="captions" />
          </video>
          <Button href={task.resultUrl} rel="noreferrer" target="_blank">
            {t('task.download')}
          </Button>
        </Flexbox>
      )}

      {task.status === 'idle' && (
        <Flexbox
          align="center"
          gap={16}
          justify="center"
          style={{ color: '#8c8c8c', flex: 1, minHeight: 200 }}
        >
          <Clapperboard opacity={0.3} size={48} />
          <Typography.Text type="secondary">{t('workspace.emptyHint')}</Typography.Text>
        </Flexbox>
      )}
    </Flexbox>
  );
});

EditWorkspace.displayName = 'EditWorkspace';

export default EditWorkspace;
