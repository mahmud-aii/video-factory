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

export type StylePacingConfig = {
  style?: 'snappy' | 'balanced' | 'editorial' | string;
  defaultFps?: number;
  minSceneSeconds?: number;
  breathingRoomSeconds?: number;
};

export type StyleSafeZonesConfig = {
  top?: number;
  bottom?: number;
  horizontal?: number;
  topPx?: number;
  bottomPx?: number;
  horizontalPx?: number;
};

export type StyleRules = {
  pacing?: string | StylePacingConfig;
  maxWordsPerHeadline?: number;
  safeZones?: StyleSafeZonesConfig;
  transitionStyle?: 'spring-cut' | 'slide-up' | 'fade-scale';
  rtlRules?: {
    letterSpacing?: string;
    noIconRotation?: boolean;
  };
  captionStyle?: {
    wordsPerChunk?: number;
    bottomOffset?: number;
    fontSize?: number;
    highlightActiveWord?: boolean;
    rtlLetterSpacing?: '0px';
  };
  accentMaxUsagePercent?: number;
  visualNotes?: string[];
  visualCompliance?: string;
  brandSpecificNotes?: string;
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
  transitionSfxPath?: string;
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
  badge?: string;
  headline: string;
  subtext?: string;
};

export type StatScene = BaseScene & {
  type: 'stat';
  value?: number;
  number?: number;
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

export type ImageTextScene = BaseScene & {
  type: 'image_text';
  imagePath?: string;
  zoom?: 'in' | 'out';
  tag?: string;
  headline: string;
  subtext?: string;
  overlayOpacity?: number;
};

export type ComparisonSide = {
  label?: string;
  title?: string;
  points?: string[];
  items?: string[];
};

export type ComparisonScene = BaseScene & {
  type: 'comparison';
  eyebrow?: string;
  headline?: string;
  before?: ComparisonSide;
  after?: ComparisonSide;
  left?: ComparisonSide;
  right?: ComparisonSide;
  leftLabel?: string;
  leftTitle?: string;
  leftPoints?: string[];
  leftItems?: string[];
  rightLabel?: string;
  rightTitle?: string;
  rightPoints?: string[];
  rightItems?: string[];
};

export type UiCardItem = {
  title: string;
  detail?: string;
  status?: string;
};

export type UiCardScene = BaseScene & {
  type: 'ui_card';
  variant?: 'saas' | 'whatsapp';
  appName?: string;
  title?: string;
  badge?: string;
  timestamp?: string;
  headerTitle?: string;
  items?: Array<string | UiCardItem>;
};

export type WhatsappChatMessage = {
  sender: 'client' | 'bot';
  text: string;
  time?: string;
};

export type WhatsappChatScene = BaseScene & {
  type: 'whatsapp_chat';
  contactName?: string;
  messages?: WhatsappChatMessage[];
};

export type BarChartDatum = {
  label: string;
  value: number;
  displayValue?: string;
  highlight?: boolean;
};

export type BarChartScene = BaseScene & {
  type: 'bar_chart';
  title?: string;
  bars?: BarChartDatum[];
};

export type TimelineStepItem = {
  number: string;
  title: string;
  subtitle?: string;
};

export type TimelineStepsScene = BaseScene & {
  type: 'timeline_steps';
  title?: string;
  steps?: TimelineStepItem[];
};

export type CtaScene = BaseScene & {
  type: 'cta';
  eyebrow?: string;
  headline: string;
  subtext?: string;
  ctaText: string;
  footerText?: string;
};

export type SceneItem =
  | HookScene
  | StatScene
  | BrollTextScene
  | ImageTextScene
  | ComparisonScene
  | UiCardScene
  | WhatsappChatScene
  | BarChartScene
  | TimelineStepsScene
  | CtaScene;

export type SceneConfig = SceneItem;

export type VideoJob = {
  id: string;
  enabled?: boolean;
  title?: string;
  caption?: string;
  brandOverride?: Partial<BrandConfig>;
  audio: AudioConfig;
  captions?: CaptionsConfig;
  scenes: SceneItem[];
};

export type BatchSettings = {
  fps?: number;
  width?: number;
  height?: number;
  skipExisting?: boolean;
  concurrency?: number;
  defaultLanguage?: string;
};

export type BatchConfig = {
  settings: BatchSettings;
  videos: VideoJob[];
};

export type ResolvedAssets = {
  hasLogo: boolean;
  hasVoice: boolean;
  hasBgm: boolean;
  hasTransitionSfx: boolean;
  validVideos: string[];
  validImages: string[];
};

export type AssetAvailability = ResolvedAssets;

export type FactoryVideoProps = {
  brandSlug: string;
  brand: BrandConfig;
  styleRules?: StyleRules;
  job: VideoJob;
  resolvedAssets: ResolvedAssets;
  captionWords: CaptionWord[];
};
