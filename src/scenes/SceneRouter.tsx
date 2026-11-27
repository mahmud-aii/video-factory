import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { clientAsset, normalizeAssetPath } from '../lib/assets';
import { getContrastInk, hexToRgba } from '../lib/color';
import { MONO_FONT_FAMILY } from '../lib/fonts';
import { containsRtlScript, formatBidiText, getSafeZones, rtlSafeTextStyle } from '../lib/rtl';
import type {
  BarChartScene,
  BrandConfig,
  BrollTextScene,
  ComparisonScene,
  ComparisonSide,
  CtaScene,
  HookScene,
  ImageTextScene,
  ResolvedAssets,
  SceneItem,
  StatScene,
  StyleRules,
  TimelineStepsScene,
  UiCardItem,
  UiCardScene,
  WhatsappChatScene,
} from '../types';

export type SceneRouterProps = {
  scene: SceneItem;
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  resolvedAssets: ResolvedAssets;
  durationInFrames: number;
};

type NormalizedComparisonSide = {
  label: string;
  title: string;
  points: string[];
};

function getSpringConfig(styleRules?: StyleRules) {
  const rawPacing =
    typeof styleRules?.pacing === 'string'
      ? styleRules.pacing
      : styleRules?.pacing?.style ?? 'snappy';
  const pacing = rawPacing.toLowerCase();

  if (pacing.includes('editorial') || pacing.includes('calm')) {
    return { damping: 22, stiffness: 130, mass: 0.85 };
  }
  if (pacing.includes('balanced')) {
    return { damping: 18, stiffness: 170, mass: 0.75 };
  }
  return { damping: 16, stiffness: 220, mass: 0.65 };
}

function useEntrance(delayFrames: number, styleRules?: StyleRules) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = spring({
    frame: Math.max(0, frame - delayFrames),
    fps,
    config: getSpringConfig(styleRules),
  });

  const transition = styleRules?.transitionStyle ?? 'spring-cut';
  const translateY =
    transition === 'fade-scale'
      ? interpolate(progress, [0, 1], [18, 0])
      : interpolate(progress, [0, 1], [44, 0]);
  const scale =
    transition === 'fade-scale'
      ? interpolate(progress, [0, 1], [0.94, 1])
      : interpolate(progress, [0, 1], [0.97, 1]);
  const opacity = interpolate(progress, [0, 0.45, 1], [0, 0.9, 1], {
    extrapolateRight: 'clamp',
  });

  return { progress, opacity, transform: `translateY(${translateY}px) scale(${scale})` };
}

function sanitizeStringList(list?: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
}

function normalizeComparisonSide(
  nested?: ComparisonSide,
  flatLabel?: string,
  flatTitle?: string,
  flatPoints?: string[],
  flatItems?: string[]
): NormalizedComparisonSide {
  const label = (nested?.label ?? flatLabel ?? '').trim();
  const title = (nested?.title ?? flatTitle ?? '').trim();
  const points = sanitizeStringList(
    nested?.points ?? nested?.items ?? flatPoints ?? flatItems ?? []
  );

  return {
    label,
    title: title || label,
    points,
  };
}

function normalizeComparisonSides(scene: ComparisonScene): {
  before: NormalizedComparisonSide;
  after: NormalizedComparisonSide;
} {
  const before = normalizeComparisonSide(
    scene?.before ?? scene?.left,
    scene?.leftLabel,
    scene?.leftTitle,
    scene?.leftPoints,
    scene?.leftItems
  );
  const after = normalizeComparisonSide(
    scene?.after ?? scene?.right,
    scene?.rightLabel,
    scene?.rightTitle,
    scene?.rightPoints,
    scene?.rightItems
  );
  return { before, after };
}

