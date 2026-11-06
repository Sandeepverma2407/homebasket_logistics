import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

const ACCENT = '#00C896';
const ORANGE = '#FFB020';
const ROAD_HEIGHT = 56;
const SCOOTER_W = 220;
const SCOOTER_H = 150;
const DASH_PERIOD = 60;

type LoopConfig = {
  from: number;
  to: number;
  duration: number;
  easing?: (value: number) => number;
  reverse?: boolean;
  delay?: number;
};

/** Endless native-driver animation. Returns the Animated.Value that is being driven. */
function useLoop({ from, to, duration, easing, reverse, delay }: LoopConfig) {
  const value = useRef(new Animated.Value(from)).current;
  useEffect(() => {
    const forward = Animated.timing(value, {
      toValue: to,
      duration,
      easing: easing ?? Easing.linear,
      useNativeDriver: true,
    });
    const cycle = reverse
      ? Animated.sequence([
          forward,
          Animated.timing(value, {
            toValue: from,
            duration,
            easing: easing ?? Easing.linear,
            useNativeDriver: true,
          }),
        ])
      : forward;
    const run = Animated.sequence([Animated.delay(delay ?? 0), Animated.loop(cycle)]);
    run.start();
    return () => run.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return value;
}

type Building = { x: number; w: number; h: number };

function buildSkyline(width: number, heights: number[], widths: number[]): Building[] {
  const out: Building[] = [];
  let x = 0;
  let i = 0;
  while (x < width) {
    let w = widths[i % widths.length];
    if (x + w > width || width - (x + w) < 14) w = width - x;
    out.push({ x, w, h: heights[i % heights.length] });
    x += w;
    i += 1;
  }
  return out;
}

function Skyline({
  width,
  height,
  buildings,
  fill,
  lit,
}: {
  width: number;
  height: number;
  buildings: Building[];
  fill: string;
  lit?: boolean;
}) {
  return (
    <Svg width={width} height={height}>
      {buildings.map((b, i) => {
        const windows: React.ReactNode[] = [];
        if (lit) {
          const cols = Math.floor((b.w - 10) / 11);
          const rows = Math.floor((b.h - 14) / 15);
          for (let r = 0; r < rows; r += 1) {
            for (let c = 0; c < cols; c += 1) {
              const on = (i * 7 + r * 3 + c * 5) % 4 === 0;
              windows.push(
                <Rect
                  key={`${i}-${r}-${c}`}
                  x={b.x + 7 + c * 11}
                  y={height - b.h + 9 + r * 15}
                  width={5}
                  height={7}
                  rx={1}
                  fill={on ? '#FFD66B' : 'rgba(255,255,255,0.07)'}
                  opacity={on ? 0.9 : 1}
                />
              );
            }
          }
        }
        return (
          <G key={i}>
            <Rect x={b.x} y={height - b.h} width={b.w} height={b.h} fill={fill} />
            {windows}
          </G>
        );
      })}
    </Svg>
  );
}

function Cloud({ scale = 1 }: { scale?: number }) {
  return (
    <Svg width={92 * scale} height={38 * scale} viewBox="0 0 92 38">
      <Circle cx={24} cy={22} r={14} fill="rgba(255,255,255,0.13)" />
      <Circle cx={46} cy={16} r={16} fill="rgba(255,255,255,0.13)" />
      <Circle cx={68} cy={22} r={13} fill="rgba(255,255,255,0.13)" />
      <Rect x={14} y={22} width={64} height={14} rx={7} fill="rgba(255,255,255,0.13)" />
    </Svg>
  );
}

function Wheel() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Circle cx={20} cy={20} r={19} fill="#10161c" />
      <Circle cx={20} cy={20} r={12} fill="#cfd8dc" />
      <Circle cx={20} cy={20} r={8} fill="#10161c" />
      <Line x1={20} y1={9} x2={20} y2={31} stroke="#90a4ae" strokeWidth={1.5} />
      <Line x1={9} y1={20} x2={31} y2={20} stroke="#90a4ae" strokeWidth={1.5} />
      <Line x1={12} y1={12} x2={28} y2={28} stroke="#90a4ae" strokeWidth={1.5} />
      <Line x1={28} y1={12} x2={12} y2={28} stroke="#90a4ae" strokeWidth={1.5} />
      <Circle cx={20} cy={20} r={3} fill={ACCENT} />
    </Svg>
  );
}

