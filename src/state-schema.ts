import exp from 'constants';
import { z } from 'zod';

import { EGVideo } from './eg-video-playback';
import { DefaultTransitionDuration } from './constants';

export type StateContext = {
  time: number;
  nowTime: number;
  relativeTime: number;
  video: EGVideo;
  recentGradientValues: Record<string, number>;
  bounceTimes: Record<string, number>;
  mainState: MainState;
};

// export const effectsSchema = {
//   flash: z.nullable(z.number()),
//   waveIn: z.nullable(z.number()),
//   waveOut: z.nullable(z.number()),
// } as const

// export const effectTypes = Object.keys(effectsSchema) as (keyof typeof effectsSchema)[]

const colorSchema = z.object({
  h: z.number(),
  s: z.number(),
  l: z.number(),
});

const desaturateEffectSchema = z.object({
  key: z.string(),
  type: z.literal('desaturate'),
  value: z.number(),
});
export type DesaturateEffect = z.infer<typeof desaturateEffectSchema>;

const colorizeEffectSchema = z.object({
  key: z.string(),
  type: z.literal('colorize'),
  amount: z.number(),
  saturation: z.number(),
  hue: z.number(),
});
export type ColorizeEffect = z.infer<typeof colorizeEffectSchema>;

const brightenEffectSchema = z.object({
  key: z.string(),
  type: z.literal('brighten'),
  value: z.number(),
});
export type BrightenEffect = z.infer<typeof brightenEffectSchema>;

const darkenEffectSchema = z.object({
  key: z.string(),
  type: z.literal('darken'),
  value: z.number(),
});
export type DarkenEffect = z.infer<typeof darkenEffectSchema>;

const hueShiftEffectSchema = z.object({
  key: z.string(),
  type: z.literal('hueShift'),
  value: z.number(), // range from -180 to 180
});
export type HueShiftEffect = z.infer<typeof hueShiftEffectSchema>;

const rotateEffectSchema = z.object({
  key: z.string(),
  type: z.literal('rotate'),
  value: z.number(), // range from 0-1
});
export type RotateEffect = z.infer<typeof rotateEffectSchema>;

const prismEffectSchema = z.object({
  key: z.string(),
  type: z.literal('prism'),
  mirror: z.boolean(),
  slices: z.number(),
  offset: z.number(), // range from 0-1
});
export type PrismEffect = z.infer<typeof prismEffectSchema>;

const contrastEffectSchema = z.object({
  key: z.string(),
  type: z.literal('contrast'),
  value: z.number(), // range from 0-1
});
export type ContrastEffect = z.infer<typeof contrastEffectSchema>;

const invertEffectSchema = z.object({
  key: z.string(),
  type: z.literal('invert'),
});
export type InvertEffect = z.infer<typeof invertEffectSchema>;

const effectSchema = z.discriminatedUnion('type', [
  desaturateEffectSchema,
  colorizeEffectSchema,
  invertEffectSchema,
  hueShiftEffectSchema,
  brightenEffectSchema,
  darkenEffectSchema,
  rotateEffectSchema,
  contrastEffectSchema,
  prismEffectSchema,
]);
export type Effect = z.infer<typeof effectSchema>;

const effectsSchema = z.array(effectSchema);
export type Effects = z.infer<typeof effectsSchema>;

const videoParamsSchema = z.object({
  loopBounce: z.boolean().optional(),
  reverse: z.boolean().optional(),
});
export type VideoParams = z.infer<typeof videoParamsSchema>;

const videoSceneSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  effects: effectsSchema.optional(),
  type: z.literal('video'),
  track: z.string().nullable(),
  pauseOnFrame: z.number().nullable().optional(),
  params: videoParamsSchema.optional(),
});
export type VideoScene = z.infer<typeof videoSceneSchema>;

const colorSceneSchema = z.object({
  type: z.literal('color'),
  label: z.string().optional(),
  h: z.number(),
  s: z.number(),
  l: z.number(),
});
export type ColorScene = z.infer<typeof colorSceneSchema>;

const offSceneSchema = z.object({
  type: z.literal('off'),
  label: z.string().optional(),
});
export type OffScene = z.infer<typeof offSceneSchema>;

export type Layer = {
  key: string;
  scene: Scene;
  blendMode: 'add' | 'mix' | 'mask';
  blendAmount: number;
};

const layerSchema: z.ZodType<Layer> = z.object({
  key: z.string(),
  label: z.string().optional(),
  scene: z.lazy(() => sceneSchema),
  blendMode: z.enum(['add', 'mix', 'mask']),
  blendAmount: z.number(),
});