const SafeStage: React.FC<{
  brand: BrandConfig;
  styleRules?: StyleRules;
  children: React.ReactNode;
}> = ({ brand, styleRules, children }) => {
  const safeZones = getSafeZones(styleRules);

  return (
    <AbsoluteFill
      style={{
        paddingTop: safeZones.top,
        paddingBottom: safeZones.bottom,
        paddingLeft: safeZones.horizontal,
        paddingRight: safeZones.horizontal,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'stretch',
        direction: brand.dir,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const HookSceneView: React.FC<{
  scene: HookScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const badgeMotion = useEntrance(0, styleRules);
  const headlineMotion = useEntrance(5, styleRules);
  const subtextMotion = useEntrance(12, styleRules);
  const barWidth = interpolate(headlineMotion.progress, [0, 1], [0, 180], {
    extrapolateRight: 'clamp',
  });

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 36,
        }}
      >
        {scene.badge ? (
          <div
            style={{
              opacity: badgeMotion.opacity,
              transform: badgeMotion.transform,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 28px',
              borderRadius: 999,
              backgroundColor: hexToRgba(brand.primary, 0.14),
              border: `1.5px solid ${hexToRgba(brand.primary, 0.55)}`,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                backgroundColor: brand.primary,
                boxShadow: `0 0 18px ${hexToRgba(brand.primary, 0.85)}`,
                flexShrink: 0,
              }}
            />
            <span
              style={rtlSafeTextStyle(brand, {
                fontSize: 32,
                fontWeight: 700,
                color: brand.accent,
                lineHeight: 1.2,
              })}
            >
              {scene.badge}
            </span>
          </div>
        ) : null}

        <h1
          style={{
            ...rtlSafeTextStyle(brand, {
              fontSize: 88,
              fontWeight: 900,
              color: brand.text,
              lineHeight: 1.24,
              margin: 0,
            }),
            opacity: headlineMotion.opacity,
            transform: headlineMotion.transform,
          }}
        >
          {scene.headline ?? ''}
        </h1>

        <div
          style={{
            width: barWidth,
            height: 8,
            borderRadius: 999,
            background: `linear-gradient(90deg, ${brand.primary}, ${brand.accent})`,
          }}
        />

        {scene.subtext ? (
          <p
            style={{
              ...rtlSafeTextStyle(brand, {
                fontSize: 40,
                fontWeight: 500,
                color: brand.mutedText ?? hexToRgba(brand.text, 0.78),
                lineHeight: 1.48,
                margin: 0,
              }),
              opacity: subtextMotion.opacity,
              transform: subtextMotion.transform,
            }}
          >
            {scene.subtext}
          </p>
        ) : null}
      </div>
    </SafeStage>
  );
};

const StatSceneView: React.FC<{
  scene: StatScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
  durationInFrames: number;
}> = ({ scene, brand, styleRules, durationInFrames }) => {
  const frame = useCurrentFrame();
  const cardMotion = useEntrance(0, styleRules);
  const labelMotion = useEntrance(8, styleRules);

  const countFrames = Math.max(18, Math.min(48, Math.floor(durationInFrames * 0.6)));
  const progress = interpolate(frame, [0, countFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  const rawMetric = scene.value ?? scene.number ?? 0;
  const safeMetric =
    typeof rawMetric === 'number' && Number.isFinite(rawMetric) ? rawMetric : 0;

  const decimals = scene.decimals ?? (Number.isInteger(safeMetric) ? 0 : 1);
  const animatedValue = safeMetric * progress;
  const formattedNumber =
    decimals > 0
      ? animatedValue.toFixed(decimals)
      : Math.round(animatedValue).toLocaleString('en-US');

  const suffixIsRtl = containsRtlScript(scene.suffix);
  const prefixIsRtl = containsRtlScript(scene.prefix);
  const hasRtlUnit = suffixIsRtl || prefixIsRtl;

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          opacity: cardMotion.opacity,
          transform: cardMotion.transform,
          backgroundColor: hexToRgba(brand.surface, 0.92),
          border: `2px solid ${hexToRgba(brand.primary, 0.4)}`,
          borderRadius: 40,
          padding: '72px 56px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 28,
          boxShadow: `0 30px 90px ${hexToRgba('#000000', 0.42)}, inset 0 1px 0 ${hexToRgba(
            brand.text,
            0.08
          )}`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at 50% 0%, ${hexToRgba(
              brand.primary,
              0.22
            )}, transparent 65%)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            direction: hasRtlUnit ? brand.dir : 'ltr',
            display: 'inline-flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: hasRtlUnit ? 18 : 8,
            zIndex: 1,
          }}
        >
          {scene.prefix ? (
            <span
              style={
                prefixIsRtl
                  ? rtlSafeTextStyle(brand, {
                      fontSize: 80,
                      fontWeight: 800,
                      color: brand.accent,
                      lineHeight: 1.15,
                    })
                  : {
                      fontFamily: MONO_FONT_FAMILY,
                      fontSize: 108,
                      fontWeight: 800,
                      color: brand.accent,
                      lineHeight: 1.05,
                    }
              }
            >
              {scene.prefix}
            </span>
          ) : null}

          <span
            style={{
              direction: 'ltr',
              unicodeBidi: 'isolate',
              fontFamily: MONO_FONT_FAMILY,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 168,
              fontWeight: 800,
              lineHeight: 1.05,
              color: brand.primary,
              letterSpacing: '-0.02em',
              textShadow: `0 10px 42px ${hexToRgba(brand.primary, 0.32)}`,
            }}
          >
            {formattedNumber}
          </span>

          {scene.suffix ? (
            <span
              style={
                suffixIsRtl
                  ? rtlSafeTextStyle(brand, {
                      fontSize: 80,
                      fontWeight: 800,
                      color: brand.accent,
                      lineHeight: 1.15,
                    })
                  : {
                      fontFamily: MONO_FONT_FAMILY,
                      fontSize: 108,
                      fontWeight: 800,
                      color: brand.accent,
                      lineHeight: 1.05,
                    }
              }
            >
              {scene.suffix.trim()}
            </span>
          ) : null}
        </div>

        {scene.label ? (
          <div
            style={{
              ...rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 50,
                fontWeight: 800,
                color: brand.text,
                lineHeight: 1.32,
              }),
              opacity: labelMotion.opacity,
              transform: labelMotion.transform,
              zIndex: 1,
            }}
          >
            {scene.label}
          </div>
        ) : null}

        {scene.sublabel ? (
          <div
            style={{
              ...rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 32,
                fontWeight: 500,
                color: brand.mutedText ?? hexToRgba(brand.text, 0.72),
                lineHeight: 1.45,
              }),
              opacity: labelMotion.opacity,
              transform: labelMotion.transform,
              zIndex: 1,
            }}
          >
            {scene.sublabel}
          </div>
        ) : null}
      </div>
    </SafeStage>
  );
};

