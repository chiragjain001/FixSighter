import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CameraView } from '../../components/camera/CameraView';
import { AROverlay } from '../../components/ar/AROverlay';
import { StatusCapsule } from '../../components/capsule/StatusCapsule';
import { LeftControls } from '../../components/ui/LeftControls';
import { HazardSheet } from '../../components/sheet/HazardSheet';
import { HazardSelectorBar } from '../../components/sheet/HazardSelectorBar';
import { AskAIButton } from '../../components/ui/AskAIButton';
import { useWsStore } from '../../store/wsStore';

/**
 * CameraScreen — FixSight V2.1 main screen.
 *
 * WebSocket lifecycle: connect() on mount, disconnect() on unmount.
 * The singleton wsStore ensures exactly ONE connection exists at all times.
 */
export default function CameraScreen() {
  const connect    = useWsStore((s) => s.connect);
  const disconnect = useWsStore((s) => s.disconnect);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.container}>
        <CameraView />
        <AROverlay />
        <StatusCapsule />
        <LeftControls />
        <HazardSelectorBar />
        <HazardSheet />
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

