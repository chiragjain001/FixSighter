import React, { useEffect } from 'react';
import { Text, matchFont, Group, RoundedRect, Line } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import {
  SharedValue,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const fontStyle = {
  fontSize: 12,
  fontWeight: 'bold' as const,
};

interface Props {
  cx: SharedValue<number>;
  cy: SharedValue<number>;
  ringR: SharedValue<number>;
  label: string;
  opacity: SharedValue<number>;
  color: string;      // left-edge tag stripe color
  isCompact: boolean; // L1: hide label entirely
  mounted: boolean;   // entrance animation trigger
}

const STRIPE_W  = 3;
const PAD_H     = 10;
const PAD_V     = 5;
const H         = 24;
const CONNECTOR_GAP = 12; // px between ring top and label bottom

export function ARLabel({ cx, cy, ringR, label, opacity, color, isCompact, mounted }: Props) {
  const font = matchFont(fontStyle);

  // Entrance animation: slide up + fade
  const enterOffset  = useSharedValue(10);
  const enterOpacity = useSharedValue(0);

  useEffect(() => {
    if (mounted && !isCompact) {
      enterOffset.value  = withSpring(0, { damping: 18, stiffness: 300 });
      enterOpacity.value = withTiming(1, { duration: 320 });
    } else {
      enterOffset.value  = 10;
      enterOpacity.value = 0;
    }
  }, [mounted, isCompact]);

  // Label metrics
  const labelW = Math.max(label.length * 7.5 + PAD_H * 2 + STRIPE_W + 6, 70);

  // Positions derived from ring center + radius
  const bgX     = useDerivedValue(() => cx.value - labelW / 2);
  const bgY     = useDerivedValue(() => cy.value - ringR.value - CONNECTOR_GAP - H + enterOffset.value);
  const stripeX = useDerivedValue(() => bgX.value);
  const stripeY = useDerivedValue(() => bgY.value);
  const textX   = useDerivedValue(() => bgX.value + STRIPE_W + PAD_H);
  const textY   = useDerivedValue(() => bgY.value + H - PAD_V);

  // Connector line endpoints
  const p1 = useDerivedValue(() => ({ x: cx.value, y: bgY.value + H + 1 }));
  const p2 = useDerivedValue(() => ({ x: cx.value, y: cy.value - ringR.value - 2 }));

  // Combine parent opacity with entrance opacity
  const combinedOp = useDerivedValue(() => opacity.value * enterOpacity.value);

  if (!font || isCompact) return null;

  return (
    <Group opacity={combinedOp}>
      {/* Dark glass background */}
      <RoundedRect x={bgX} y={bgY} width={labelW} height={H} r={6} color="rgba(8,10,20,0.92)" />

      {/* Subtle border */}
      <RoundedRect
        x={bgX} y={bgY} width={labelW} height={H} r={6}
        color="rgba(255,255,255,0.1)" style="stroke" strokeWidth={0.8}
      />

      {/* Left ankle-tag color stripe */}
      <RoundedRect x={stripeX} y={stripeY} width={STRIPE_W} height={H} r={3} color={color} />

      {/* Label text */}
      <Text x={textX} y={textY} text={label} font={font} color="rgba(255,255,255,0.95)" />

      {/* Thin connector from label → ring */}
      <Line
        p1={p1}
        p2={p2}
        color={color}
        strokeWidth={0.9}
        style="stroke"
      />
    </Group>
  );
}
