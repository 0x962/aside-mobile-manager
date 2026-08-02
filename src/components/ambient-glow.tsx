import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

// A faint glow in the top-left corner that drifts through colors. Purely
// decorative: it ignores touches and sits over every screen. Three layers
// fade in and out on a shared cycle, phase-shifted, so the corner slowly
// blends from one tint into the next.
const LAYERS = [
  'rgba(168,85,247,0.26)', // violet
  'rgba(45,212,191,0.20)', // teal
  'rgba(244,114,182,0.20)', // pink
];
const CYCLE = 24000;

export function AmbientGlow() {
  const phases = useRef(LAYERS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = phases.map((v, i) =>
      Animated.sequence([
        Animated.delay((CYCLE / LAYERS.length) * i),
        Animated.loop(
          Animated.sequence([
            Animated.timing(v, { toValue: 1, duration: CYCLE / 2, useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: CYCLE / 2, useNativeDriver: true }),
          ]),
        ),
      ]),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [phases]);

  return (
    <>
      {LAYERS.map((color, i) => (
        <Animated.View
          key={color}
          pointerEvents="none"
          style={[
            styles.layer,
            {
              opacity: phases[i].interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
              transform: [
                { translateX: phases[i].interpolate({ inputRange: [0, 1], outputRange: [-24, 8] }) },
                { translateY: phases[i].interpolate({ inputRange: [0, 1], outputRange: [-16, 6] }) },
              ],
            },
          ]}>
          <LinearGradient
            colors={[color, 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.85, y: 0.85 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: -40, left: -40, width: 300, height: 300 },
});
