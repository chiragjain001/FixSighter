import React, { useCallback, useRef, useMemo, useEffect } from 'react';
import type { Hazard } from '../../src/types';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import BottomSheetGorhom, {
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
  withRepeat,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import {
  CheckCircle,
  Circle,
  ShieldAlert,
  Zap,
  Search,
  Brush,
  Plus,
  ChevronUp,
  MapPin,
} from 'lucide-react-native';
import { useWorkflowStore } from '../../store/workflowStore';
import type { ActionStep, RiskLevel } from '../../src/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const RISK_COLOR: Record<RiskLevel, string> = {
  LOW:      '#22c55e',
  MEDIUM:   '#fb923c',
  HIGH:     '#ef4444',
  CRITICAL: '#ef4444',
};

const RISK_LABEL: Record<RiskLevel, string> = {
  LOW:      'Low Risk',
  MEDIUM:   'Medium Risk',
  HIGH:     'High Risk',
  CRITICAL: 'High Risk',
};

// ── Tag chip ─────────────────────────────────────────────────────
function TagChip({ label, dot, dotColor }: { label: string; dot?: boolean; dotColor?: string }) {
  return (
    <View style={styles.chip}>
      {dot && <View style={[styles.chipDot, dotColor ? { backgroundColor: dotColor } : {}]} />}
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ── Step card ────────────────────────────────────────────────────
function StepCard({
  action,
  index,
  isCompleted,
  isActive,
  onToggle,
  onPress,
}: {
  action: ActionStep;
  index: number;
  isCompleted: boolean;
  isActive: boolean;
  onToggle: () => void;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: isCompleted ? 'rgba(74,222,128,0.07)' : isActive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
    borderColor: isCompleted ? 'rgba(74,222,128,0.22)' : isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)',
  }));

  return (
    <Pressable
      onPress={() => {
        scale.value = withSequence(withTiming(0.97, { duration: 70 }), withSpring(1, { damping: 12 }));
        onPress();
      }}
    >
      <Animated.View entering={FadeIn.delay(index * 80).duration(300)}>
        <Animated.View style={[styles.stepCard, cardStyle]}>
          <View style={[styles.stepNum, { backgroundColor: isCompleted ? 'rgba(74,222,128,0.18)' : 'rgba(255,255,255,0.08)' }]}>
            <Text style={[styles.stepNumText, { color: isCompleted ? '#4ade80' : 'rgba(255,255,255,0.55)' }]}>
              {index + 1}
            </Text>
          </View>
          <View style={styles.stepBody}>
            <View style={styles.stepTitleRow}>
              <Text style={[styles.stepTitle, { opacity: isCompleted ? 0.45 : 1 }]} numberOfLines={2}>
                {action.title}
              </Text>
              {action.isCritical && !isCompleted && (
                <View style={styles.urgentTag}>
                  <Text style={styles.urgentText}>Urgent</Text>
                </View>
              )}
            </View>
            <Text style={[styles.stepSub, { opacity: isCompleted ? 0.35 : 0.6 }]}>{action.subtitle}</Text>
            {action.estimatedTime && (
              <Text style={styles.stepTime}>{action.estimatedTime}</Text>
            )}
          </View>
          {/* AR-pin indicator: shown when step is active — tells user AR is focused here */}
          {isActive && !isCompleted && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.arPinBadge}>
              <MapPin color="#60a5fa" size={13} strokeWidth={2.5} />
            </Animated.View>
          )}
          <Pressable onPress={onToggle} hitSlop={10}>
            {isCompleted
              ? <Animated.View entering={FadeIn.duration(200)}><CheckCircle color="#4ade80" size={26} strokeWidth={2} /></Animated.View>
              : <Circle color={isActive ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"} size={26} strokeWidth={1.5} />
            }
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────
// Minimized arrow indicator (when sheet is at snap 0)
// ─────────────────────────────────────────────────────────────────
function ArrowIndicator({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  const arrowY = useSharedValue(0);

  useEffect(() => {
    arrowY.value = withRepeat(
      withSequence(withTiming(-4, { duration: 600 }), withTiming(0, { duration: 600 })),
      -1, true
    );
  }, []);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowY.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={[styles.arrowBtn, { bottom: insets.bottom + 8 }]}
    >
      <Animated.View style={[styles.arrowInner, arrowStyle]}>
        <ChevronUp color="rgba(255,255,255,0.6)" size={18} strokeWidth={2.5} />
      </Animated.View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────
// Skeleton Body (Analyzing State)
// ─────────────────────────────────────────────────────────────────
function SkeletonBody() {
  const op = useSharedValue(0.2);
  useEffect(() => {
    op.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.2, { duration: 800 })),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: op.value }));

  return (
    <Animated.View style={[{ paddingTop: 12 }, animStyle]}>
      {/* Header Placeholder */}
      <View style={{ width: 70, height: 14, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 14 }} />
      
      {/* Title Placeholder */}
      <View style={{ width: '80%', height: 32, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 8, marginBottom: 8 }} />
      <View style={{ width: '50%', height: 16, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 4, marginBottom: 24 }} />
      
      {/* Tags Placeholder */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 30 }}>
        <View style={{ width: 70, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14 }} />
        <View style={{ width: 90, height: 28, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 14 }} />
      </View>

      {/* Button Placeholder */}
      <View style={{ width: 140, height: 48, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16 }} />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Sheet body content — shared between portrait & landscape
// ─────────────────────────────────────────────────────────────────
function SheetBody({
  hazard,
  color,
  riskLabel,
  completedStepIds,
  toggleStep,
  allDone,
  isExpanded,
  onExpand,
}: {
  hazard: Hazard;
  color: string;
  riskLabel: string;
  completedStepIds: Set<string>;
  toggleStep: (id: string) => void;
  allDone: boolean;
  isExpanded: boolean;
  onExpand: () => void;
}) {
  const activeStepId = useWorkflowStore(s => s.activeStepId);
  const setActiveStep = useWorkflowStore(s => s.setActiveStep);

  return (
    <View>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.aiLabel}>AI Insight</Text>
        <View style={[styles.riskBadge, { backgroundColor: `${color}22`, borderColor: `${color}55` }]}>
          <Text style={[styles.riskBadgeText, { color }]}>{riskLabel}</Text>
          <View style={[styles.riskDiamond, { backgroundColor: color }]} />
        </View>
      </View>

      {/* ── Title ── */}
      <Text style={styles.title}>{hazard.title}</Text>
      <Text style={styles.subtitle}>{hazard.subtitle}</Text>

      {/* ── Tags ── */}
      <View style={styles.tagsRow}>
        {hazard.tags.map((tag: string, i: number) => (
          <TagChip key={i} label={tag} dot={i === 0} dotColor={color} />
        ))}
      </View>

      {/* ── "Next Step" CTA (peek state only) ── */}
      {!isExpanded && (
        <Pressable
          onPress={async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onExpand();
          }}
          style={({ pressed }) => [styles.nextStepBtn, pressed && { opacity: 0.82 }]}
        >
          <View style={styles.nextStepIcon}>
            <Plus color="#4ade80" size={18} strokeWidth={2.5} />
          </View>
          <Text style={styles.nextStepText}>Next Step</Text>
        </Pressable>
      )}

      {/* ── Full expanded content ── */}
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(300)}>
          <View style={styles.divider} />
          <Text style={styles.sectionLabel}>AI RESPONSE PLAN</Text>
          <Text style={styles.sectionSub}>Resolve: {hazard.title}</Text>

          <View style={styles.warningBlock}>
            <Text style={styles.warningText}>{hazard.whyItMatters}</Text>
          </View>

          <View style={styles.stepsWrap}>
            {hazard.actions.map((action: ActionStep, i: number) => (
              <StepCard
                key={action.id}
                action={action}
                index={i}
                isCompleted={completedStepIds.has(action.id)}
                isActive={activeStepId === action.id}
                onToggle={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggleStep(action.id);
                  // Auto-advance focus to next uncompleted step
                  const nextStep = hazard.actions.find(
                    (a: ActionStep, idx: number) => idx > i && !completedStepIds.has(a.id)
                  );
                  if (nextStep) setActiveStep(nextStep.id);
                }}
                onPress={() => setActiveStep(action.id)}
              />
            ))}
          </View>

          {allDone && (
            <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.completionBanner}>
              <CheckCircle color="#4ade80" size={20} strokeWidth={2} />
              <Text style={styles.completionText}>All steps completed — stay safe!</Text>
            </Animated.View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Portrait bottom sheet with 3 snap points
// ─────────────────────────────────────────────────────────────────
const CustomBackground = ({ style }: any) => (
  <View style={[style, { overflow: 'hidden', borderTopLeftRadius: 28, borderTopRightRadius: 28 }]}>
    <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,12,18,0.5)' }]} />
  </View>
);

