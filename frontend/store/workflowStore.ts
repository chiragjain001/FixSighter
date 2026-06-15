import { create } from 'zustand';
import type { Hazard, SceneHazard, SpatialTarget, RiskLevel, ActionStep } from '../src/types';

export type WorkflowState =
  | 'READY'
  | 'ANALYZING'
  | 'HAZARDS_DISCOVERED'
  | 'HAZARD_FOCUSED'
  | 'SHEET_OPEN';

export type FacingMode = 'back' | 'front';

// ── Adapter: SceneHazard → Hazard ────────────────────────────────────────────
// Converts the V2.1 SceneHazard into the legacy Hazard shape used by
// HazardSheet and HazardSelectorBar without modifying those components yet.
function sceneHazardToHazard(h: SceneHazard): Hazard {
  const actions: ActionStep[] = (h.guidance?.actions ?? []).map((a, i) => ({
    id: a.id,
    stepNumber: i + 1,
    icon: 'info',
    title: a.title,
    subtitle: a.subtitle,
    isCritical: h.risk_level === 'CRITICAL' || h.risk_level === 'HIGH',
    estimatedTime: undefined,
    arAnchorId: undefined,
  }));

  return {
    id: h.id,
    title: h.title,
    subtitle: h.summary,
    riskLevel: h.risk_level,
    confidence: h.confidence,
    component: 'Scene Analysis',
    reading: '',
    readingUnit: '',
    description: h.guidance?.problem ?? '',
    reason: h.guidance?.reason ?? '',
    whyItMatters: h.guidance?.why_it_matters ?? h.fallback_plan ?? '',
    tags: [h.risk_level, `${Math.round(h.confidence * 100)}% confidence`],
    boundingBox: { top: '0', left: '0', width: '0', height: '0' },
    actions,
  };
}

interface WorkflowStore {
  workflowState: WorkflowState;
  manualScanTick: number;

  // V2.1: full multi-hazard list (SceneHazard[]) + selected hazard
  allSceneHazards: SceneHazard[];
  selectedHazardId: string | null;

  // Legacy Hazard[] shape used by existing UI components
  detectedHazards: Hazard[];
  selectedHazard: Hazard | null;

  completedStepIds: Set<string>;

  // Guidance & Spatial
  activeStepId: string | null;
  guidance: any | null;
  spatialTargets: SpatialTarget[];
  generalSolutions: string[];

  // Camera
  cameraRef: any | null;
  facing: FacingMode;
  torchEnabled: boolean;
  isLandscape: boolean;

  // Sheet snap tracking (0=hidden/arrow, 1=peek, 2=full)
  sheetSnapIndex: number;

  // Actions
  setCameraRef: (ref: any | null) => void;
  triggerManualScan: () => void;
  startAnalysis: () => void;
  onHazardsDiscovered: (sceneHazards: SceneHazard[], defaultSelectedId?: string) => void;
  selectHazardById: (id: string) => void;
  focusHazard: (hazard: Hazard) => void;   // legacy compat
  openSheet: () => void;
  reset: () => void;
  toggleStep: (id: string) => void;
  setActiveStep: (id: string | null) => void;
  setSpatialData: (guidance: any, spatialTargets: SpatialTarget[], generalSolutions?: string[]) => void;
  toggleFacing: () => void;
  toggleTorch: () => void;
  setLandscape: (v: boolean) => void;
  setSheetSnapIndex: (i: number) => void;
}

export const useWorkflowStore = create<WorkflowStore>((set, get) => ({
  workflowState: 'READY',
  manualScanTick: 0,
  allSceneHazards: [],
  selectedHazardId: null,
  detectedHazards: [],
  selectedHazard: null,
  completedStepIds: new Set(),
  activeStepId: null,
  guidance: null,
  spatialTargets: [],
  generalSolutions: [],
  cameraRef: null,
  facing: 'back',
  torchEnabled: false,
  isLandscape: false,
  sheetSnapIndex: -1,

  setCameraRef: (cameraRef) => set({ cameraRef }),
  triggerManualScan: () => set((state) => ({ manualScanTick: state.manualScanTick + 1 })),

  startAnalysis: () =>
    set({
      workflowState: 'ANALYZING',
      detectedHazards: [],
      allSceneHazards: [],
      selectedHazardId: null,
      selectedHazard: null,
      completedStepIds: new Set(),
      activeStepId: null,
      guidance: null,
      spatialTargets: [],
      generalSolutions: [],
      sheetSnapIndex: -1,
    }),

  // V2.1: receives the full SceneHazard[] array from the WebSocket handler.
  // Converts to legacy Hazard[] for existing components, selects the default hazard.
  onHazardsDiscovered: (sceneHazards, defaultSelectedId) => {
    const legacyHazards = sceneHazards.map(sceneHazardToHazard);
    const selectedId = defaultSelectedId ?? sceneHazards[0]?.id ?? null;
    const selectedLegacy = legacyHazards.find((h) => h.id === selectedId) ?? legacyHazards[0] ?? null;

    set({
      allSceneHazards: sceneHazards,
      detectedHazards: legacyHazards,
      selectedHazardId: selectedId,
      selectedHazard: selectedLegacy,
      workflowState: 'HAZARDS_DISCOVERED',
      completedStepIds: new Set(),
      activeStepId: null,
    });
  },

  // V2.1: user taps a hazard pill → switch focus to that hazard.
  selectHazardById: (id) => {
    const { allSceneHazards, detectedHazards } = get();
    const sceneHazard = allSceneHazards.find((h) => h.id === id);
    const legacyHazard = detectedHazards.find((h) => h.id === id);
    if (!sceneHazard || !legacyHazard) return;

    set({
      selectedHazardId: id,
      selectedHazard: legacyHazard,
      workflowState: 'HAZARD_FOCUSED',
      completedStepIds: new Set(),
      activeStepId: null,
      sheetSnapIndex: 1,
    });
  },

  // Legacy: keeps existing call sites working (HazardSheet, useWebSocket)
  focusHazard: (hazard) =>
    set({ selectedHazard: hazard, workflowState: 'HAZARD_FOCUSED', sheetSnapIndex: 1 }),

  openSheet: () => set({ workflowState: 'SHEET_OPEN', sheetSnapIndex: 2 }),

  reset: () =>
    set({
      workflowState: 'READY',
      allSceneHazards: [],
      selectedHazardId: null,
      detectedHazards: [],
      selectedHazard: null,
      completedStepIds: new Set(),
      activeStepId: null,
      guidance: null,
      spatialTargets: [],
      generalSolutions: [],
      sheetSnapIndex: -1,
    }),

  toggleStep: (id) => {
    const next = new Set(get().completedStepIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ completedStepIds: next });
  },

  setActiveStep: (id) => set({ activeStepId: id }),

  setSpatialData: (guidance, spatialTargets, generalSolutions = []) =>
    set({ guidance, spatialTargets, generalSolutions }),

  toggleFacing: () =>
    set((s) => ({ facing: s.facing === 'back' ? 'front' : 'back' })),

  toggleTorch: () =>
    set((s) => ({ torchEnabled: !s.torchEnabled })),

  setLandscape: (v) => set({ isLandscape: v }),

  setSheetSnapIndex: (i) => set({ sheetSnapIndex: i }),
}));
