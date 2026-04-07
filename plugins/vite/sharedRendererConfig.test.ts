import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { sharedRendererResolve } from './sharedRendererConfig';

const packageJson = JSON.parse(
  readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'),
    'utf8',
  ),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe('sharedRendererResolve', () => {
  it('should dedupe lexical editor packages for renderer builds', () => {
    expect(sharedRendererResolve.dedupe).toEqual(
      expect.arrayContaining([
        '@lexical/utils',
        '@lobehub/editor',
        'lexical',
        'react',
        'react-dom',
      ]),
    );
  });

  it('should only dedupe packages that are installed at the workspace root', () => {
    const installedPackages = new Set([
      ...Object.keys(packageJson.dependencies || {}),
      ...Object.keys(packageJson.devDependencies || {}),
    ]);

    expect(sharedRendererResolve.dedupe.every((pkg) => installedPackages.has(pkg))).toBe(true);
  });
});
