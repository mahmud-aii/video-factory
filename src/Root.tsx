import React from 'react';
import { getAudioDurationInSeconds } from '@remotion/media-utils';
import { Composition, type CalculateMetadataFunction } from 'remotion';
import defaultBatchRaw from '../clients/tekviyo/batch.json';
import defaultBrandRaw from '../clients/tekviyo/brand.json';
import defaultStyleRulesRaw from '../clients/tekviyo/style-rules.json';
import { FactoryVideo } from './FactoryVideo';
import { clientAsset } from './lib/assets';
import type { BatchConfig, BrandConfig, FactoryVideoProps, StyleRules } from './types';

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1920;
const DEFAULT_FPS = 60;
const DEFAULT_BREATHING_ROOM_SECONDS = 0.5;
const DEFAULT_FALLBACK_SECONDS = 4;

const defaultBrand = defaultBrandRaw as BrandConfig;
const defaultStyleRules = defaultStyleRulesRaw as StyleRules;
const defaultBatch = defaultBatchRaw as BatchConfig;
const defaultJob = defaultBatch.videos[0];

const defaultProps: FactoryVideoProps = {
  brandSlug: 'tekviyo',
  brand: defaultBrand,
  styleRules: defaultStyleRules,
  job: defaultJob,
  resolvedAssets: {
    hasLogo: false,
    hasVoice: false,
    hasBgm: false,
    hasTransitionSfx: false,
    validVideos: [],
    validImages: [],
  },
  captionWords: [],
};

const calculateMetadata: CalculateMetadataFunction<FactoryVideoProps> = async ({ props }) => {
  const fps = DEFAULT_FPS;
  const fallbackSeconds =
    typeof props.job.audio?.fallbackSeconds === 'number' && props.job.audio.fallbackSeconds > 0
      ? props.job.audio.fallbackSeconds
      : DEFAULT_FALLBACK_SECONDS;

  const breathingRoom =
    typeof props.styleRules?.pacing?.breathingRoomSeconds === 'number' &&
    props.styleRules.pacing.breathingRoomSeconds >= 0
      ? props.styleRules.pacing.breathingRoomSeconds
      : DEFAULT_BREATHING_ROOM_SECONDS;

  let totalSeconds = fallbackSeconds;

  if (props.resolvedAssets?.hasVoice && props.job.audio?.voicePath) {
    try {
      const voiceUrl = clientAsset(props.brandSlug, props.job.audio.voicePath);
      const measuredSeconds = await getAudioDurationInSeconds(voiceUrl);
      if (Number.isFinite(measuredSeconds) && measuredSeconds > 0) {
        totalSeconds = measuredSeconds + breathingRoom;
      }
    } catch {
      totalSeconds = fallbackSeconds;
    }
  }

  return {
    durationInFrames: Math.max(1, Math.round(totalSeconds * fps)),
    fps,
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FactoryReel"
      component={FactoryVideo}
      width={DEFAULT_WIDTH}
      height={DEFAULT_HEIGHT}
      fps={DEFAULT_FPS}
      durationInFrames={DEFAULT_FALLBACK_SECONDS * DEFAULT_FPS}
      defaultProps={defaultProps}
      calculateMetadata={calculateMetadata}
    />
  );
};
