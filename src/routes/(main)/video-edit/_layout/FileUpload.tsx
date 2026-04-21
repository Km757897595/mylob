'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { App, Button, Progress } from 'antd';
import { FileVideo, Image as ImageIcon, Upload as UploadIcon, X } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useFileStore } from '@/store/file';

interface FileUploadProps {
  accept: 'image' | 'video';
  maxSizeMB?: number;
  onChange: (url: string | null) => void;
  value?: string | null;
}

const FileUpload = memo<FileUploadProps>(({ accept, maxSizeMB = 100, onChange, value }) => {
  const { t } = useTranslation('videoEdit');
  const { message } = App.useApp();
  const uploadWithProgress = useFileStore((s) => s.uploadWithProgress);

  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const acceptStr = accept === 'video' ? 'video/*' : 'image/*';
  const Icon = accept === 'video' ? FileVideo : ImageIcon;

  const handleFile = useCallback(
    async (file: File) => {
      const sizeMB = file.size / 1024 / 1024;
      if (sizeMB > maxSizeMB) {
        message.error(`File size exceeds ${maxSizeMB}MB limit`);
        return;
      }

      setProgress(0);
      try {
        const result = await uploadWithProgress({
          file,
          onStatusUpdate: (upd) => {
            if (upd.type === 'updateFile') {
              const p = upd.value.uploadState?.progress;
              if (typeof p === 'number') setProgress(p);
            }
          },
          skipCheckFileType: true,
        });
        if (result?.url) {
          onChange(result.url);
        } else {
          message.error('Upload failed');
        }
      } catch (err) {
        message.error(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setProgress(null);
      }
    },
    [maxSizeMB, message, onChange, uploadWithProgress],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
      e.currentTarget.value = '';
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      const mimePrefix = accept === 'video' ? 'video/' : 'image/';
      if (!file.type.startsWith(mimePrefix)) {
        message.error(`Only ${accept} files are allowed`);
        return;
      }
      handleFile(file);
    },
    [accept, handleFile, message],
  );

  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const openPicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  if (value) {
    return (
      <Flexbox
        gap={8}
        style={{
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 8,
          padding: 12,
        }}
      >
        {accept === 'image' ? (
          <img
            alt="preview"
            src={value}
            style={{
              borderRadius: 4,
              maxHeight: 120,
              objectFit: 'contain',
              width: '100%',
            }}
          />
        ) : (
          <video controls src={value} style={{ borderRadius: 4, maxHeight: 180, width: '100%' }}>
            <track kind="captions" />
          </video>
        )}
        <Flexbox horizontal align="center" justify="space-between">
          <Text ellipsis fontSize={12} style={{ flex: 1 }}>
            {value}
          </Text>
          <Button icon={<X size={12} />} size="small" type="text" onClick={handleRemove} />
        </Flexbox>
      </Flexbox>
    );
  }

  const isUploading = progress !== null;

  return (
    <div
      style={{
        background: isDragOver ? 'rgba(22,119,255,0.06)' : 'transparent',
        border: `1px dashed ${isDragOver ? '#1677ff' : 'rgba(0,0,0,0.15)'}`,
        borderRadius: 8,
        cursor: isUploading ? 'default' : 'pointer',
        padding: 16,
        transition: 'all 150ms ease',
      }}
      onClick={isUploading ? undefined : openPicker}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onDragEnter={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsDragOver(false);
      }}
    >
      <input
        accept={acceptStr}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
        onChange={handleInputChange}
      />
      <Flexbox align="center" gap={8}>
        {isUploading ? <UploadIcon size={20} /> : <Icon size={20} />}
        <Text fontSize={13}>{isUploading ? t('upload.uploading') : t('upload.clickOrDrag')}</Text>
        {isUploading ? (
          <Progress percent={progress ?? 0} size="small" status="active" style={{ width: '80%' }} />
        ) : (
          <Text fontSize={11} type="secondary">
            {t('upload.maxSize', { defaultValue: `Max ${maxSizeMB}MB`, size: maxSizeMB })}
          </Text>
        )}
      </Flexbox>
    </div>
  );
});

FileUpload.displayName = 'VideoEditFileUpload';

export default FileUpload;
