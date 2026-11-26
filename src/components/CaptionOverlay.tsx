import React, { useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { hexToRgba } from '../lib/color';
import { getSafeZones, rtlSafeTextStyle } from '../lib/rtl';
import type { BrandConfig, CaptionWord, StyleRules } from '../types';

type CaptionChunk = {
  words: CaptionWord[];
  start: number;
  end: number;
};

type CaptionOverlayProps = {
  brand: BrandConfig;
  styleRules?: StyleRules;
  captionWords?: CaptionWord[];
  wordsPerChunk?: number;
};

const PAUSE_SPLIT_SECONDS = 0.6;
const SENTENCE_END_REGEX = /[.!?؟،؛]$/;

function buildCaptionChunks(words: CaptionWord[], maxWordsPerChunk: number): CaptionChunk[] {
  const sanitized = words
    .filter(
      (item) =>
        item &&
        typeof item.word === 'string' &&
        item.word.trim().length > 0 &&
        typeof item.start === 'number' &&
        typeof item.end === 'number' &&
        Number.isFinite(item.start) &&
        Number.isFinite(item.end)
    )
    .map((item) => ({
      word: item.word.trim(),
      start: Math.max(0, item.start),
      end: Math.max(item.start, item.end),
    }));

  if (sanitized.length === 0) {
    return [];
  }

  const chunkLimit = Math.max(3, Math.min(4, Math.round(maxWordsPerChunk)));
  const chunks: CaptionChunk[] = [];
  let buffer: CaptionWord[] = [];

  for (let i = 0; i < sanitized.length; i++) {
    const current = sanitized[i];
    const prev = buffer.length > 0 ? buffer[buffer.length - 1] : null;
    const gap = prev ? current.start - prev.end : 0;

    if (buffer.length >= 2 && gap > PAUSE_SPLIT_SECONDS) {
      chunks.push({
        words: buffer,
        start: buffer[0].start,
        end: buffer[buffer.length - 1].end,
      });
      buffer = [];
    }

    buffer.push(current);

    const endsSentence = SENTENCE_END_REGEX.test(current.word);
    if (buffer.length >= chunkLimit || (endsSentence && buffer.length >= 3)) {
      chunks.push({
        words: buffer,
        start: buffer[0].start,
        end: buffer[buffer.length - 1].end,
      });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    chunks.push({
      words: buffer,
      start: buffer[0].start,
      end: buffer[buffer.length - 1].end,
    });
  }

  return chunks;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  brand,
  styleRules,
  captionWords,
  wordsPerChunk,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const resolvedChunkSize = wordsPerChunk ?? styleRules?.captionStyle?.wordsPerChunk ?? 4;

  const chunks = useMemo(
    () => buildCaptionChunks(captionWords ?? [], resolvedChunkSize),
    [captionWords, resolvedChunkSize]
  );

  if (chunks.length === 0) {
    return null;
  }

  const currentTime = frame / fps;
  const activeChunk = chunks.find(
    (chunk) => currentTime >= chunk.start && currentTime <= chunk.end + 0.12
  );

  if (!activeChunk) {
    return null;
  }

  const chunkStartFrame = Math.floor(activeChunk.start * fps);
  const pop = spring({
    frame: Math.max(0, frame - chunkStartFrame),
    fps,
    config: { damping: 18, stiffness: 260, mass: 0.6 },
  });

  const safeZones = getSafeZones(styleRules);
  const bottomOffset = Math.max(340, styleRules?.captionStyle?.bottomOffset ?? 340);
  const fontSize = styleRules?.captionStyle?.fontSize ?? 52;
  const highlightActiveWord = styleRules?.captionStyle?.highlightActiveWord ?? true;

  // Pick the active spoken word; if between words within the chunk, highlight the most recent spoken word
  let activeWordIndex = activeChunk.words.findIndex(
    (w) => currentTime >= w.start && currentTime <= w.end
  );
  if (activeWordIndex === -1) {
    for (let i = activeChunk.words.length - 1; i >= 0; i--) {
      if (currentTime >= activeChunk.words[i].start) {
        activeWordIndex = i;
        break;
      }
    }
    if (activeWordIndex === -1) {
      activeWordIndex = 0;
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        paddingLeft: safeZones.horizontal,
        paddingRight: safeZones.horizontal,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    >
      <div
        style={{
          ...rtlSafeTextStyle(brand, {
            textAlign: 'center',
            fontSize,
            fontWeight: 800,
            lineHeight: 1.35,
          }),
          display: 'inline-flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          columnGap: 16,
          rowGap: 6,
          maxWidth: '100%',
          padding: '18px 32px',
          borderRadius: 24,
          backgroundColor: hexToRgba('#04070D', 0.82),
          border: `1.5px solid ${hexToRgba(brand.primary, 0.42)}`,
          boxShadow: `0 18px 44px ${hexToRgba('#000000', 0.48)}`,
          transform: `translateY(${(1 - pop) * 14}px) scale(${0.95 + pop * 0.05})`,
          opacity: Math.min(1, pop * 1.4),
        }}
      >
        {activeChunk.words.map((item, idx) => {
          const isActive = highlightActiveWord && idx === activeWordIndex;
          return (
            <span
              key={`${item.start}-${idx}`}
              style={{
                ...rtlSafeTextStyle(brand, {
                  textAlign: 'center',
                  fontSize,
                  fontWeight: isActive ? 900 : 700,
                  lineHeight: 1.3,
                  color: isActive ? brand.primary : brand.text,
                }),
                display: 'inline-block',
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
                textShadow: isActive
                  ? `0 0 24px ${hexToRgba(brand.primary, 0.45)}`
                  : `0 2px 8px ${hexToRgba('#000000', 0.55)}`,
              }}
            >
              {item.word}
            </span>
          );
        })}
      </div>
    </div>
  );
};
