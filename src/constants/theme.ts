import { Platform } from 'react-native';

// Monochrome system modeled on Aside's brand: black surfaces, white ink, gray support.
export const C = {
  bg: '#000000',
  surface: '#111113',
  surfaceRaised: '#1A1A1D',
  surfacePressed: '#232326',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  ink: '#F7F8F8',
  inkSecondary: '#9BA0A8',
  inkFaint: '#62666D',
  inverseBg: '#FFFFFF',
  inverseInk: '#0A0A0A',
  running: '#4ADE80',
  error: '#F87171',
  overlay: 'rgba(0,0,0,0.6)',
} as const;

export const F = {
  regular: 'Geist',
  medium: 'Geist-Medium',
  semibold: 'Geist-SemiBold',
  bold: 'Geist-Bold',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) as string,
} as const;

export const S = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  radius: 20,
  radiusSm: 12,
} as const;

const MODEL_NAMES: Record<string, string> = {
  'claude-haiku-4-5': 'Haiku 4.5',
  'claude-sonnet-5': 'Sonnet 5',
  'claude-opus-5': 'Opus 5',
  'claude-fable-5': 'Fable 5',
  'claude-opus-4-6': 'Opus 4.6',
};

export function prettyModel(id?: string): string {
  if (!id) return 'Default model';
  if (MODEL_NAMES[id]) return MODEL_NAMES[id];
  return id
    .replace(/^claude-/, '')
    .split('-')
    .map((w) => (/^\d/.test(w) ? w.replace(/-/g, '.') : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
