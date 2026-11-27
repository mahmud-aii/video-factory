import type { CSSProperties } from 'react';
import type { BrandConfig, StyleRules, TextDirection } from '../types';
import { resolveBrandFontFamily } from './fonts';

export const MIN_HORIZONTAL_PADDING = 64;
export const DEFAULT_SAFE_TOP = 220;
export const DEFAULT_SAFE_BOTTOM = 340;
export const DEFAULT_SAFE_HORIZONTAL = 72;

const LTR_ISOLATE_START = '\u2066';
const ISOLATE_END = '\u2069';
const LTR_COMPOUND_TOKEN_REGEX =
  /\+\d[\d\s-]{4,}\d|\+\d+|@?[A-Za-z0-9]+(?:[._/+-][A-Za-z0-9]+)+|@[A-Za-z0-9._-]+/g;
const RTL_SCRIPT_REGEX = /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function getSafeZones(styleRules?: StyleRules): {
  top: number;
  bottom: number;
  horizontal: number;
} {
  const sz = styleRules?.safeZones;
  return {
    top: Math.max(160, sz?.top ?? sz?.topPx ?? DEFAULT_SAFE_TOP),
    bottom: Math.max(300, sz?.bottom ?? sz?.bottomPx ?? DEFAULT_SAFE_BOTTOM),
    horizontal: Math.max(
      MIN_HORIZONTAL_PADDING,
      sz?.horizontal ?? sz?.horizontalPx ?? DEFAULT_SAFE_HORIZONTAL
    ),
  };
}

export function containsRtlScript(text?: string): boolean {
  return typeof text === 'string' && RTL_SCRIPT_REGEX.test(text);
}

/**
 * Isolates compound LTR tokens (such as "24.ofis", "@24.ofis", "SEO/GEO",
 * "24/7", "khidmatyar.com", "+93 76 584 3613", "+240") inside RTL strings
 * using Unicode LRI/PDI isolates so they never invert under RTL direction.
 */
export function formatBidiText(text: string | undefined, dir: TextDirection): string {
  if (typeof text !== 'string' || !text) {
    return '';
  }
  if (dir !== 'rtl') {
    return text;
  }
  return text.replace(
    LTR_COMPOUND_TOKEN_REGEX,
    (match) => `${LTR_ISOLATE_START}${match}${ISOLATE_END}`
  );
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
