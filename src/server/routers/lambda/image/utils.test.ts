import { describe, expect, it } from 'vitest';

import { buildDataUri, isPrivateNetworkUrl, validateNoUrlsInConfig } from './utils';

describe('imageRouter', () => {
  describe('network URL helpers', () => {
    it('should detect localhost-style URLs as private', () => {
      expect(isPrivateNetworkUrl('http://localhost:9000/files/image.jpg')).toBe(true);
      expect(isPrivateNetworkUrl('http://127.0.0.1:9000/files/image.jpg')).toBe(true);
      expect(isPrivateNetworkUrl('http://192.168.1.10:9000/files/image.jpg')).toBe(true);
      expect(isPrivateNetworkUrl('http://rustfs:9000/files/image.jpg')).toBe(true);
    });

    it('should treat public domains as non-private', () => {
      expect(isPrivateNetworkUrl('https://s3.example.com/files/image.jpg')).toBe(false);
      expect(isPrivateNetworkUrl('https://cdn.lobehub.com/files/image.jpg')).toBe(false);
    });

    it('should build data URI from bytes', () => {
      expect(buildDataUri('image/jpeg', new Uint8Array([1, 2, 3]))).toBe(
        'data:image/jpeg;base64,AQID',
      );
    });
  });

  describe('validateNoUrlsInConfig utility', () => {
    describe('valid configurations', () => {
      it('should pass with normal keys', () => {
        const config = {
          imageUrl: 'images/photo.jpg',
          imageUrls: ['files/doc.pdf', 'assets/video.mp4'],
          prompt: 'Generate an image',
        };

        expect(() => validateNoUrlsInConfig(config)).not.toThrow();
      });

      it('should pass with empty strings', () => {
        const config = {
          imageUrl: '',
          imageUrls: [],
          prompt: 'Generate an image',
        };

        expect(() => validateNoUrlsInConfig(config)).not.toThrow();
      });

      it('should pass with null/undefined values', () => {
        const config = {
          imageUrl: null,
          imageUrls: undefined,
          prompt: 'Generate an image',
        };

        expect(() => validateNoUrlsInConfig(config)).not.toThrow();
      });
    });

    describe('invalid configurations', () => {
      it('should throw for https URL in imageUrl', () => {
        const config = {
          imageUrl: 'https://s3.amazonaws.com/bucket/image.jpg',
          prompt: 'Generate an image',
        };

        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'Invalid configuration: Found full URL instead of key at imageUrl',
        );
      });

      it('should throw for http URL in imageUrls array', () => {
        const config = {
          imageUrls: ['files/doc.pdf', 'http://example.com/image.jpg'],
          prompt: 'Generate an image',
        };

        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'Invalid configuration: Found full URL instead of key at imageUrls[1]',
        );
      });

      it('should throw for nested URL in complex object', () => {
        const config = {
          settings: {
            imageConfig: {
              url: 'https://cdn.example.com/very-long-url-that-exceeds-100-characters-to-test-truncation-functionality.jpg',
            },
          },
        };

        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'Invalid configuration: Found full URL instead of key at settings.imageConfig.url',
        );
        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'https://cdn.example.com/very-long-url-that-exceeds-100-characters-to-test-truncation-func',
        );
      });

      it('should throw for presigned URL with query parameters', () => {
        const config = {
          imageUrl:
            'https://s3.amazonaws.com/bucket/file.jpg?X-Amz-Signature=abc&X-Amz-Expires=3600',
        };

        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'All URLs must be converted to storage keys before database insertion',
        );
      });
    });

    describe('edge cases', () => {
      it('should handle deeply nested structures', () => {
        const config = {
          level1: {
            level2: {
              level3: {
                level4: ['normal-key', 'https://bad-url.com'],
              },
            },
          },
        };

        expect(() => validateNoUrlsInConfig(config)).toThrow(
          'Invalid configuration: Found full URL instead of key at level1.level2.level3.level4[1]',
        );
      });

      it('should not throw for strings that contain but do not start with http', () => {
        const config = {
          imageUrl: 'some-prefix-https://example.com',
          description: 'This text contains http:// but is not a URL',
        };

        expect(() => validateNoUrlsInConfig(config)).not.toThrow();
      });
    });
  });
});
