const LOOPBACK_HOSTS = new Set(['0.0.0.0', '127.0.0.1', '::1', '[::1]', 'localhost']);

const isPrivateIpv4Host = (hostname: string) => {
  const segments = hostname.split('.').map(Number);
  if (segments.length !== 4 || segments.some((segment) => Number.isNaN(segment))) return false;

  const [first, second] = segments;

  if (first === 10 || first === 127) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;

  return false;
};

export const buildDataUri = (mimeType: string, bytes: Uint8Array): string =>
  `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;

/**
 * Detect URLs that are only reachable from the local machine / private network.
 * These URLs cannot be fetched by third-party model providers.
 */
export function isPrivateNetworkUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const normalizedHostname = hostname.toLowerCase();

    if (LOOPBACK_HOSTS.has(normalizedHostname)) return true;
    if (normalizedHostname === 'host.docker.internal') return true;
    if (
      normalizedHostname.endsWith('.internal') ||
      normalizedHostname.endsWith('.local') ||
      normalizedHostname.endsWith('.localhost')
    ) {
      return true;
    }

    if (isPrivateIpv4Host(normalizedHostname)) return true;

    // Container / LAN-only hostnames like `rustfs` usually have no public DNS suffix.
    if (!normalizedHostname.includes('.')) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Recursively validate that no full URLs are present in the config
 * This is a defensive check to ensure only keys are stored in database
 */
export function validateNoUrlsInConfig(obj: any, path: string = ''): void {
  if (typeof obj === 'string') {
    if (obj.startsWith('http://') || obj.startsWith('https://')) {
      throw new Error(
        `Invalid configuration: Found full URL instead of key at ${path || 'root'}. ` +
          `URL: "${obj.slice(0, 100)}${obj.length > 100 ? '...' : ''}". ` +
          `All URLs must be converted to storage keys before database insertion.`,
      );
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      validateNoUrlsInConfig(item, `${path}[${index}]`);
    });
  } else if (obj && typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      validateNoUrlsInConfig(value, currentPath);
    });
  }
}