function ScooterRider() {
  return (
    <Svg width={SCOOTER_W} height={SCOOTER_H} viewBox={`0 0 ${SCOOTER_W} ${SCOOTER_H}`}>
      <Ellipse cx={110} cy={143} rx={84} ry={5} fill="rgba(0,0,0,0.35)" />

      {/* delivery box on the back */}
      <Rect x={22} y={26} width={58} height={46} rx={9} fill={ORANGE} />
      <Rect x={22} y={26} width={58} height={12} rx={6} fill="#FF9500" />
      <Rect x={47} y={26} width={8} height={46} fill="rgba(255,255,255,0.35)" />
      <Path d="M38 54 l8 -6 l8 6 v10 h-16 z" fill="#ffffff" opacity={0.92} />

      {/* scooter body */}
      <Path d="M30 98 C30 82 52 74 80 74 L112 74 L118 100 Z" fill="#EAF7F2" />
      <Path d="M34 94 C46 86 70 84 112 86 L114 92 C74 90 50 92 36 100 Z" fill={ACCENT} />
      <Rect x={58} y={66} width={56} height={11} rx={5.5} fill="#15262e" />
      <Rect x={92} y={100} width={62} height={10} rx={5} fill="#BFE3D6" />
      <Path d="M136 106 L130 62 Q130 54 139 54 L150 54 Q156 54 158 62 L164 106 Z" fill="#EAF7F2" />
      <Path d="M140 100 L136 66 L146 66 L152 100 Z" fill={ACCENT} opacity={0.9} />
      <Line x1={152} y1={58} x2={170} y2={116} stroke="#37474f" strokeWidth={6} strokeLinecap="round" />
      <Path d="M140 48 L152 42 L158 44" stroke="#263238" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Line x1={153} y1={42} x2={150} y2={31} stroke="#37474f" strokeWidth={2} />
      <Circle cx={150} cy={28} r={3.5} fill="#90a4ae" />
      <Path d="M158 52 q12 -2 14 8 q-2 8 -14 6 z" fill="#FFF59D" />
      <Path d="M150 98 Q172 84 192 104" stroke="#EAF7F2" strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M22 104 Q36 82 66 96" stroke="#EAF7F2" strokeWidth={5} strokeLinecap="round" fill="none" />

      {/* rider */}
      <Path d="M82 78 Q104 84 108 98 L112 104" stroke="#2b3a67" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Ellipse cx={116} cy={106} rx={9} ry={4.5} fill="#111111" />
      <Path d="M70 78 C66 56 76 40 94 38 C108 38 114 50 108 64 L100 80 Z" fill={ACCENT} />
      <Path d="M98 48 Q122 56 140 50" stroke="#00B58A" strokeWidth={8} strokeLinecap="round" fill="none" />
      <Circle cx={141} cy={50} r={4.5} fill="#F2C4A0" />
      <Circle cx={104} cy={28} r={11} fill="#F2C4A0" />
      <Path d="M91 28 A13 13 0 0 1 117 28 L117 32 L91 32 Z" fill="#F5F5F5" />
      <Path d="M91 28 A13 13 0 0 1 104 15" stroke={ACCENT} strokeWidth={3} fill="none" />
      <Rect x={105} y={25} width={13} height={7} rx={3.5} fill="#263238" opacity={0.9} />
    </Svg>
  );
}

