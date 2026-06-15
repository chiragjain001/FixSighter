import React from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView } from '../../components/camera/CameraView';
import { AROverlay } from '../../components/ar/AROverlay';
import { StatusCapsule } from '../../components/capsule/StatusCapsule';
import { LeftControls } from '../../components/ui/LeftControls';
import { HazardSheet } from '../../components/sheet/HazardSheet';
import { HazardSelectorBar } from '../../components/sheet/HazardSelectorBar';
import { AskAIButton } from '../../components/ui/AskAIButton';
import { useWebSocket } from '../../hooks/useWebSocket';

/**
 * CameraScreen — FixSight V2.1 main screen.
 *
 * Layer order (bottom → top):
 *  1. CameraView          — live camera feed + TFLite frame processor + AROverlayLayer
 *  2. AROverlay           — scan line animation (ANALYZING state only)
 *  3. StatusCapsule       — top-center status pill
 *  4. LeftControls        — camera flip / torch / rotate / scan
 *  5. HazardSelectorBar   — multi-hazard pill tray (HAZARDS_DISCOVERED state)
 *  6. HazardSheet         — bottom sheet / landscape panel (guidance + steps)
 *  7. AskAIButton         — on-demand chat entry (collapsed pill → expanded input)
 *
 * WebSocket is mounted here so the connection is alive before the first scan.
 */
export default function CameraScreen() {
  useWebSocket();

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        {/* Layer 1: Camera + AR markers (AROverlayLayer rendered inside CameraView) */}
        <CameraView />

        {/* Layer 2: Scan animation (ANALYZING state only) */}
        <AROverlay />

        {/* Layer 3: Top-center status */}
        <StatusCapsule />

        {/* Layer 4: Left camera controls */}
        <LeftControls />

        {/* Layer 5: Multi-hazard selector pills */}
        <HazardSelectorBar />

        {/* Layer 6: Guidance bottom sheet / landscape panel */}
        <HazardSheet />

        {/* Layer 7: On-demand Ask AI chat (Phase 5) */}
        <AskAIButton />
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
