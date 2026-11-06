import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, Animated, PanResponder, Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../context/ThemeContext';

interface SwipeButtonProps {
  text: string;
  onSwipeSuccess: () => void;
  color: string;
  containerStyle?: any;
  disabled?: boolean;
  direction?: 'right' | 'left';
}

const getAlphaColor = (hexColor: string, alpha: number) => {
  if (hexColor && hexColor.startsWith('#')) {
    let hex = hexColor.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return hexColor;
};

export default function SwipeButton({
  text,
  onSwipeSuccess,
  color,
  containerStyle,
  disabled = false,
  direction = 'right',
}: SwipeButtonProps) {
  const { isDarkMode } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const pan = useRef(new Animated.ValueXY()).current;
  const isSwiped = useRef(false);

  const handleWidth = 48;
  const isLeft = direction === 'left';

  // Maximum swipe distance calculation with 2.5px margin on both sides
  const maxSwipeDistanceRef = useRef(100);
  maxSwipeDistanceRef.current = trackWidth > 0 ? trackWidth - handleWidth - 5 : 100;

  // Read current drag position via listener
  const currentDragX = useRef(0);
  useEffect(() => {
    const id = pan.x.addListener((value) => {
      currentDragX.current = value.value;
    });
    return () => {
      pan.x.removeListener(id);
    };
  }, [pan.x]);

  const onSwipeSuccessRef = useRef(onSwipeSuccess);
  onSwipeSuccessRef.current = onSwipeSuccess;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  const directionRef = useRef(direction);
  directionRef.current = direction;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: () => {
        if (isSwiped.current) return;
        pan.setOffset({ x: currentDragX.current, y: 0 });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (e, gestureState) => {
        const maxDist = maxSwipeDistanceRef.current;
        if (isSwiped.current || maxDist <= 0) return;
        let nextX = gestureState.dx;
        const offset = (pan.x as any)._offset || 0;

        if (directionRef.current === 'left') {
          if (offset + nextX > 0) {
            nextX = -offset;
          } else if (offset + nextX < -maxDist) {
            nextX = -maxDist - offset;
          }
        } else {
          if (offset + nextX < 0) {
            nextX = -offset;
          } else if (offset + nextX > maxDist) {
            nextX = maxDist - offset;
          }
        }
        pan.x.setValue(nextX);
      },
      onPanResponderRelease: (e, gestureState) => {
        if (isSwiped.current) return;
        pan.flattenOffset();

        const maxDist = maxSwipeDistanceRef.current;
        const currentX = (pan.x as any)._value || 0;

        const isSuccess =
          directionRef.current === 'left'
            ? currentX <= -maxDist + 5
            : currentX >= maxDist - 5;

        if (isSuccess) {
          isSwiped.current = true;
          const targetValue = directionRef.current === 'left' ? -maxDist : maxDist;
          Animated.timing(pan.x, {
            toValue: targetValue,
            duration: 100,
            useNativeDriver: true,
          }).start(() => {
            setTimeout(() => {
              onSwipeSuccessRef.current();
              setTimeout(() => {
                isSwiped.current = false;
                pan.setValue({ x: 0, y: 0 });
              }, 400);
            }, 80);
          });
        } else {
          Animated.spring(pan.x, {
            toValue: 0,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  // Track background slide transition - Hide 100% in resting state (pan.x = 0)
  const fillTranslateX = pan.x.interpolate({
    inputRange: isLeft
      ? [-Math.max(1, maxSwipeDistanceRef.current), 0]
      : [0, Math.max(1, maxSwipeDistanceRef.current)],
    outputRange: isLeft
      ? [0, trackWidth]
      : [-trackWidth, 0],
    extrapolate: 'clamp',
  });

  const textOpacity = pan.x.interpolate({
    inputRange: isLeft
      ? [-Math.max(1, maxSwipeDistanceRef.current * 0.4), 0]
      : [0, Math.max(1, maxSwipeDistanceRef.current * 0.4)],
    outputRange: isLeft ? [0, 1] : [1, 0],
    extrapolate: 'clamp',
  });

  const textTranslateX = pan.x.interpolate({
    inputRange: isLeft
      ? [-Math.max(1, maxSwipeDistanceRef.current), 0]
      : [0, Math.max(1, maxSwipeDistanceRef.current)],
    outputRange: isLeft ? [-24, 0] : [0, 24],
    extrapolate: 'clamp',
  });

  const dynamicBorderColor = disabled
    ? (isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)')
    : getAlphaColor(color, 0.4);

  const dynamicBgColor = disabled
    ? (isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
    : getAlphaColor(color, 0.12);

  return (
    <View
      style={[
        styles.track,
        {
          borderColor: dynamicBorderColor,
          backgroundColor: dynamicBgColor,
          opacity: disabled ? 0.5 : 1,
        },
        containerStyle,
      ]}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
    >
      {/* Dynamic Colored Track Fill */}
      {trackWidth > 0 && (
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              transform: [{ translateX: fillTranslateX }],
            },
          ]}
        />
      )}

      {/* Swipe Label Text */}
      <Animated.Text
        style={[
          styles.text,
          {
            color: isDarkMode ? '#ffffff' : '#1e293b',
            opacity: textOpacity,
            transform: [{ translateX: textTranslateX }],
          },
        ]}
        numberOfLines={1}
      >
        {text}
      </Animated.Text>

      {/* Interactive Handle */}
      {trackWidth > 0 && (
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.handle,
            isLeft ? { right: 2.5, left: undefined } : { left: 2.5 },
            {
              transform: [{ translateX: pan.x }],
              shadowColor: disabled ? '#888' : color,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
              backgroundColor: disabled ? (isDarkMode ? '#3a3a3a' : '#d0d0d0') : '#ffffff',
            },
          ]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            {isLeft ? (
              <Path
                d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"
                fill={disabled ? '#888' : color}
                stroke={disabled ? '#888' : color}
                strokeWidth="0.5"
              />
            ) : (
              <Path
                d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"
                fill={disabled ? '#888' : color}
                stroke={disabled ? '#888' : color}
                strokeWidth="0.5"
              />
            )}
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: 28,
  },
  text: {
    alignSelf: 'center',
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
    color: '#ffffff',
    position: 'absolute',
    zIndex: 1,
    letterSpacing: 0.5,
    pointerEvents: 'none',
  },
  handle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 2.5,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: 'grab',
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.15)',
      } as any,
    }),
  },
});
