import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { MessageSquareText, Send, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { useChatStore } from '../../store/chatStore';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useARTrackingStore } from '../../store/arTrackingStore';
import { useWorkflowStore } from '../../store/workflowStore';
import { ChatBubble } from './ChatBubble';

/**
 * AskAIButton — on-demand chat entry point (Phase 5).
 *
 * Behavior:
 *  - Collapsed: small floating pill button "Ask AI" near top-right HUD
 *  - Expanded: glassmorphism input bar slides up
 *  - After response: ChatBubble appears with AI's reply
 *  - Auto-collapses after response is received
 *
 * Does NOT appear during ANALYZING state (main workflow takes priority).
 */
export function AskAIButton() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const workflowState = useWorkflowStore((s) => s.workflowState);

  const { isOpen, open, close, isTyping, addUserMessage, getHistory } = useChatStore();
  const { sendChatFrame } = useWebSocket();
  const cameraRef = useWorkflowStore((s) => s.cameraRef);

  const [inputText, setInputText] = useState('');
  const inputRef = useRef<TextInput>(null);

  // Don't show during analysis — focus on the main safety workflow
  if (workflowState === 'ANALYZING' || workflowState === 'READY') return null;

  const handleOpen = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    open();
    setTimeout(() => (inputRef.current as any)?.focus(), 200);
  };

  const handleClose = () => {
    close();
    setInputText('');
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;

    setInputText('');
    close();
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Add user message to history
    addUserMessage(text);
    useChatStore.getState().setTyping(true);

    // Capture current frame
    try {
      if (!cameraRef) return;
      const photo = await cameraRef.takePhoto({ flash: 'off' });
      
      const b64 = await FileSystem.readAsStringAsync(photo.path, {
        encoding: FileSystem.EncodingType.Base64,
      });

      sendChatFrame(text, b64);
    } catch (e) {
      console.error('[AskAI] Failed to capture frame:', e);
      useChatStore.getState().setTyping(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {/* Chat bubble response display */}
      <ChatBubble />

      {/* Collapsed pill button */}
      {!isOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.pillWrapper, { top: Math.max(insets.top, 30) + 16, right: 16 }]}
          pointerEvents="box-none"
        >
          <Pressable onPress={handleOpen} hitSlop={8} style={({ pressed }) => [styles.pillContainer, pressed && { opacity: 0.8 }]}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.pillInner}>
              <MessageSquareText color="rgba(255,255,255,0.9)" size={16} strokeWidth={2} />
              <Text style={styles.pillText}>Ask AI</Text>
            </View>
          </Pressable>
        </Animated.View>
      )}

      {/* Expanded input bar */}
      {isOpen && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={[styles.inputWrapper, { bottom: Math.max(insets.bottom, 20) + 16 }]}
          pointerEvents="auto"
        >
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, styles.inputOverlay]} />

          <Pressable onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <X color="rgba(255,255,255,0.45)" size={18} strokeWidth={2} />
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder="What is this? Is it safe?"
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline={false}
            maxLength={200}
          />

          <Pressable
            onPress={handleSend}
            disabled={!inputText.trim() || isTyping}
            style={({ pressed }) => [
              styles.sendBtn,
              (!inputText.trim() || isTyping) && { opacity: 0.35 },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Send color="#60a5fa" size={18} strokeWidth={2.5} />
          </Pressable>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pillWrapper: {
    position: 'absolute',
    zIndex: 200,
  },
  pillContainer: {
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(10,12,20,0.4)',
  },
  pillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  inputWrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    zIndex: 200,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  inputOverlay: {
    backgroundColor: 'rgba(8,10,20,0.5)',
  },
  closeBtn: {
    zIndex: 1,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#fff',
    zIndex: 1,
    paddingVertical: 0,
  },
  sendBtn: {
    zIndex: 1,
  },
});
