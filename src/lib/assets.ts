import { staticFile } from 'remotion';

/**
 * Normalizes asset paths to forward slashes and strips leading "./" or "/".
 */
export function normalizeAssetPath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
}

/**
 * Resolves a client asset under Remotion's publicDir ("./clients").
 * Example: clientAsset("tekviyo", "logos/logo.png") -> staticFile("tekviyo/logos/logo.png")
 */
export function clientAsset(brandSlug: string, relativePath: string): string {
  const cleanSlug = normalizeAssetPath(brandSlug).replace(/\/+$/, '');
  const cleanPath = normalizeAssetPath(relativePath);
  return staticFile(`${cleanSlug}/${cleanPath}`);
}
