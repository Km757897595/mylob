import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface PackageJson {
  dependencies?: Record<string, string>;
  overrides?: Record<string, string>;
  pnpm?: {
    overrides?: Record<string, string>;
  };
}

const packageJson = JSON.parse(
  readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'),
    'utf8',
  ),
) as PackageJson;

describe('docker dependency pins', () => {
  it('pins lexical editor dependencies to reproducible versions', () => {
    expect(packageJson.dependencies?.['@lobehub/editor']).toBe('4.5.0');
    expect(packageJson.dependencies?.['@lexical/utils']).toBe('0.39.0');
    expect(packageJson.dependencies?.lexical).toBe('0.39.0');
  });

  it('keeps package manager overrides aligned with the lexical runtime set', () => {
    expect(packageJson.overrides?.['@lobehub/editor']).toBe('4.5.0');
    expect(packageJson.overrides?.['@lexical/extension']).toBe('0.39.0');
    expect(packageJson.overrides?.['@lexical/utils']).toBe('0.39.0');
    expect(packageJson.overrides?.lexical).toBe('0.39.0');

    expect(packageJson.pnpm?.overrides?.['@lobehub/editor']).toBe('4.5.0');
    expect(packageJson.pnpm?.overrides?.['@lexical/extension']).toBe('0.39.0');
    expect(packageJson.pnpm?.overrides?.['@lexical/utils']).toBe('0.39.0');
    expect(packageJson.pnpm?.overrides?.lexical).toBe('0.39.0');
  });
});
