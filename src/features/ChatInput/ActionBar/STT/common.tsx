import { type ChatMessageError } from '@lobechat/types';
import { Alert, Button, Flexbox, Highlighter } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { Mic, MicOff } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import Action from '../components/Action';

const styles = createStaticStyles(({ css }) => ({
  recording: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${cssVar.colorError};
  `,
}));

const CommonSTT = memo<{
  desc: string;
  error?: ChatMessageError;
  formattedTime: string;
  handleCloseError: () => void;
  handleRetry: () => void;
  handleTriggerStartStop: () => void;
  isLoading: boolean;
  isRecording: boolean;
  mobile?: boolean;
  time: number;
}>(
  ({
    mobile,
    isLoading,
    formattedTime,
    time,
    isRecording,
    error,
    handleRetry,
    handleTriggerStartStop,
    handleCloseError,
    desc,
  }) => {
    const { t } = useTranslation('chat');

    // 仅在真实状态发生时自动弹出气泡：录音中 / 录音后等待转写 / 出错
    // 点击只负责 start/stop，避免点击与气泡 open 状态相互干扰
    const showFeedback = !!error || isRecording || isLoading;
    // 只有「已停止录音、但仍在 loading（即等待后端转写）」才显示「润色中…」
    // 这避免 browser 模式下 isRecording===isLoading 时出现误导性文案
    const isPolishing = isLoading && !isRecording;

    return (
      <Action
        active={isRecording}
        icon={isLoading ? MicOff : Mic}
        title={desc}
        variant={mobile ? 'outlined' : 'borderless'}
        dropdown={{
          menu: {
            // @ts-expect-error 等待 antd 修复
            activeKey: 'time',
            items: [
              {
                key: 'title',
                label: (
                  <Flexbox>
                    <div style={{ fontWeight: 'bolder' }}>{t('stt.action')}</div>
                  </Flexbox>
                ),
              },
              {
                key: 'time',
                label: (
                  <Flexbox horizontal align={'center'} gap={8}>
                    <div className={styles.recording} />
                    {time > 0 ? formattedTime : t(isPolishing ? 'stt.prettifying' : 'stt.loading')}
                  </Flexbox>
                ),
              },
            ],
          },
          open: showFeedback,
          placement: mobile ? 'topRight' : 'top',
          popupRender: error
            ? () => (
                <Alert
                  closable
                  style={{ alignItems: 'center' }}
                  title={error.message}
                  type="error"
                  action={
                    <Button size={'small'} type={'primary'} onClick={handleRetry}>
                      {t('retry', { ns: 'common' })}
                    </Button>
                  }
                  extra={
                    error.body && (
                      <Highlighter
                        actionIconSize={'small'}
                        language={'json'}
                        variant={'borderless'}
                      >
                        {JSON.stringify(error.body, null, 2)}
                      </Highlighter>
                    )
                  }
                  onClose={handleCloseError}
                />
              )
            : undefined,
        }}
        onClick={handleTriggerStartStop}
      />
    );
  },
);

export default CommonSTT;