const BrollTextSceneView: React.FC<{
  scene: BrollTextScene;
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  resolvedAssets: ResolvedAssets;
  durationInFrames: number;
}> = ({ scene, brandSlug, brand, styleRules, resolvedAssets, durationInFrames }) => {
  const frame = useCurrentFrame();
  const tagMotion = useEntrance(0, styleRules);
  const textMotion = useEntrance(6, styleRules);
  const subMotion = useEntrance(12, styleRules);

  const normalizedVideoPath = scene.videoPath ? normalizeAssetPath(scene.videoPath) : '';
  const validVideos = resolvedAssets?.validVideos ?? [];
  const hasValidVideo = Boolean(normalizedVideoPath && validVideos.includes(normalizedVideoPath));

  const zoom = interpolate(frame, [0, Math.max(1, durationInFrames)], [1.0, 1.06], {
    extrapolateRight: 'clamp',
  });
  const overlayOpacity = scene.overlayOpacity ?? 0.68;

  return (
    <AbsoluteFill style={{ backgroundColor: brand.bg, overflow: 'hidden' }}>
      {hasValidVideo ? (
        <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
          <OffthreadVideo
            src={clientAsset(brandSlug, normalizedVideoPath)}
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Graceful styled dot-grid fallback when B-roll file is missing */
        <AbsoluteFill
          style={{
            backgroundColor: brand.bg,
            backgroundImage: `radial-gradient(${hexToRgba(brand.primary, 0.28)} 2px, transparent 2px)`,
            backgroundSize: '42px 42px',
            backgroundPosition: `${(frame * 0.35) % 42}px ${(frame * 0.25) % 42}px`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 20% 25%, ${hexToRgba(
                brand.primary,
                0.24
              )}, transparent 52%), radial-gradient(circle at 82% 72%, ${hexToRgba(
                brand.accent,
                0.18
              )}, transparent 50%)`,
            }}
          />
        </AbsoluteFill>
      )}

      {/* Dark gradient overlay for guaranteed headline contrast */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(
            brand.bg,
            Math.max(0.45, overlayOpacity - 0.15)
          )} 0%, ${hexToRgba(brand.bg, overlayOpacity)} 52%, ${hexToRgba(
            brand.bg,
            Math.min(0.94, overlayOpacity + 0.22)
          )} 100%)`,
        }}
      />

      <SafeStage brand={brand} styleRules={styleRules}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            padding: '54px 48px',
            borderRadius: 36,
            backgroundColor: hexToRgba(brand.surface, 0.72),
            border: `1.5px solid ${hexToRgba(brand.primary, 0.38)}`,
            boxShadow: `0 24px 64px ${hexToRgba('#000000', 0.45)}`,
          }}
        >
          {scene.tag ? (
            <div
              style={{
                opacity: tagMotion.opacity,
                transform: tagMotion.transform,
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '10px 24px',
                borderRadius: 999,
                backgroundColor: hexToRgba(brand.primary, 0.18),
                border: `1px solid ${hexToRgba(brand.primary, 0.55)}`,
              }}
            >
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 30,
                  fontWeight: 700,
                  color: brand.accent,
                  lineHeight: 1.2,
                })}
              >
                {scene.tag}
              </span>
            </div>
          ) : null}

          <h2
            style={{
              ...rtlSafeTextStyle(brand, {
                fontSize: 74,
                fontWeight: 900,
                color: brand.text,
                lineHeight: 1.26,
                margin: 0,
              }),
              opacity: textMotion.opacity,
              transform: textMotion.transform,
            }}
          >
            {scene.headline ?? ''}
          </h2>

          {scene.subtext ? (
            <p
              style={{
                ...rtlSafeTextStyle(brand, {
                  fontSize: 38,
                  fontWeight: 500,
                  color: brand.mutedText ?? hexToRgba(brand.text, 0.82),
                  lineHeight: 1.48,
                  margin: 0,
                }),
                opacity: subMotion.opacity,
                transform: subMotion.transform,
              }}
            >
              {scene.subtext}
            </p>
          ) : null}
        </div>
      </SafeStage>
    </AbsoluteFill>
  );
};

const ImageTextSceneView: React.FC<{
  scene: ImageTextScene;
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  resolvedAssets: ResolvedAssets;
  durationInFrames: number;
}> = ({ scene, brandSlug, brand, styleRules, resolvedAssets, durationInFrames }) => {
  const frame = useCurrentFrame();
  const tagMotion = useEntrance(0, styleRules);
  const headlineMotion = useEntrance(5, styleRules);
  const subtextMotion = useEntrance(12, styleRules);

  const normalizedImagePath = scene.imagePath ? normalizeAssetPath(scene.imagePath) : '';
  const validImages = resolvedAssets?.validImages ?? [];
  const hasValidImage = Boolean(normalizedImagePath && validImages.includes(normalizedImagePath));

  const zoomMode = scene.zoom ?? 'in';
  const kenBurnsScale = interpolate(
    frame,
    [0, Math.max(1, durationInFrames)],
    zoomMode === 'out' ? [1.12, 1.0] : [1.0, 1.12],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );
  const overlayOpacity = scene.overlayOpacity ?? 0.68;

  return (
    <AbsoluteFill style={{ backgroundColor: brand.bg, overflow: 'hidden' }}>
      {hasValidImage ? (
        <AbsoluteFill style={{ transform: `scale(${kenBurnsScale})` }}>
          <Img
            src={clientAsset(brandSlug, normalizedImagePath)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </AbsoluteFill>
      ) : (
        /* Graceful styled dot-grid fallback when imagePath is missing */
        <AbsoluteFill
          style={{
            backgroundColor: brand.bg,
            backgroundImage: `radial-gradient(${hexToRgba(brand.primary, 0.28)} 2px, transparent 2px)`,
            backgroundSize: '42px 42px',
            backgroundPosition: `${(frame * 0.3) % 42}px ${(frame * 0.2) % 42}px`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at 78% 22%, ${hexToRgba(
                brand.primary,
                0.22
              )}, transparent 52%), radial-gradient(circle at 20% 78%, ${hexToRgba(
                brand.accent,
                0.16
              )}, transparent 50%)`,
            }}
          />
        </AbsoluteFill>
      )}

      {/* Dark readability gradient overlay */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${hexToRgba(
            brand.bg,
            Math.max(0.42, overlayOpacity - 0.18)
          )} 0%, ${hexToRgba(brand.bg, overlayOpacity)} 55%, ${hexToRgba(
            brand.bg,
            Math.min(0.95, overlayOpacity + 0.24)
          )} 100%)`,
        }}
      />

      <SafeStage brand={brand} styleRules={styleRules}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 30,
            padding: '54px 48px',
            borderRadius: 36,
            backgroundColor: hexToRgba(brand.surface, 0.74),
            border: `1.5px solid ${hexToRgba(brand.primary, 0.4)}`,
            boxShadow: `0 24px 64px ${hexToRgba('#000000', 0.48)}`,
          }}
        >
          {scene.tag ? (
            <div
              style={{
                opacity: tagMotion.opacity,
                transform: tagMotion.transform,
                display: 'inline-flex',
                alignSelf: 'flex-start',
                padding: '10px 24px',
                borderRadius: 999,
                backgroundColor: hexToRgba(brand.primary, 0.18),
                border: `1px solid ${hexToRgba(brand.primary, 0.55)}`,
              }}
            >
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 30,
                  fontWeight: 700,
                  color: brand.accent,
                  lineHeight: 1.2,
                })}
              >
                {scene.tag}
              </span>
            </div>
          ) : null}

          <h2
            style={{
              ...rtlSafeTextStyle(brand, {
                fontSize: 74,
                fontWeight: 900,
                color: brand.text,
                lineHeight: 1.26,
                margin: 0,
              }),
              opacity: headlineMotion.opacity,
              transform: headlineMotion.transform,
            }}
          >
            {scene.headline ?? ''}
          </h2>

          {scene.subtext ? (
            <p
              style={{
                ...rtlSafeTextStyle(brand, {
                  fontSize: 38,
                  fontWeight: 500,
                  color: brand.mutedText ?? hexToRgba(brand.text, 0.84),
                  lineHeight: 1.48,
                  margin: 0,
                }),
                opacity: subtextMotion.opacity,
                transform: subtextMotion.transform,
              }}
            >
              {scene.subtext}
            </p>
          ) : null}
        </div>
      </SafeStage>
    </AbsoluteFill>
  );
};