export type LayersScene = {
  type: 'layers';
  label?: string;
  layers: Layer[];
  effects?: Effects;
};
const layersSceneSchema: z.ZodType<LayersScene> = z.object({
  type: z.literal('layers'),
  label: z.string().optional(),
  layers: z.array(layerSchema),
  effects: effectsSchema.optional(),
});

const sequenceItemSchema = z.object({
  key: z.string(),
  maxDuration: z.number().nullable().optional(),
  goNextOnEnd: z.boolean().optional(),
  goNextAfterLoops: z.number().optional(),
  scene: z.lazy(() => sceneSchema),
});
export type SequenceItem = {
  key: string;
  maxDuration?: null | number;
  goNextOnEnd?: boolean;
  goNextAfterLoops?: number;
  scene: Scene;
};

const fadeTransitionSchema = z.object({
  type: z.literal('fade'),
  mode: z.enum(['add', 'mix']),
  duration: z.number(),
});
export type FadeTransition = z.infer<typeof fadeTransitionSchema>;

const maskTransitionSchema = z.object({
  type: z.literal('mask'),
  mode: z.enum(['add', 'mix']),
  duration: z.number(),
});
export type MaskTransition = z.infer<typeof maskTransitionSchema>;

// todo: mask transitions
// const transitionSchema = z.discriminatedUnion('type', [fadeTransitionSchema, maskTransitionSchema]);
const transitionSchema = fadeTransitionSchema;
export type Transition = z.infer<typeof transitionSchema>;

export const DefaultTransition: Transition = {
  type: 'fade',
  mode: 'mix',
  duration: DefaultTransitionDuration,
};

export type SequenceScene = {
  type: 'sequence';
  label?: string;
  activeKey?: string | undefined;
  nextActiveKey?: string | undefined;
  transitionStartTime?: number | undefined;
  transitionEndTime?: number | undefined;
  transition?: Transition;
  sequence: SequenceItem[];
  effects?: Effects;
};
const sequenceSceneSchema: z.ZodType<SequenceScene> = z.object({
  type: z.literal('sequence'),
  label: z.string().optional(),
  activeKey: z.string().optional(),
  nextActiveKey: z.string().optional(),
  transitionStartTime: z.number().optional(),
  transitionEndTime: z.number().optional(),
  transition: transitionSchema.optional(),
  sequence: z.array(sequenceItemSchema),
  effects: effectsSchema.optional(),
});

export type Scene = OffScene | ColorScene | VideoScene | LayersScene | SequenceScene;

export const sceneSchema: z.ZodType<Scene> = z.discriminatedUnion('type', [
  offSceneSchema,
  colorSceneSchema,
  videoSceneSchema,
  layersSceneSchema,
  sequenceSceneSchema,
]);

const transitionStateSchema = z.object({
  manual: z.number().nullable(),
  autoStartTime: z.number().nullable(),
});
export type TransitionState = z.infer<typeof transitionStateSchema>;

export const sliderFieldSchema = z.object({
  smoothing: z.number().optional(),
  bounceAmount: z.number().optional(),
  bounceDuration: z.number().optional(),
});
export type SliderField = z.infer<typeof sliderFieldSchema>;

export const dashboardItemSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  field: z.string(),
  behavior: z.enum(['slider', 'bounce', 'goNext']),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
});
export type DashboardItem = z.infer<typeof dashboardItemSchema>;

export const dashboardSchema = z.array(dashboardItemSchema);
export type Dashboard = z.infer<typeof dashboardSchema>;

export const sliderFieldsSchema = z.record(sliderFieldSchema);
export type SliderFields = z.infer<typeof sliderFieldsSchema>;

export const MainStateSchema = z.object({
  liveScene: sceneSchema,
  readyScene: sceneSchema,
  transition: transitionSchema,
  transitionState: transitionStateSchema,
  liveDashboard: dashboardSchema,
  readyDashboard: dashboardSchema,
  liveSliderFields: sliderFieldsSchema,
  readySliderFields: sliderFieldsSchema,
  effects: effectsSchema.optional(),
});

export type MainState = z.infer<typeof MainStateSchema>;

export const defaultMainState: MainState = {
  liveScene: {
    type: 'off',
  },
  readyScene: {
    type: 'off',
  },
  liveDashboard: [],
  readyDashboard: [],
  transition: {
    type: 'fade',
    mode: 'mix',
    duration: 1000,
  },
  transitionState: {
    manual: null,
    autoStartTime: null,
  },
  liveSliderFields: {},
  readySliderFields: {},
};
