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
import { getSafeZones, rtlSafeTextStyle } from '../lib/rtl';
import type {
  AssetAvailability,
  BrandConfig,
  BrollTextScene,
  ComparisonScene,
  CtaScene,
  HookScene,
  SceneConfig,
  StatScene,
  StyleRules,
  UiCardItem,
  UiCardScene,
} from '../types';

export type SceneRouterProps = {
  scene: SceneConfig;
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  assets: AssetAvailability;
  durationInFrames: number;
};

function getSpringConfig(styleRules?: StyleRules) {
  const pacing = styleRules?.pacing?.style ?? 'snappy';
  if (pacing === 'editorial') {
    return { damping: 22, stiffness: 130, mass: 0.85 };
  }
  if (pacing === 'balanced') {
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

  const isRtl = brand.dir === 'rtl';

  return (
    <SafeStage brand={brand} styleRules={styleRules}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isRtl ? 'flex-start' : 'flex-start',
          gap: 36,
        }}
      >
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
          {scene.headline}
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

  const decimals = scene.decimals ?? (Number.isInteger(scene.value) ? 0 : 1);
  const animatedValue = scene.value * progress;
  const formattedNumber =
    decimals > 0
      ? animatedValue.toFixed(decimals)
      : Math.round(animatedValue).toLocaleString('en-US');

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
            direction: 'ltr',
            display: 'inline-flex',
            alignItems: 'baseline',
            justifyContent: 'center',
            gap: 8,
            fontFamily: MONO_FONT_FAMILY,
            fontVariantNumeric: 'tabular-nums',
            fontSize: 168,
            fontWeight: 800,
            lineHeight: 1.05,
            color: brand.primary,
            letterSpacing: '-0.02em',
            textShadow: `0 10px 42px ${hexToRgba(brand.primary, 0.32)}`,
            zIndex: 1,
          }}
        >
          {scene.prefix ? (
            <span style={{ fontSize: 108, color: brand.accent }}>{scene.prefix}</span>
          ) : null}
          <span>{formattedNumber}</span>
          {scene.suffix ? (
            <span style={{ fontSize: 108, color: brand.accent }}>{scene.suffix}</span>
          ) : null}
        </div>

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
  assets: AssetAvailability;
  durationInFrames: number;
}> = ({ scene, brandSlug, brand, styleRules, assets, durationInFrames }) => {
  const frame = useCurrentFrame();
  const tagMotion = useEntrance(0, styleRules);
  const textMotion = useEntrance(6, styleRules);
  const subMotion = useEntrance(12, styleRules);

  const normalizedVideoPath = scene.videoPath ? normalizeAssetPath(scene.videoPath) : '';
  const hasValidVideo = Boolean(
    normalizedVideoPath && assets.validVideos.includes(normalizedVideoPath)
  );

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
            {scene.headline}
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

const ComparisonSceneView: React.FC<{
  scene: ComparisonScene;
  brand: BrandConfig;
  styleRules?: StyleRules;
}> = ({ scene, brand, styleRules }) => {
  const headerMotion = useEntrance(0, styleRules);
  const beforeMotion = useEntrance(5, styleRules);
  const afterMotion = useEntrance(13, styleRules);

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

        {/* BEFORE card */}
        <div
          style={{
            opacity: beforeMotion.opacity,
            transform: beforeMotion.transform,
            backgroundColor: hexToRgba(brand.surface, 0.82),
            border: `1.5px solid ${hexToRgba('#EF4444', 0.45)}`,
            borderRadius: 32,
            padding: '38px 42px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              {scene.before.label}
            </span>
            <span style={{ fontSize: 30, color: '#F87171', fontWeight: 800 }}>✕</span>
          </div>

          <div
            style={rtlSafeTextStyle(brand, {
              fontSize: 44,
              fontWeight: 800,
              color: hexToRgba(brand.text, 0.9),
              lineHeight: 1.25,
            })}
          >
            {scene.before.title}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scene.before.points.map((point, idx) => (
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
                    color: brand.mutedText ?? hexToRgba(brand.text, 0.72),
                    lineHeight: 1.38,
                  })}
                >
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* AFTER card */}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
              {scene.after.label}
            </span>
            <span style={{ fontSize: 34, color: brand.primary, fontWeight: 900 }}>✓</span>
          </div>

          <div
            style={rtlSafeTextStyle(brand, {
              fontSize: 46,
              fontWeight: 900,
              color: brand.text,
              lineHeight: 1.25,
            })}
          >
            {scene.after.title}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {scene.after.points.map((point, idx) => (
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
  return item;
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

  const items = scene.items.map(normalizeUiCardItem);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 32,
                  fontWeight: 800,
                  color: brand.text,
                  lineHeight: 1.2,
                })}
              >
                {scene.appName}
              </span>
              <span
                style={rtlSafeTextStyle(brand, {
                  fontSize: 25,
                  fontWeight: 600,
                  color: brand.accent,
                  lineHeight: 1.2,
                })}
              >
                {scene.headerTitle}
              </span>
            </div>
          </div>

          {scene.timestamp ? (
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
              {scene.timestamp}
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
  assets: AssetAvailability;
}> = ({ scene, brandSlug, brand, styleRules, assets }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logoMotion = useEntrance(0, styleRules);
  const headlineMotion = useEntrance(5, styleRules);
  const pillMotion = useEntrance(12, styleRules);

  const pulse = 1 + Math.sin((frame / fps) * Math.PI * 2.2) * 0.025;
  const showLogo = assets.hasLogo && Boolean(brand.logoPath);

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
          {scene.headline}
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
              fontSize: 42,
              fontWeight: 900,
              color: getContrastInk(brand.primary),
              lineHeight: 1.2,
            })}
          >
            {scene.ctaText}
          </span>
        </div>

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

export const SceneRouter: React.FC<SceneRouterProps> = ({
  scene,
  brandSlug,
  brand,
  styleRules,
  assets,
  durationInFrames,
}) => {
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
          assets={assets}
          durationInFrames={durationInFrames}
        />
      );
    case 'comparison':
      return <ComparisonSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'ui_card':
      return <UiCardSceneView scene={scene} brand={brand} styleRules={styleRules} />;
    case 'cta':
      return (
        <CtaSceneView
          scene={scene}
          brandSlug={brandSlug}
          brand={brand}
          styleRules={styleRules}
          assets={assets}
        />
      );
    default: {
      const exhaustiveCheck: never = scene;
      return exhaustiveCheck;
    }
  }
};
