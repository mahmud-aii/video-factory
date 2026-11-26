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
import { getSafeZones } from './lib/rtl';
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

  return (
    <AbsoluteFill
      style={{
        backgroundColor: brand.bg,
        overflow: 'hidden',
      }}
    >
      {/* Subtle branded ambient backdrop */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 18% 14%, ${hexToRgba(
            brand.primary,
            0.16
          )} 0%, transparent 48%), radial-gradient(circle at 86% 84%, ${hexToRgba(
            brand.accent,
            0.12
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

      {/* Minimal top scene progress indicator */}
      {scheduledScenes.length > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 120,
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
                  height: 6,
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