const ComparisonSceneView: React.FC<{
  scene: ComparisonScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const headerMotion = useEntrance(0, styleRules);
  const beforeMotion = useEntrance(5, styleRules);
  const afterMotion = useEntrance(13, styleRules);

  const { before, after } = normalizeComparisonSides(scene);
  const showBeforeBadge = Boolean(before.label && before.label !== before.title);
  const showAfterBadge = Boolean(after.label && after.label !== after.title);

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        {scene.eyebrow || scene.headline ? (
          <div
            style={{
              opacity: headerMotion.opacity,
              transform: headerMotion.transform,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginBottom: 8,
            }}
          >
            {scene.eyebrow ? (
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 30,
                  fontWeight: 700,
                  color: brand.accent,
                  lineHeight: 1.2,
                })}
              >
                {scene.eyebrow}
              </span>
            ) : null}
            {scene.headline ? (
              <h2
                style={rtlSafeTextStyle(brand, {
                  fontSize: 60,
                  fontWeight: 900,
                  color: brand.text,
                  lineHeight: 1.25,
                  margin: 0,
                })}
              >
                {scene.headline}
              </h2>
            ) : null}
          </div>
        ) : null}

        {/* BEFORE / LEFT card */}
        <div
          style={{
            opacity: beforeMotion.opacity,
            transform: beforeMotion.transform,
            backgroundColor: hexToRgba(brand.surface, 0.86),
            border: `1.5px solid ${hexToRgba('#EF4444', 0.45)}`,
            borderRadius: 32,
            padding: '38px 42px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {showBeforeBadge ? (
              <span
                style={{
                  ...rtlSafeTextStyle(brand, {
                    fontSize: 28,
                    fontWeight: 800,
                    color: '#FCA5A5',
                    lineHeight: 1.2,
                  }),
                  padding: '8px 20px',
                  borderRadius: 999,
                  backgroundColor: hexToRgba('#EF4444', 0.16),
                }}
              >
                {before.label}
              </span>
            ) : (
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 44,
                  fontWeight: 800,
                  color: hexToRgba(brand.text, 0.92),
                  lineHeight: 1.25,
                })}
              >
                {before.title}
              </span>
            )}
            <span style={{ fontSize: 30, color: '#F87171', fontWeight: 800, flexShrink: 0 }}>
              ✕
            </span>
          </div>

          {showBeforeBadge && before.title ? (
            <div
              style={rtlSafeTextStyle(brand, {
                fontSize: 44,
                fontWeight: 800,
                color: hexToRgba(brand.text, 0.9),
                lineHeight: 1.25,
              })}
            >
              {before.title}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {before.points.map((point, idx) => (
              <div
                key={`before-${idx}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: '#F87171',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 33,
                    fontWeight: 500,
                    color: brand.mutedText ?? hexToRgba(brand.text, 0.78),
                    lineHeight: 1.38,
                  })}
                >
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AFTER / RIGHT card */}
        <div
          style={{
            opacity: afterMotion.opacity,
            transform: afterMotion.transform,
            backgroundColor: hexToRgba(brand.surface, 0.96),
            border: `2px solid ${brand.primary}`,
            borderRadius: 32,
            padding: '42px 42px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            boxShadow: `0 22px 64px ${hexToRgba(brand.primary, 0.22)}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            {showAfterBadge ? (
              <span
                style={{
                  ...rtlSafeTextStyle(brand, {
                    fontSize: 28,
                    fontWeight: 800,
                    color: getContrastInk(brand.primary),
                    lineHeight: 1.2,
                  }),
                  padding: '8px 22px',
                  borderRadius: 999,
                  backgroundColor: brand.primary,
                }}
              >
                {after.label}
              </span>
            ) : (
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 46,
                  fontWeight: 900,
                  color: brand.text,
                  lineHeight: 1.25,
                })}
              >
                {after.title}
              </span>
            )}
            <span style={{ fontSize: 34, color: brand.primary, fontWeight: 900, flexShrink: 0 }}>
              ✓
            </span>
          </div>

          {showAfterBadge && after.title ? (
            <div
              style={rtlSafeTextStyle(brand, {
                fontSize: 46,
                fontWeight: 900,
                color: brand.text,
                lineHeight: 1.25,
              })}
            >
              {after.title}
            </div>
          ) : null}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {after.points.map((point, idx) => (
              <div
                key={`after-${idx}`}
                style={{ display: 'flex', alignItems: 'center', gap: 16 }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    backgroundColor: hexToRgba(brand.primary, 0.2),
                    color: brand.primary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 34,
                    fontWeight: 700,
                    color: brand.text,
                    lineHeight: 1.38,
                  })}
                >
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SafeStage>
  );
};

function normalizeUiCardItem(item: string | UiCardItem): UiCardItem {
  if (typeof item === 'string') {
    return { title: item };
  }
  return {
    title: item?.title ?? '',
    detail: item?.detail,
    status: item?.status,
  };
}

const UiCardSceneView: React.FC<{
  scene: UiCardScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardMotion = useEntrance(0, styleRules);
  const isWhatsapp = scene.variant === 'whatsapp';

  const primaryHeader = (scene.appName ?? scene.title ?? brand.name ?? '').trim();
  const secondaryHeader = (
    scene.headerTitle ?? (scene.appName && scene.title ? scene.title : '')
  ).trim();
  const pillText = (scene.timestamp ?? scene.badge ?? '').trim();
  const items = Array.isArray(scene.items) ? scene.items.map(normalizeUiCardItem) : [];

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          opacity: cardMotion.opacity,
          transform: cardMotion.transform,
          backgroundColor: hexToRgba(brand.surface, 0.96),
          border: `2px solid ${hexToRgba(brand.primary, 0.45)}`,
          borderRadius: 38,
          overflow: 'hidden',
          boxShadow: `0 30px 90px ${hexToRgba('#000000', 0.48)}`,
        }}
      >
        {/* Notification Card Header */}
        <div
          style={{
            padding: '32px 40px',
            backgroundColor: isWhatsapp
              ? hexToRgba(brand.primary, 0.16)
              : hexToRgba(brand.text, 0.04),
            borderBottom: `1.5px solid ${hexToRgba(brand.text, 0.09)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1, minWidth: 0 }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: isWhatsapp ? 999 : 18,
                backgroundColor: brand.primary,
                color: getContrastInk(brand.primary),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: MONO_FONT_FAMILY,
                fontSize: 28,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {isWhatsapp ? 'WA' : '●'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
              {primaryHeader ? (
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 34,
                    fontWeight: 800,
                    color: brand.text,
                    lineHeight: 1.24,
                  })}
                >
                  {primaryHeader}
                </span>
              ) : null}
              {secondaryHeader ? (
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 25,
                    fontWeight: 600,
                    color: brand.accent,
                    lineHeight: 1.2,
                  })}
                >
                  {secondaryHeader}
                </span>
              ) : null}
            </div>
          </div>

          {pillText ? (
            <span
              style={{
                ...rtlSafeTextStyle(brand, {
                  fontSize: 24,
                  fontWeight: 700,
                  color: brand.primary,
                  lineHeight: 1.2,
                }),
                padding: '8px 18px',
                borderRadius: 999,
                backgroundColor: hexToRgba(brand.primary, 0.14),
                border: `1px solid ${hexToRgba(brand.primary, 0.4)}`,
                flexShrink: 0,
              }}
            >
              {pillText}
            </span>
          ) : null}
        </div>

        {/* Animated Bullet Items */}
        <div
          style={{
            padding: '36px 40px 44px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {items.map((item, idx) => {
            const itemSpring = spring({
              frame: Math.max(0, frame - (8 + idx * 7)),
              fps,
              config: getSpringConfig(styleRules),
            });
            const y = interpolate(itemSpring, [0, 1], [28, 0]);
            const itemOpacity = interpolate(itemSpring, [0, 0.5, 1], [0, 0.9, 1], {
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={`ui-item-${idx}`}
                style={{
                  opacity: itemOpacity,
                  transform: `translateY(${y}px)`,
                  padding: '26px 28px',
                  borderRadius: 24,
                  backgroundColor: hexToRgba(brand.bg, 0.68),
                  border: `1px solid ${hexToRgba(brand.text, 0.1)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 20,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 18, flex: 1 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      backgroundColor: hexToRgba(brand.primary, 0.18),
                      border: `1.5px solid ${brand.primary}`,
                      color: brand.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 18,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {isWhatsapp ? '✓✓' : '✓'}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span
                      style={rtlSafeTextStyle(brand, {
                        fontSize: 34,
                        fontWeight: 700,
                        color: brand.text,
                        lineHeight: 1.32,
                      })}
                    >
                      {item.title}
                    </span>
                    {item.detail ? (
                      <span
                        style={rtlSafeTextStyle(brand, {
                          fontSize: 26,
                          fontWeight: 500,
                          color: brand.mutedText ?? hexToRgba(brand.text, 0.72),
                          lineHeight: 1.35,
                        })}
                      >
                        {item.detail}
                      </span>
                    ) : null}
                  </div>
                </div>

                {item.status ? (
                  <span
                    style={{
                      ...rtlSafeTextStyle(brand, {
                        fontSize: 24,
                        fontWeight: 800,
                        color: brand.accent,
                        lineHeight: 1.2,
                      }),
                      padding: '8px 18px',
                      borderRadius: 999,
                      backgroundColor: hexToRgba(brand.primary, 0.14),
                      flexShrink: 0,
                    }}
                  >
                    {item.status}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </SafeStage>
  );
};

const CtaSceneView: React.FC<{
  scene: CtaScene;
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  resolvedAssets: ResolvedAssets;
}> = ({ scene, brandSlug, brand, styleRules, resolvedAssets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoMotion = useEntrance(0, styleRules);
  const headlineMotion = useEntrance(5, styleRules);
  const pillMotion = useEntrance(12, styleRules);

  const pulse = 1 + Math.sin((frame / fps) * Math.PI * 2.2) * 0.025;
  const showLogo = Boolean(resolvedAssets?.hasLogo && brand.logoPath);

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 34,
        }}
      >
        {showLogo ? (
          <div
            style={{
              opacity: logoMotion.opacity,
              transform: logoMotion.transform,
              padding: 20,
              borderRadius: 32,
              backgroundColor: hexToRgba(brand.surface, 0.9),
              border: `1.5px solid ${hexToRgba(brand.primary, 0.35)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Img
              src={clientAsset(brandSlug, brand.logoPath)}
              style={{
                maxWidth: 260,
                maxHeight: 120,
                objectFit: 'contain',
              }}
            />
          </div>
        ) : null}

        {scene.eyebrow ? (
          <span
            style={{
              ...rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 32,
                fontWeight: 700,
                color: brand.accent,
                lineHeight: 1.2,
              }),
              opacity: logoMotion.opacity,
              transform: logoMotion.transform,
            }}
          >
            {scene.eyebrow}
          </span>
        ) : null}

        <h2
          style={{
            ...rtlSafeTextStyle(brand, {
              textAlign: 'center',
              fontSize: 80,
              fontWeight: 900,
              color: brand.text,
              lineHeight: 1.24,
              margin: 0,
            }),
            opacity: headlineMotion.opacity,
            transform: headlineMotion.transform,
          }}
        >
          {scene.headline ?? ''}
        </h2>

        {scene.subtext ? (
          <p
            style={{
              ...rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 38,
                fontWeight: 500,
                color: brand.mutedText ?? hexToRgba(brand.text, 0.78),
                lineHeight: 1.46,
                margin: 0,
              }),
              opacity: headlineMotion.opacity,
              transform: headlineMotion.transform,
            }}
          >
            {scene.subtext}
          </p>
        ) : null}

        {scene.ctaText ? (
          <div
            style={{
              marginTop: 14,
              opacity: pillMotion.opacity,
              transform: `${pillMotion.transform} scale(${pulse})`,
              padding: '28px 64px',
              borderRadius: 999,
              background: `linear-gradient(135deg, ${brand.primary}, ${brand.accent})`,
              boxShadow: `0 20px 56px ${hexToRgba(brand.primary, 0.42)}`,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={rtlSafeTextStyle(brand, {
                textAlign: 'center',
                fontSize: 40,
                fontWeight: 900,
                color: getContrastInk(brand.primary),
                lineHeight: 1.2,
              })}
            >
              {scene.ctaText}
            </span>
          </div>
        ) : null}

        {scene.footerText || brand.handle ? (
          (() => {
            const footer = scene.footerText ?? brand.handle ?? '';
            const isHandle = footer.trim().startsWith('@');
            return (
              <span
                style={{
                  ...rtlSafeTextStyle(brand, {
                    textAlign: 'center',
                    fontSize: 28,
                    fontWeight: 600,
                    color: brand.mutedText ?? hexToRgba(brand.text, 0.65),
                    lineHeight: 1.2,
                  }),
                  direction: isHandle ? 'ltr' : brand.dir,
                  unicodeBidi: isHandle ? 'isolate' : undefined,
                  opacity: pillMotion.opacity,
                }}
              >
                {footer}
              </span>
            );
          })()
        ) : null}
      </div>
    </SafeStage>
  );
};

const WhatsappChatSceneView: React.FC<{
  scene: WhatsappChatScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardMotion = useEntrance(0, styleRules);
  const isRtl = brand.dir === 'rtl';
  const botInk = getContrastInk(brand.primary);
  const contactName = (scene.contactName ?? brand.name ?? '').trim();
  const initialChar = (contactName.charAt(0) || 'W').toUpperCase();
  const statusLabel = isRtl ? 'رد فوري نشط' : 'Instant Reply Active';
  const messages = Array.isArray(scene.messages) ? scene.messages : [];

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          opacity: cardMotion.opacity,
          transform: cardMotion.transform,
          backgroundColor: hexToRgba(brand.surface, 0.96),
          border: `2px solid ${hexToRgba(brand.primary, 0.42)}`,
          borderRadius: 40,
          overflow: 'hidden',
          boxShadow: `0 32px 92px ${hexToRgba('#000000', 0.5)}`,
        }}
      >
        <div
          style={{
            padding: '28px 36px',
            backgroundColor: hexToRgba(brand.bg, 0.72),
            borderBottom: `1.5px solid ${hexToRgba(brand.text, 0.09)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 999,
                backgroundColor: hexToRgba(brand.primary, 0.18),
                border: `2px solid ${brand.primary}`,
                color: brand.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: MONO_FONT_FAMILY,
                fontSize: 30,
                fontWeight: 800,
                flexShrink: 0,
              }}
            >
              {initialChar}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 34,
                  fontWeight: 800,
                  color: brand.text,
                  lineHeight: 1.2,
                })}
              >
                {contactName}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: brand.primary,
                    boxShadow: `0 0 12px ${hexToRgba(brand.primary, 0.85)}`,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 24,
                    fontWeight: 600,
                    color: brand.accent,
                    lineHeight: 1.2,
                  })}
                >
                  {statusLabel}
                </span>
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '8px 18px',
              borderRadius: 999,
              backgroundColor: hexToRgba(brand.primary, 0.14),
              border: `1px solid ${hexToRgba(brand.primary, 0.4)}`,
              fontFamily: MONO_FONT_FAMILY,
              fontSize: 22,
              fontWeight: 700,
              color: brand.primary,
              direction: 'ltr',
            }}
          >
            24/7
          </div>
        </div>

        <div
          style={{
            padding: '34px 32px 42px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
            backgroundImage: `radial-gradient(${hexToRgba(brand.text, 0.04)} 1.5px, transparent 1.5px)`,
            backgroundSize: '26px 26px',
          }}
        >
          {messages.map((msg, idx) => {
            const bubbleSpring = spring({
              frame: Math.max(0, frame - (7 + idx * 10)),
              fps,
              config: getSpringConfig(styleRules),
            });
            const y = interpolate(bubbleSpring, [0, 1], [26, 0]);
            const scale = interpolate(bubbleSpring, [0, 1], [0.95, 1]);
            const opacity = interpolate(bubbleSpring, [0, 0.45, 1], [0, 0.92, 1], {
              extrapolateRight: 'clamp',
            });

            const isBot = msg?.sender === 'bot';
            const alignSelf = isBot ? 'flex-end' : 'flex-start';

            const bubbleRadius = isBot
              ? isRtl
                ? '28px 28px 28px 10px'
                : '28px 28px 10px 28px'
              : isRtl
                ? '28px 28px 10px 28px'
                : '28px 28px 28px 10px';

            return (
              <div
                key={`chat-msg-${idx}`}
                style={{
                  alignSelf,
                  maxWidth: '86%',
                  opacity,
                  transform: `translateY(${y}px) scale(${scale})`,
                  padding: '22px 26px 18px',
                  borderRadius: bubbleRadius,
                  backgroundColor: isBot ? brand.primary : hexToRgba(brand.bg, 0.9),
                  border: isBot
                    ? `1.5px solid ${hexToRgba(brand.accent, 0.7)}`
                    : `1.5px solid ${hexToRgba(brand.text, 0.12)}`,
                  boxShadow: isBot
                    ? `0 16px 38px ${hexToRgba(brand.primary, 0.28)}`
                    : `0 10px 26px ${hexToRgba('#000000', 0.28)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <span
                  style={rtlSafeTextStyle(brand, {
                    fontSize: 32,
                    fontWeight: isBot ? 800 : 600,
                    color: isBot ? botInk : brand.text,
                    lineHeight: 1.42,
                  })}
                >
                  {msg?.text ?? ''}
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 8,
                    direction: 'ltr',
                  }}
                >
                  {msg?.time ? (
                    <span
                      style={{
                        fontFamily: MONO_FONT_FAMILY,
                        fontSize: 20,
                        fontWeight: 600,
                        color: isBot
                          ? hexToRgba(botInk, 0.72)
                          : brand.mutedText ?? hexToRgba(brand.text, 0.6),
                      }}
                    >
                      {msg.time}
                    </span>
                  ) : null}
                  {isBot ? (
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 900,
                        color: hexToRgba(botInk, 0.85),
                      }}
                    >
                      ✓✓
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeStage>
  );
};

const BarChartSceneView: React.FC<{
  scene: BarChartScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cardMotion = useEntrance(0, styleRules);
  const titleMotion = useEntrance(4, styleRules);
  const isRtl = brand.dir === 'rtl';

  const bars = (Array.isArray(scene.bars) ? scene.bars : []).slice(0, 5);
  const maxVal = Math.max(
    1,
    ...bars.map((b) => (typeof b?.value === 'number' && Number.isFinite(b.value) ? Math.max(0, b.value) : 0))
  );

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          opacity: cardMotion.opacity,
          transform: cardMotion.transform,
          backgroundColor: hexToRgba(brand.surface, 0.94),
          border: `1.5px solid ${hexToRgba(brand.primary, 0.36)}`,
          borderRadius: 38,
          padding: '50px 44px',
          display: 'flex',
          flexDirection: 'column',
          gap: 36,
          boxShadow: `0 30px 84px ${hexToRgba('#000000', 0.45)}`,
        }}
      >
        {scene.title ? (
          <h2
            style={{
              ...rtlSafeTextStyle(brand, {
                fontSize: 54,
                fontWeight: 900,
                color: brand.text,
                lineHeight: 1.28,
                margin: 0,
              }),
              opacity: titleMotion.opacity,
              transform: titleMotion.transform,
            }}
          >
            {scene.title}
          </h2>
        ) : null}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {bars.map((bar, idx) => {
            const barSpring = spring({
              frame: Math.max(0, frame - (8 + idx * 7)),
              fps,
              config: getSpringConfig(styleRules),
            });
            const safeVal =
              typeof bar?.value === 'number' && Number.isFinite(bar.value)
                ? Math.max(0, bar.value)
                : 0;
            const targetPct = Math.max(6, (safeVal / maxVal) * 100);
            const widthPct = Math.max(0, Math.min(100, targetPct * barSpring));
            const animatedDisplay =
              bar?.displayValue ?? Math.round(safeVal * barSpring).toLocaleString('en-US');
            const isHighlighted = Boolean(bar?.highlight);

            return (
              <div
                key={`bar-${idx}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <span
                    style={rtlSafeTextStyle(brand, {
                      fontSize: 32,
                      fontWeight: isHighlighted ? 800 : 600,
                      color: isHighlighted
                        ? brand.text
                        : brand.mutedText ?? hexToRgba(brand.text, 0.78),
                      lineHeight: 1.3,
                    })}
                  >
                    {bar?.label ?? ''}
                  </span>

                  <span
                    style={{
                      direction: 'ltr',
                      unicodeBidi: 'isolate',
                      fontFamily: MONO_FONT_FAMILY,
                      fontVariantNumeric: 'tabular-nums',
                      fontSize: 34,
                      fontWeight: 800,
                      color: isHighlighted ? brand.primary : brand.text,
                      flexShrink: 0,
                    }}
                  >
                    {animatedDisplay}
                  </span>
                </div>

                <div
                  style={{
                    width: '100%',
                    height: 36,
                    borderRadius: 999,
                    backgroundColor: hexToRgba(brand.bg, 0.85),
                    border: `1px solid ${hexToRgba(brand.text, 0.08)}`,
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: isHighlighted
                        ? `linear-gradient(${isRtl ? '270deg' : '90deg'}, ${brand.primary}, ${
                            brand.accent
                          })`
                        : hexToRgba(brand.text, 0.28),
                      boxShadow: isHighlighted
                        ? `0 0 24px ${hexToRgba(brand.primary, 0.45)}`
                        : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeStage>
  );
};

const TimelineStepsSceneView: React.FC<{
  scene: TimelineStepsScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleMotion = useEntrance(0, styleRules);
  const isRtl = brand.dir === 'rtl';
  const steps = Array.isArray(scene.steps) ? scene.steps : [];

  const lineProgress = interpolate(frame, [4, 34], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 38 }}>
        {scene.title ? (
          <h2
            style={{
              ...rtlSafeTextStyle(brand, {
                fontSize: 58,
                fontWeight: 900,
                color: brand.text,
                lineHeight: 1.26,
                margin: 0,
              }),
              opacity: titleMotion.opacity,
              transform: titleMotion.transform,
            }}
          >
            {scene.title}
          </h2>
        ) : null}

        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 28,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 38,
              bottom: 38,
              ...(isRtl ? { right: 36 } : { left: 36 }),
              width: 4,
              borderRadius: 999,
              backgroundColor: hexToRgba(brand.text, 0.12),
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${lineProgress}%`,
                borderRadius: 999,
                background: `linear-gradient(180deg, ${brand.primary}, ${brand.accent})`,
                boxShadow: `0 0 18px ${hexToRgba(brand.primary, 0.55)}`,
              }}
            />
          </div>

          {steps.map((step, idx) => {
            const stepSpring = spring({
              frame: Math.max(0, frame - (6 + idx * 10)),
              fps,
              config: getSpringConfig(styleRules),
            });
            const translateY = interpolate(stepSpring, [0, 1], [30, 0]);
            const opacity = interpolate(stepSpring, [0, 0.45, 1], [0, 0.92, 1], {
              extrapolateRight: 'clamp',
            });
            const isFinalStep = idx === steps.length - 1;

            return (
              <div
                key={`step-${idx}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 24,
                  opacity,
                  transform: `translateY(${translateY}px)`,
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 24,
                    backgroundColor: isFinalStep ? brand.primary : brand.surface,
                    border: `2px solid ${brand.primary}`,
                    color: isFinalStep ? getContrastInk(brand.primary) : brand.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: MONO_FONT_FAMILY,
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 30,
                    fontWeight: 800,
                    direction: 'ltr',
                    boxShadow: isFinalStep
                      ? `0 12px 32px ${hexToRgba(brand.primary, 0.35)}`
                      : `0 10px 24px ${hexToRgba('#000000', 0.32)}`,
                    flexShrink: 0,
                  }}
                >
                  {step?.number ?? String(idx + 1).padStart(2, '0')}
                </div>

                <div
                  style={{
                    flex: 1,
                    padding: '28px 32px',
                    borderRadius: 28,
                    backgroundColor: hexToRgba(brand.surface, 0.94),
                    border: `1.5px solid ${hexToRgba(
                      brand.primary,
                      isFinalStep ? 0.55 : 0.24
                    )}`,
                    boxShadow: `0 18px 46px ${hexToRgba('#000000', 0.32)}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <span
                    style={rtlSafeTextStyle(brand, {
                      fontSize: 38,
                      fontWeight: 800,
                      color: brand.text,
                      lineHeight: 1.3,
                    })}
                  >
                    {step?.title ?? ''}
                  </span>

                  {step?.subtitle ? (
                    <span
                      style={rtlSafeTextStyle(brand, {
                        fontSize: 28,
                        fontWeight: 500,
                        color: brand.mutedText ?? hexToRgba(brand.text, 0.74),
                        lineHeight: 1.42,
                      })}
                    >
                      {step.subtitle}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeStage>
  );
};

function formatSceneForBidi(scene: SceneItem, dir: BrandConfig['dir']): SceneItem {
  if (!scene || dir !== 'rtl') {
    return scene;
  }

  const f = (value?: string): string =>
    typeof value === 'string' ? formatBidiText(value, dir) : '';
  const fo = (value?: string): string | undefined =>
    typeof value === 'string' ? formatBidiText(value, dir) : undefined;
  const fl = (values?: string[]): string[] =>
    Array.isArray(values)
      ? values
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => formatBidiText(entry, dir))
      : [];

  switch (scene.type) {
    case 'hook':
      return {
        ...scene,
        badge: fo(scene?.badge),
        headline: f(scene?.headline),
        subtext: fo(scene?.subtext),
      };
    case 'stat':
      return {
        ...scene,
        prefix: fo(scene?.prefix),
        suffix: fo(scene?.suffix),
        label: f(scene?.label),
        sublabel: fo(scene?.sublabel),
      };
    case 'broll_text':
      return {
        ...scene,
        tag: fo(scene?.tag),
        headline: f(scene?.headline),
        subtext: fo(scene?.subtext),
      };
    case 'image_text':
      return {
        ...scene,
        tag: fo(scene?.tag),
        headline: f(scene?.headline),
        subtext: fo(scene?.subtext),
      };
    case 'comparison': {
      const { before, after } = normalizeComparisonSides(scene);
      return {
        ...scene,
        eyebrow: fo(scene?.eyebrow),
        headline: fo(scene?.headline),
        before: {
          label: f(before?.label),
          title: f(before?.title),
          points: fl(before?.points),
        },
        after: {
          label: f(after?.label),
          title: f(after?.title),
          points: fl(after?.points),
        },
      };
    }
    case 'ui_card':
      return {
        ...scene,
        appName: fo(scene?.appName),
        title: fo(scene?.title),
        badge: fo(scene?.badge),
        timestamp: fo(scene?.timestamp),
        headerTitle: fo(scene?.headerTitle),
        items: Array.isArray(scene?.items)
          ? scene.items.map((item) =>
              typeof item === 'string'
                ? f(item)
                : {
                    title: f(item?.title),
                    detail: fo(item?.detail),
                    status: fo(item?.status),
                  }
            )
          : [],
      };
    case 'whatsapp_chat':
      return {
        ...scene,
        contactName: fo(scene?.contactName),
        messages: Array.isArray(scene?.messages)
          ? scene.messages.map((msg) => ({
              sender: msg?.sender === 'bot' ? 'bot' : 'client',
              text: f(msg?.text),
              time: msg?.time,
            }))
          : [],
      };
    case 'bar_chart':
      return {
        ...scene,
        title: fo(scene?.title),
        bars: Array.isArray(scene?.bars)
          ? scene.bars.map((bar) => ({
              ...bar,
              label: f(bar?.label),
            }))
          : [],
      };
    case 'timeline_steps':
      return {
        ...scene,
        title: fo(scene?.title),
        steps: Array.isArray(scene?.steps)
          ? scene.steps.map((step) => ({
              ...step,
              number: step?.number ?? '',
              title: f(step?.title),
              subtitle: fo(step?.subtitle),
            }))
          : [],
      };
    case 'cta':
      return {
        ...scene,
        eyebrow: fo(scene?.eyebrow),
        headline: f(scene?.headline),
        subtext: fo(scene?.subtext),
        ctaText: f(scene?.ctaText),
        footerText: fo(scene?.footerText),
      };
    default: {
      const exhaustiveCheck: never = scene;
      return exhaustiveCheck;
    }
  }
}

export const SceneRouter: React.FC<SceneRouterProps> = ({
  scene: rawScene,
  brandSlug,
  brand,
  styleRules,
  resolvedAssets,
  durationInFrames,
}) => {
  const scene = formatSceneForBidi(rawScene, brand.dir);

  switch (scene.type) {
    case 'hook':
      return <HookSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'stat':
      return (
        <StatSceneView
          scene={scene}
          brand={brand}
          styleRules={styleRules}
          durationInFrames={durationInFrames}
        />
      );
    case 'broll_text':
      return (
        <BrollTextSceneView
          scene={scene}
          brandSlug={brandSlug}
          brand={brand}
          styleRules={styleRules}
          resolvedAssets={resolvedAssets}
          durationInFrames={durationInFrames}
        />
      );
    case 'image_text':
      return (
        <ImageTextSceneView
          scene={scene}
          brandSlug={brandSlug}
          brand={brand}
          styleRules={styleRules}
          resolvedAssets={resolvedAssets}
          durationInFrames={durationInFrames}
        />
      );
    case 'comparison':
      return <ComparisonSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'ui_card':
      return <UiCardSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'whatsapp_chat':
      return <WhatsappChatSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'bar_chart':
      return <BarChartSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'timeline_steps':
      return <TimelineStepsSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'cta':
      return (
        <CtaSceneView
          scene={scene}
          brandSlug={brandSlug}
          brand={brand}
          styleRules={styleRules}
          resolvedAssets={resolvedAssets}
        />
      );
    default: {
      const exhaustiveCheck: never = scene;
      return exhaustiveCheck;
    }
  }
};