function PortraitSheet() {
  const {
    workflowState,
    selectedHazard,
    completedStepIds,
    toggleStep,
    openSheet,
    setSheetSnapIndex,
    sheetSnapIndex,
  } = useWorkflowStore();
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetGorhom>(null);

  /**
   * 3 snap points:
   *   0: '9%'  → minimized — only drag handle visible + arrow indicator
   *   1: '30%' → peek — AI Insight header + title + tags + Next Step
   *   2: '82%' → full — scrollable step checklist
   */
  const snapPoints = useMemo(() => ['9%', '30%', '82%'], []);

  const isVisible =
    workflowState === 'HAZARD_FOCUSED' || workflowState === 'SHEET_OPEN' || workflowState === 'ANALYZING';

  // When workflow state changes, snap the sheet to the right position
  useEffect(() => {
    if (workflowState === 'HAZARD_FOCUSED' || workflowState === 'ANALYZING') {
      sheetRef.current?.snapToIndex(1); // peek
      setSheetSnapIndex(1);
    } else if (workflowState === 'SHEET_OPEN') {
      sheetRef.current?.snapToIndex(2); // full
      setSheetSnapIndex(2);
    } else {
      sheetRef.current?.close();
      setSheetSnapIndex(-1);
    }
  }, [workflowState]);

  // Track snap changes (user drag)
  const handleSheetChange = useCallback(
    (index: number) => {
      setSheetSnapIndex(index);
      if (index === 2 && workflowState === 'HAZARD_FOCUSED') {
        openSheet();
      }
    },
    [workflowState, openSheet, setSheetSnapIndex]
  );

  if (!isVisible) return null;

  const isAnalyzing = workflowState === 'ANALYZING';

  let color = '#fff';
  let riskLabel = '';
  let allDone = false;
  if (selectedHazard) {
    color = RISK_COLOR[selectedHazard.riskLevel];
    riskLabel = RISK_LABEL[selectedHazard.riskLevel];
    allDone = selectedHazard.actions.every((a) => completedStepIds.has(a.id));
  }
  const isMinimized = sheetSnapIndex === 0;

  return (
    <>
      {/* Arrow indicator shown when sheet is minimized */}
      {isMinimized && (
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(150)}
          style={StyleSheet.absoluteFill}
          pointerEvents="box-none"
        >
          <ArrowIndicator
            onPress={() => {
              sheetRef.current?.snapToIndex(1);
              setSheetSnapIndex(1);
            }}
          />
        </Animated.View>
      )}

      <BottomSheetGorhom
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}   // don't fully close — just minimize to snap 0
        onChange={handleSheetChange}
        backgroundComponent={CustomBackground}
        handleIndicatorStyle={styles.handle}
        style={styles.sheet}
      >
        {/* Don't render content when minimized (just show drag handle) */}
        {!isMinimized && (
          <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
            {isAnalyzing || !selectedHazard ? (
              <SkeletonBody />
            ) : (
              <SheetBody
                hazard={selectedHazard}
                color={color}
                riskLabel={riskLabel}
                completedStepIds={completedStepIds}
                toggleStep={toggleStep}
                allDone={allDone}
                isExpanded={workflowState === 'SHEET_OPEN' || sheetSnapIndex === 2}
                onExpand={openSheet}
              />
            )}
          </BottomSheetScrollView>
        )}
      </BottomSheetGorhom>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Landscape right-side panel
