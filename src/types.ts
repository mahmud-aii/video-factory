export type TextDirection = 'rtl' | 'ltr';

export type BrandConfig = {
  name: string;
  dir: TextDirection;
  fontFamily: string;
  bg: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  logoPath: string;
  mutedText?: string;
  handle?: string;
};

export type StyleRules = {
  pacing: {
    style: 'snappy' | 'balanced' | 'editorial';
    defaultFps: number;
    minSceneSeconds: number;
    breathingRoomSeconds: number;
  };
  safeZones: {
    top: number;
    bottom: number;
    horizontal: number;
  };
  transitionStyle: 'spring-cut' | 'slide-up' | 'fade-scale';
  captionStyle: {
    wordsPerChunk: number;
    bottomOffset: number;
    fontSize: number;
    highlightActiveWord: boolean;
    rtlLetterSpacing: '0px';
  };
  visualNotes: string[];
};

export type CaptionWord = {
  word: string;
  start: number;
  end: number;
};

export type AudioConfig = {
  voicePath?: string;
  bgmPath?: string;
  bgmVolume?: number;
  fallbackSeconds: number;
};

export type CaptionsConfig = {
  enabled: boolean;
  language?: string;
  wordsPerChunk?: number;
};

export type BaseScene = {
  id?: string;
  weight: number;
};

export type HookScene = BaseScene & {
  type: 'hook';
  badge: string;
  headline: string;
  subtext?: string;
};

export type StatScene = BaseScene & {
  type: 'stat';
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  label: string;
  sublabel?: string;
};

export type BrollTextScene = BaseScene & {
  type: 'broll_text';
  videoPath?: string;
  tag?: string;
  headline: string;
  subtext?: string;
  overlayOpacity?: number;
};

export type ComparisonSide = {
  label: string;
  title: string;
  points: string[];
};

export type ComparisonScene = BaseScene & {
  type: 'comparison';
  eyebrow?: string;
  headline?: string;
  before: ComparisonSide;
  after: ComparisonSide;
};

export type UiCardItem = {
  title: string;
  detail?: string;
  status?: string;
};

export type UiCardScene = BaseScene & {
  type: 'ui_card';
  variant?: 'saas' | 'whatsapp';
  appName: string;
  timestamp?: string;
  headerTitle: string;
  items: Array<string | UiCardItem>;
};

export type CtaScene = BaseScene & {
  type: 'cta';
  eyebrow?: string;
  headline: string;
  subtext?: string;
  ctaText: string;
  footerText?: string;
};

export type SceneConfig =
  | HookScene
  | StatScene
  | BrollTextScene
  | ComparisonScene
  | UiCardScene
  | CtaScene;

export type VideoJob = {
  id: string;
  enabled?: boolean;
  title?: string;
  caption?: string;
  audio: AudioConfig;
  captions?: CaptionsConfig;
  scenes: SceneConfig[];
};

export type BatchSettings = {
  fps?: number;
  width?: number;
  height?: number;
  skipExisting?: boolean;
  defaultLanguage?: string;
};

export type BatchConfig = {
  settings: BatchSettings;
  videos: VideoJob[];
};

export type AssetAvailability = {
  hasLogo: boolean;
  hasVoice: boolean;
  hasBgm: boolean;
  validVideos: string[];
};

export type FactoryVideoProps = {
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  job: VideoJob;
  assets: AssetAvailability;
  captionWords: CaptionWord[];
};
