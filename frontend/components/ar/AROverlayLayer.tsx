import React, { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useSharedValue, useDerivedValue, withTiming } from 'react-native-reanimated';
import { useARTrackingStore } from '../../store/arTrackingStore';
import { useARDisclosureLevel } from '../../hooks/useARDisclosureLevel';
import { useWorkflowStore } from '../../store/workflowStore';
import { ARMarker } from './ARMarker';
import { ARConnector } from './ARConnector';

/**
 * AROverlayLayer — single Canvas rendering all AR markers.
 *
 * Progressive Disclosure enforcement (V2.1):
 *   MAX 1 hazard marker + 1 step/mitigation target + 1 connector visible at any time.
 *
 * Reads from arTrackingStore (tracker-driven smoothedBox positions).
 * Uses useARDisclosureLevel as the single visibility gatekeeper.
 */
export function AROverlayLayer() {
  const { width: screenW, height: screenH } = useWindowDimensions();

  const targets           = useARTrackingStore((s) => s.targets);
  const workflowState     = useWorkflowStore((s) => s.workflowState);
  const completedStepIds  = useWorkflowStore((s) => s.completedStepIds);

  const {
    level,
    activeStepId,
    chatFocusTargetId,
    spotlightTargetId,
  } = useARDisclosureLevel();

  // Only render when there's something to show
  const shouldRender =
    targets.length > 0 &&
    (workflowState === 'HAZARDS_DISCOVERED' ||
     workflowState === 'HAZARD_FOCUSED' ||
     workflowState === 'SHEET_OPEN');

  const hazardTarget = targets.find((t) => t.type === 'primary_hazard' && !t.isLost);
  const stepTarget   = targets.find((t) => t.step_reference === activeStepId && !t.isLost);
  const shouldConnect = level === 'STEP_GUIDANCE' && !!activeStepId && !!hazardTarget && !!stepTarget;

  const connectorOpacity = useSharedValue(0);
  React.useEffect(() => {
    connectorOpacity.value = withTiming(shouldConnect ? 0.9 : 0, { duration: 300 });
  }, [shouldConnect]);

  const connFromX = useDerivedValue(() => {
    if (!hazardTarget) return 0;
    const [hx1, hy1, hx2, hy2] = hazardTarget.boxSV.value;
    return ((hx1 + hx2) / 2) * screenW;
  });
  
  const connFromY = useDerivedValue(() => {
    if (!hazardTarget) return 0;
    const [hx1, hy1, hx2, hy2] = hazardTarget.boxSV.value;
    return ((hy1 + hy2) / 2) * screenH;
  });

  const connToX = useDerivedValue(() => {
    if (!stepTarget) return screenW / 2;
    const [sx1, sy1, sx2, sy2] = stepTarget.boxSV.value;
    return ((sx1 + sx2) / 2) * screenW;
  });

  const connToY = useDerivedValue(() => {
    if (!stepTarget) return screenH / 2;
    const [sx1, sy1, sx2, sy2] = stepTarget.boxSV.value;
    return ((sy1 + sy2) / 2) * screenH;
  });

  if (!shouldRender) return null;

  const hasActiveStep = !!activeStepId;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* L3 connector — single path between hazard and step target */}
      <ARConnector
        fromX={connFromX}
        fromY={connFromY}
        toX={connToX}
        toY={connToY}
        opacity={connectorOpacity}
        color="#30D158"
      />

      {/* All tracked markers — each self-governs opacity via disclosure level */}
      {targets.map((target) => (
        <ARMarker
          key={target.id}
          target={target}
          level={level}
          spotlightTargetId={spotlightTargetId}
          activeStepId={activeStepId}
          chatFocusTargetId={chatFocusTargetId}
          hasActiveStep={hasActiveStep}
        />
      ))}
    </Canvas>
  );
}
