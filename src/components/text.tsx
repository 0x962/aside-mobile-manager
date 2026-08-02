import { Text, type TextProps, type TextStyle } from 'react-native';
import { C, F } from '@/constants/theme';

type Variant = 'body' | 'title' | 'heading' | 'label' | 'secondary' | 'faint' | 'mono';

const variants: Record<Variant, TextStyle> = {
  body: { fontFamily: F.regular, fontSize: 16, lineHeight: 23, color: C.ink },
  title: { fontFamily: F.semibold, fontSize: 28, lineHeight: 34, color: C.ink, letterSpacing: -0.5 },
  heading: { fontFamily: F.semibold, fontSize: 17, lineHeight: 22, color: C.ink, letterSpacing: -0.2 },
  label: { fontFamily: F.medium, fontSize: 13, lineHeight: 18, color: C.inkSecondary },
  secondary: { fontFamily: F.regular, fontSize: 14, lineHeight: 20, color: C.inkSecondary },
  faint: { fontFamily: F.regular, fontSize: 13, lineHeight: 18, color: C.inkFaint },
  mono: { fontFamily: F.mono, fontSize: 12.5, lineHeight: 18, color: C.inkSecondary },
};

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[variants[variant], style]} />;
}