function GlassBadge({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(255,255,255,0.10)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

type Props = {
  width: number;
  height: number;
  topInset: number;
  children?: React.ReactNode;
};

/**
 * Animated delivery scene for the login screen: parallax city, drifting clouds, moving road,
 * a bobbing scooter with spinning wheels, dust puffs, speed lines and floating badges.
 */
export default function LoginHero({ width: W, height: H, topInset, children }: Props) {
  const roadTop = H - ROAD_HEIGHT;
  const scooterLeft = Math.max(6, (W - SCOOTER_W) / 2 + 8);
  const scooterTop = roadTop - 138 + 6;

  const farBuildings = useMemo(
    () => buildSkyline(W, [70, 104, 60, 128, 84, 112, 66, 138, 90, 76], [38, 54, 44, 62, 48]),
    [W]
  );
  const nearBuildings = useMemo(
    () => buildSkyline(W, [46, 82, 62, 98, 52, 108, 70, 58], [58, 70, 52, 76, 64]),
    [W]
  );
  const stars = useMemo(
    () =>
      Array.from({ length: 20 }, (_, i) => ({
        x: ((i * 97 + 31) % 100) / 100 * W,
        y: topInset + 12 + ((i * 53 + 17) % 100) / 100 * (H * 0.42),
        r: i % 3 === 0 ? 1.8 : 1.2,
      })).filter(
        // keep the stars off the logo / tagline text on the left
        (s) => !(s.x < W * 0.64 && s.y > topInset + 8 && s.y < topInset + 175)
      ),
    [W, H, topInset]
  );

  // continuous loops
  const farX = useLoop({ from: 0, to: -W, duration: 34000 });
  const nearX = useLoop({ from: 0, to: -W, duration: 15000 });
  const roadX = useLoop({ from: 0, to: -DASH_PERIOD, duration: 380 });
  const cloudA = useLoop({ from: W, to: -140, duration: 30000 });
  const cloudB = useLoop({ from: W + 120, to: -140, duration: 42000, delay: 4000 });
  const cloudC = useLoop({ from: W + 60, to: -140, duration: 36000, delay: 12000 });
  const bob = useLoop({ from: 0, to: 1, duration: 420, reverse: true, easing: Easing.inOut(Easing.sin) });
  const wheel = useLoop({ from: 0, to: 1, duration: 520 });
  const beam = useLoop({ from: 0, to: 1, duration: 900, reverse: true, easing: Easing.inOut(Easing.sin) });
  const puffA = useLoop({ from: 0, to: 1, duration: 1100 });
  const puffB = useLoop({ from: 0, to: 1, duration: 1100, delay: 370 });
  const puffC = useLoop({ from: 0, to: 1, duration: 1100, delay: 740 });
  const lineA = useLoop({ from: 0, to: 1, duration: 1300 });
  const lineB = useLoop({ from: 0, to: 1, duration: 1700, delay: 400 });
  const lineC = useLoop({ from: 0, to: 1, duration: 1500, delay: 800 });
  const floatA = useLoop({ from: 0, to: 1, duration: 2400, reverse: true, easing: Easing.inOut(Easing.sin) });
  const floatB = useLoop({ from: 0, to: 1, duration: 3000, reverse: true, easing: Easing.inOut(Easing.sin), delay: 500 });
  const floatC = useLoop({ from: 0, to: 1, duration: 2700, reverse: true, easing: Easing.inOut(Easing.sin), delay: 900 });
  const ring = useLoop({ from: 0, to: 1, duration: 1700 });
  const twinkleA = useLoop({ from: 0, to: 1, duration: 1800, reverse: true, easing: Easing.inOut(Easing.sin) });
  const twinkleB = useLoop({ from: 0, to: 1, duration: 2300, reverse: true, easing: Easing.inOut(Easing.sin), delay: 600 });

  const float = (v: Animated.Value, dist: number) =>
    v.interpolate({ inputRange: [0, 1], outputRange: [0, -dist] });

  const speedLine = (v: Animated.Value, top: number, w: number) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: w,
        height: 3,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.28)',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 1, 0] }),
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [W, -w - 20] }) }],
      }}
    />
  );

  const puff = (v: Animated.Value) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: scooterLeft + 24,
        top: scooterTop + 122,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: 'rgba(255,255,255,0.5)',
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -80] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 2] }) },
        ],
      }}
    />
  );

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ width: W, height: H, overflow: 'hidden' }}>
      {/* sky + glows */}
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#031A16" />
            <Stop offset="0.55" stopColor="#06392F" />
            <Stop offset="1" stopColor="#0A6650" />
          </LinearGradient>
          <RadialGradient id="moon" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ACCENT} stopOpacity={0.5} />
            <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="ground" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={ACCENT} stopOpacity={0.4} />
            <Stop offset="1" stopColor={ACCENT} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="url(#sky)" />
        <Circle cx={W * 0.78} cy={topInset + 92} r={150} fill="url(#moon)" />
        <Circle cx={W * 0.78} cy={topInset + 92} r={24} fill="rgba(255,255,255,0.16)" />
        <Ellipse cx={W * 0.5} cy={roadTop} rx={W * 0.7} ry={70} fill="url(#ground)" />
      </Svg>

      {/* twinkling stars */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: twinkleA.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }) }]}>
        <Svg width={W} height={H}>
          {stars.filter((_, i) => i % 2 === 0).map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" />
          ))}
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: twinkleB.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.95] }) }]}>
        <Svg width={W} height={H}>
          {stars.filter((_, i) => i % 2 === 1).map((s, i) => (
            <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#ffffff" />
          ))}
        </Svg>
      </Animated.View>

      {/* far skyline (slow) */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, bottom: ROAD_HEIGHT - 2, width: W * 2, height: 140, flexDirection: 'row', transform: [{ translateX: farX }] }}
      >
        <Skyline width={W} height={140} buildings={farBuildings} fill="rgba(255,255,255,0.07)" />
        <Skyline width={W} height={140} buildings={farBuildings} fill="rgba(255,255,255,0.07)" />
      </Animated.View>

      {/* clouds */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: topInset + 62, transform: [{ translateX: cloudA }] }}>
        <Cloud scale={1.1} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: topInset + 128, transform: [{ translateX: cloudB }] }}>
        <Cloud scale={0.8} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', top: topInset + 36, transform: [{ translateX: cloudC }] }}>
        <Cloud scale={0.65} />
      </Animated.View>

      {/* near skyline (faster, with lit windows) */}
      <Animated.View
        pointerEvents="none"
        style={{ position: 'absolute', left: 0, bottom: ROAD_HEIGHT - 2, width: W * 2, height: 112, flexDirection: 'row', transform: [{ translateX: nearX }] }}
      >
        <Skyline width={W} height={112} buildings={nearBuildings} fill="#072b24" lit />
        <Skyline width={W} height={112} buildings={nearBuildings} fill="#072b24" lit />
      </Animated.View>

      {/* road */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: ROAD_HEIGHT, backgroundColor: '#0b1513' }}>
        <View style={{ height: 2, backgroundColor: 'rgba(0,200,150,0.55)' }} />
        <Animated.View style={{ position: 'absolute', top: 24, left: 0, width: W + DASH_PERIOD * 2, transform: [{ translateX: roadX }] }}>
          <Svg width={W + DASH_PERIOD * 2} height={6}>
            {Array.from({ length: Math.ceil(W / DASH_PERIOD) + 3 }, (_, i) => (
              <Rect key={i} x={i * DASH_PERIOD} y={1} width={30} height={4} rx={2} fill="rgba(255,255,255,0.45)" />
            ))}
          </Svg>
        </Animated.View>
      </View>

      {/* speed lines + dust */}
      {speedLine(lineA, roadTop - 92, 70)}
      {speedLine(lineB, roadTop - 62, 46)}
      {speedLine(lineC, roadTop - 30, 90)}
      {puff(puffA)}
      {puff(puffB)}
      {puff(puffC)}

      {/* headlight beam */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: scooterLeft + 178,
          top: scooterTop + 40,
          opacity: beam.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        }}
      >
        <Svg width={120} height={56}>
          <Defs>
            <LinearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#FFF59D" stopOpacity={0.6} />
              <Stop offset="1" stopColor="#FFF59D" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Polygon points="0,18 120,0 120,56 0,32" fill="url(#beam)" />
        </Svg>
      </Animated.View>

      {/* scooter + rider */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: scooterLeft,
          top: scooterTop,
          width: SCOOTER_W,
          height: SCOOTER_H,
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] }) },
            { rotate: bob.interpolate({ inputRange: [0, 1], outputRange: ['-0.6deg', '0.6deg'] }) },
          ],
        }}
      >
        <ScooterRider />
        <Animated.View style={{ position: 'absolute', left: 28, top: 98, transform: [{ rotate: spin }] }}>
          <Wheel />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', left: 150, top: 98, transform: [{ rotate: spin }] }}>
          <Wheel />
        </Animated.View>
      </Animated.View>

      {/* floating badges */}
      <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 26, top: topInset + 66, transform: [{ translateY: float(floatA, 7) }] }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: 46,
            height: 46,
            borderRadius: 23,
            borderWidth: 2,
            borderColor: ACCENT,
            opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
            transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
          }}
        />
        <GlassBadge size={46}>
          <Svg width={24} height={24} viewBox="0 0 24 24">
            <Path
              d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
              fill={ACCENT}
            />
          </Svg>
        </GlassBadge>
      </Animated.View>

      <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 96, top: topInset + 148, transform: [{ translateY: float(floatB, 9) }] }}>
        <GlassBadge size={40}>
          <Svg width={22} height={22} viewBox="0 0 24 24">
            <Path
              d="M21 8l-9-5-9 5 9 5 9-5zM3 8v9l9 5 9-5V8M12 13v9"
              stroke={ORANGE}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
          </Svg>
        </GlassBadge>
      </Animated.View>

      <Animated.View pointerEvents="none" style={{ position: 'absolute', right: 22, top: topInset + 168, transform: [{ translateY: float(floatC, 6) }] }}>
        <GlassBadge size={36}>
          <Text style={{ color: '#FFD66B', fontSize: 17, fontFamily: 'Inter-Bold' }}>₹</Text>
        </GlassBadge>
      </Animated.View>

      {/* caller content (logo, tagline) */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
}