// ─────────────────────────────────────────────────────────────────
function LandscapePanel() {
  const { workflowState, selectedHazard, completedStepIds, toggleStep, openSheet, setSheetSnapIndex } =
    useWorkflowStore();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const panelW = Math.min(360, width * 0.42);
  const slideX = useSharedValue(panelW);

  const isVisible =
    workflowState === 'HAZARD_FOCUSED' || workflowState === 'SHEET_OPEN' || workflowState === 'ANALYZING';

  useEffect(() => {
    if (isVisible) {
      slideX.value = withSpring(0, { damping: 20, stiffness: 200 });
      setSheetSnapIndex(2);
    } else {
      slideX.value = withTiming(panelW, { duration: 260 });
      setSheetSnapIndex(-1);
    }
  }, [isVisible]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: slideX.value }],
  }));

  const isAnalyzing = workflowState === 'ANALYZING';

  if (!isVisible) return null;

  let color = '#fff';
  let riskLabel = '';
  let allDone = false;
  if (selectedHazard) {
    color = RISK_COLOR[selectedHazard.riskLevel];
    riskLabel = RISK_LABEL[selectedHazard.riskLevel];
    allDone = selectedHazard.actions.every((a) => completedStepIds.has(a.id));
  }

  return (
    <Animated.View
      style={[
        styles.landscapePanel,
        { width: panelW, paddingTop: insets.top, paddingBottom: insets.bottom, paddingRight: insets.right },
        panelStyle,
      ]}
      pointerEvents={isVisible ? 'auto' : 'none'}
    >
      <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(11,12,18,0.5)' }]} />
      <View style={styles.landscapeHandle} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {isAnalyzing || !selectedHazard ? (
          <SkeletonBody />
        ) : (
          <SheetBody
            hazard={selectedHazard}
            color={color}
            riskLabel={riskLabel}
            completedStepIds={completedStepIds}
            toggleStep={toggleStep}
            allDone={allDone}
            isExpanded={true}
            onExpand={openSheet}
          />
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main export — orientation-aware
// ─────────────────────────────────────────────────────────────────
export function HazardSheet() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  return isLandscape ? <LandscapePanel /> : <PortraitSheet />;
}

// ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.65,
    shadowRadius: 28,
    elevation: 28,
    // High zIndex — above hazard selector pills (zIndex 50)
    zIndex: 1000,
  },
  sheetBg: {
    backgroundColor: 'rgba(11,12,18,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    width: 38,
    height: 4,
    borderRadius: 2,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 52,
  },

  // Arrow indicator (minimized state)
  arrowBtn: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 60,
    width: 52,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowInner: {
    backgroundColor: 'rgba(30,30,40,0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },

  // Landscape
  landscapePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.07)',
    zIndex: 1000,
  },
  landscapeHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginVertical: 10,
  },

  // Sheet content
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  aiLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 99,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  riskBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  riskDiamond: {
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    lineHeight: 34,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 16,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 99,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  nextStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  nextStepIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(74,222,128,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 18,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 14,
    lineHeight: 18,
  },
  warningBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 14,
    marginBottom: 16,
  },
  warningText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 19,
  },
  stepsWrap: {
    gap: 10,
    marginBottom: 20,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  stepNum: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumText: { fontSize: 13, fontWeight: '700' },
  stepBody: { flex: 1, gap: 2 },
  stepTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#fff', flex: 1 },
  urgentTag: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  urgentText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#f87171',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  arPinBadge: {
    backgroundColor: 'rgba(96,165,250,0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.25)',
    padding: 5,
    marginRight: 4,
  },
  stepSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  stepTime: { fontSize: 10, color: 'rgba(255,255,255,0.28)', marginTop: 3 },
  completionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(74,222,128,0.09)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.22)',
  },
  completionText: { fontSize: 14, fontWeight: '600', color: '#4ade80' },
});
