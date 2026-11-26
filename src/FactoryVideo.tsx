import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { CaptionOverlay } from './components/CaptionOverlay';
import { clientAsset } from './lib/assets';
import { hexToRgba } from './lib/color';
import { formatBidiText, getSafeZones, rtlSafeTextStyle } from './lib/rtl';
import { computeSceneTimings } from './lib/timing';
import { SceneRouter } from './scenes/SceneRouter';
import type { FactoryVideoProps } from './types';

export const FactoryVideo: React.FC<FactoryVideoProps> = ({
  brandSlug,
  brand,
  styleRules,
  job,
  resolvedAssets,
  captionWords,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const scheduledScenes = useMemo(
    () => computeSceneTimings(job.scenes, durationInFrames),
    [job.scenes, durationInFrames]
  );

  const safeZones = getSafeZones(styleRules);
  const bgmBaseVolume = job.audio.bgmVolume ?? 0.14;
  // Smooth 0.4s BGM fade-out at the end of the video
  const bgmFadeFrames = Math.min(
    Math.round(fps * 0.4),
    Math.max(1, Math.floor(durationInFrames / 4))
  );
  const hasTransitionSfx = Boolean(
    resolvedAssets.hasTransitionSfx && job.audio.transitionSfxPath
  );
  const transitionSfxSrc =
    hasTransitionSfx && job.audio.transitionSfxPath
      ? clientAsset(brandSlug, job.audio.transitionSfxPath)
      : '';

  // Subtle ambient radial glow drift so non-video scenes never feel static
  const elapsedSec = frame / fps;
  const glowPrimaryX = 20 + Math.sin(elapsedSec * 0.65) * 9;
  const glowPrimaryY = 16 + Math.cos(elapsedSec * 0.5) * 7;
  const glowAccentX = 82 + Math.cos(elapsedSec * 0.6) * 9;
  const glowAccentY = 82 + Math.sin(elapsedSec * 0.48) * 7;

  const isRestrainedAccent =
    typeof styleRules?.accentMaxUsagePercent === 'number' &&
    styleRules.accentMaxUsagePercent <= 5;
  const primaryGlowAlpha = isRestrainedAccent ? 0.06 : 0.16;
  const accentGlowAlpha = isRestrainedAccent ? 0.04 : 0.11;

  const watermarkText = (brand.handle || brand.name || '').trim();
  const isWatermarkHandle = watermarkText.startsWith('@');

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.bg,
        overflow: 'hidden',
      }}
    >
      {/* Subtle drifting ambient radial glow behind non-video scenes */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${glowPrimaryX.toFixed(1)}% ${glowPrimaryY.toFixed(
            1
          )}%, ${hexToRgba(brand.primary, primaryGlowAlpha)} 0%, transparent 48%), radial-gradient(circle at ${glowAccentX.toFixed(
            1
          )}% ${glowAccentY.toFixed(1)}%, ${hexToRgba(
            brand.accent,
            accentGlowAlpha
          )} 0%, transparent 46%)`,
          pointerEvents: 'none',
        }}
      />

      {/* Audio Tracks (rendered strictly when assets exist on disk) */}
      {resolvedAssets.hasVoice && job.audio.voicePath ? (
        <Audio src={clientAsset(brandSlug, job.audio.voicePath)} volume={1} />
      ) : null}

      {resolvedAssets.hasBgm && job.audio.bgmPath ? (
        <Audio
          src={clientAsset(brandSlug, job.audio.bgmPath)}
          loop
          volume={(f) => {
            const fadeOutStart = Math.max(0, durationInFrames - bgmFadeFrames);
            if (f <= fadeOutStart) {
              return bgmBaseVolume;
            }
            return interpolate(f, [fadeOutStart, durationInFrames], [bgmBaseVolume, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
          }}
        />
      ) : null}

      {/* Proportional Lego Scene Sequences (zero black frames) + optional transition SFX */}
      {scheduledScenes.map((scheduled) => (
        <Sequence
          key={scheduled.scene.id ?? `scene-${scheduled.index}-${scheduled.scene.type}`}
          from={scheduled.from}
          durationInFrames={scheduled.durationInFrames}
        >
          {scheduled.index >= 1 && transitionSfxSrc ? (
            <Audio src={transitionSfxSrc} volume={0.25} />
          ) : null}
          <SceneRouter
            scene={scheduled.scene}
            brandSlug={brandSlug}
            brand={brand}
            styleRules={styleRules}
            resolvedAssets={resolvedAssets}
            durationInFrames={scheduled.durationInFrames}
          />
        </Sequence>
      ))}

      {/* Subtle low-opacity brand handle watermark in top safe zone */}
      {watermarkText ? (
        <div
          style={{
            position: 'absolute',
            top: 90,
            left: safeZones.horizontal,
            right: safeZones.horizontal,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          <span
            style={{
              ...rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 24,
                fontWeight: 600,
                color: hexToRgba(brand.text, 0.34),
                lineHeight: 1.2,
              }),
              direction: isWatermarkHandle ? 'ltr' : brand.dir,
              unicodeBidi: isWatermarkHandle ? 'isolate' : undefined,
            }}
          >
            {isWatermarkHandle ? watermarkText : formatBidiText(watermarkText, brand.dir)}
          </span>
        </div>
      ) : null}

      {/* Sleek top scene progress indicator */}
      {scheduledScenes.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 136,
            left: safeZones.horizontal,
            right: safeZones.horizontal,
            display: 'flex',
            flexDirection: brand.dir === 'rtl' ? 'row-reverse' : 'row',
            gap: 10,
            zIndex: 30,
            pointerEvents: 'none',
          }}
        >
          {scheduledScenes.map((scheduled) => {
            const localProgress = interpolate(
              frame,
              [scheduled.from, scheduled.from + scheduled.durationInFrames],
              [0, 1],
              { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
            );
            return (
              <div
                key={`progress-${scheduled.index}`}
                style={{
                  flex: Math.max(0.2, scheduled.scene.weight || 1),
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: hexToRgba(brand.text, 0.16),
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${localProgress * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: brand.primary,
                    marginLeft: brand.dir === 'rtl' ? 'auto' : 0,
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Word-level auto-captions overlay (renders nothing if captionWords is empty) */}
      <CaptionOverlay
        brand={brand}
        styleRules={styleRules}
        captionWords={captionWords}
        wordsPerChunk={job.captions?.wordsPerChunk}
      />
    </AbsoluteFill>
  );
};
