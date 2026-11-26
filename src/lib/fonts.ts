import { loadFont as loadCairo } from '@remotion/google-fonts/Cairo';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrainsMono } from '@remotion/google-fonts/JetBrainsMono';
import { loadFont as loadVazirmatn } from '@remotion/google-fonts/Vazirmatn';

// Load all brand fonts at module scope so Remotion handles font readiness cleanly.
export const cairoFont = loadCairo('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['arabic', 'latin'],
});

export const vazirmatnFont = loadVazirmatn('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['arabic', 'latin'],
});

export const interFont = loadInter('normal', {
  weights: ['400', '600', '700', '800', '900'],
  subsets: ['latin'],
});

export const jetBrainsMonoFont = loadJetBrainsMono('normal', {
  weights: ['400', '600', '700', '800'],
  subsets: ['latin'],
});

export const MONO_FONT_FAMILY = `${jetBrainsMonoFont.fontFamily}, monospace`;

export function resolveBrandFontFamily(configured?: string): string {
  const raw = (configured || 'Cairo').trim();
  const lower = raw.toLowerCase();

  if (lower.includes('vazirmatn') && lower.includes('cairo')) {
    return `${vazirmatnFont.fontFamily}, ${cairoFont.fontFamily}, ${interFont.fontFamily}, sans-serif`;
  }
  if (lower.includes('vazirmatn')) {
    return `${vazirmatnFont.fontFamily}, ${cairoFont.fontFamily}, ${interFont.fontFamily}, sans-serif`;
  }
  if (lower.includes('cairo')) {
    return `${cairoFont.fontFamily}, ${interFont.fontFamily}, sans-serif`;
  }
  if (lower.includes('jetbrains')) {
    return `${jetBrainsMonoFont.fontFamily}, ${interFont.fontFamily}, monospace`;
  }
  if (lower.includes('inter')) {
    return `${interFont.fontFamily}, ${cairoFont.fontFamily}, sans-serif`;
  }

  return `${raw}, ${cairoFont.fontFamily}, ${interFont.fontFamily}, sans-serif`;
}
