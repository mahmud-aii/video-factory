import type { CSSProperties } from 'react';
import type { BrandConfig, StyleRules } from '../types';
import { resolveBrandFontFamily } from './fonts';

export const MIN_HORIZONTAL_PADDING = 64;
export const DEFAULT_SAFE_TOP = 220;
export const DEFAULT_SAFE_BOTTOM = 340;
export const DEFAULT_SAFE_HORIZONTAL = 72;

export function getSafeZones(styleRules?: StyleRules): {
  top: number;
  bottom: number;
  horizontal: number;
} {
  return {
    top: Math.max(160, styleRules?.safeZones?.top ?? DEFAULT_SAFE_TOP),
    bottom: Math.max(300, styleRules?.safeZones?.bottom ?? DEFAULT_SAFE_BOTTOM),
    horizontal: Math.max(
      MIN_HORIZONTAL_PADDING,
      styleRules?.safeZones?.horizontal ?? DEFAULT_SAFE_HORIZONTAL
    ),
  };
}

/**
 * Enforces strict RTL safety:
 * - Always applies direction: brand.dir
 * - Strictly locks letterSpacing: '0px' on all RTL text to protect Arabic/Persian ligatures
 */
export function rtlSafeTextStyle(
  brand: BrandConfig,
  overrides: CSSProperties = {}
): CSSProperties {
  const isRtl = brand.dir === 'rtl';

  return {
    fontFamily: resolveBrandFontFamily(brand.fontFamily),
    direction: brand.dir,
    textAlign: isRtl ? 'right' : 'left',
    ...overrides,
    letterSpacing: isRtl ? '0px' : (overrides.letterSpacing ?? '0px'),
  };
}
