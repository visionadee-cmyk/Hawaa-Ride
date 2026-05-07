import React, { useMemo, useRef } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

type Props = {
  label: string;
  onComplete: () => void | Promise<void>;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function SwipeButton({ label, onComplete, disabled = false, height = 56, style }: Props) {
  const trackWidth = useRef(0);
  const knobX = useRef(new Animated.Value(0)).current;
  const completing = useRef(false);

  const knobSize = height - 10;
  const padding = 5;

  const maxX = () => Math.max(0, trackWidth.current - knobSize - padding * 2);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => !disabled && !completing.current,
        onPanResponderMove: (_, g) => {
          if (disabled || completing.current) return;
          const next = Math.min(Math.max(0, g.dx), maxX());
          knobX.setValue(next);
        },
        onPanResponderRelease: async (_, g) => {
          if (disabled || completing.current) return;

          const next = Math.min(Math.max(0, g.dx), maxX());
          const threshold = maxX() * 0.8;

          if (next >= threshold) {
            completing.current = true;
            Animated.timing(knobX, {
              toValue: maxX(),
              duration: 120,
              useNativeDriver: false,
            }).start(async () => {
              try {
                await onComplete();
              } finally {
                completing.current = false;
                Animated.timing(knobX, {
                  toValue: 0,
                  duration: 160,
                  useNativeDriver: false,
                }).start();
              }
            });
          } else {
            Animated.timing(knobX, {
              toValue: 0,
              duration: 160,
              useNativeDriver: false,
            }).start();
          }
        },
      }),
    [disabled, knobSize, knobX, onComplete]
  );

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View onLayout={onLayout} style={[styles.track, { height }, disabled ? styles.trackDisabled : null, style]}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            width: knobSize,
            height: knobSize,
            borderRadius: knobSize / 2,
            transform: [{ translateX: knobX }],
          },
          disabled ? styles.knobDisabled : null,
        ]}
      >
        <Text style={styles.knobText}>{'>>'}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: '#0B9E3D',
    borderRadius: 18,
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 5,
  },
  trackDisabled: {
    opacity: 0.6,
  },
  label: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 56,
  },
  knob: {
    position: 'absolute',
    left: 5,
    top: 5,
    backgroundColor: '#0A7B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  knobDisabled: {
    backgroundColor: '#2f6b45',
  },
  knobText: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 14,
  },
});
