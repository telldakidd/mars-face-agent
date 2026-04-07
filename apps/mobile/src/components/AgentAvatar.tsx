import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

type AgentAvatarProps = {
  size?: number;
  status?: 'online' | 'thinking' | 'offline';
};

export default function AgentAvatar({ size = 48, status = 'online' }: AgentAvatarProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (status === 'thinking') {
      pulseScale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1, { duration: 200 });
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [status, pulseScale, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const borderRadius = size / 2;

  return (
    <View style={[styles.wrapper, { width: size + 6, height: size + 6 }]}>
      {/* Pulse ring (visible when thinking) */}
      <Animated.View
        style={[
          styles.pulseRing,
          {
            width: size + 6,
            height: size + 6,
            borderRadius: (size + 6) / 2,
          },
          pulseStyle,
        ]}
      />

      {/* Gradient border (simulated with layered views) */}
      <View
        style={[
          styles.outerRing,
          {
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
          },
        ]}
      >
        <View
          style={[
            styles.innerCircle,
            {
              width: size,
              height: size,
              borderRadius,
            },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>M</Text>
        </View>
      </View>

      {/* Status indicator */}
      <View
        style={[
          styles.statusDot,
          {
            backgroundColor:
              status === 'online'
                ? '#2ea043'
                : status === 'thinking'
                  ? '#d29922'
                  : '#f85149',
            bottom: 0,
            right: 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#00e5ff',
  },
  outerRing: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00e5ff',
    // Simulating gradient border with a solid cyan-to-purple midpoint
    shadowColor: '#b388ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  innerCircle: {
    backgroundColor: '#0d1117',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#00e5ff',
    fontWeight: '800',
  },
  statusDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#05060a',
  },
});
