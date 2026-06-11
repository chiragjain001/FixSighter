import { create } from 'zustand';
import { SceneAnalysis, SpatialTarget, AppState } from '../src/types';

interface SceneState {
  // SRS §11.2 fields
  primary_hazard: string | null;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | null;
  summary: string | null;
  spatial_targets: SpatialTarget[];
  fallback_plan: string | null;
  confidence: number;
  original_bbox: number[] | null;

  // Fallback UI state
  fallbackMode: boolean;

  // Analysis status logic
  analysisStatus: 'idle' | 'analyzing' | 'success' | 'timeout' | 'error';
  analysisSentAt: number | null; // timestamp of last WS send

  // Legacy (preserve for workflowStore compatibility)
  capsuleState: AppState;
  activeHazards: any[]; // Kept for backwards compatibility if needed
  arOverlays: any[];    // Kept for backwards compatibility if needed
  overallRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // Actions
  setSceneAnalysis: (data: SceneAnalysis, bbox: number[]) => void;
  markAnalysisSent: () => void;
  triggerFallbackMode: () => void;
  reset: () => void;
  setCapsuleState: (state: AppState) => void;
  setSceneData: (hazards: any[], overlays: any[], risk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  primary_hazard: null,
  risk_level: null,
  summary: null,
  spatial_targets: [],
  fallback_plan: null,
  confidence: 0,
  original_bbox: null,
  fallbackMode: false,
  
  analysisStatus: 'idle',
  analysisSentAt: null,

  capsuleState: 'ready',
  activeHazards: [],
  arOverlays: [],
  overallRisk: 'LOW',

  setSceneAnalysis: (data, bbox) => set({
    primary_hazard: data.primary_hazard,
    risk_level: data.risk_level,
    summary: data.summary,
    spatial_targets: data.spatial_targets,
    fallback_plan: data.fallback_plan,
    confidence: data.confidence,
    original_bbox: bbox,
    analysisStatus: 'success',
    fallbackMode: false,
    capsuleState: data.risk_level === 'CRITICAL' || data.risk_level === 'HIGH' ? 'critical' : 'guidance',
    overallRisk: data.risk_level
  }),

  markAnalysisSent: () => set({ 
    analysisStatus: 'analyzing', 
    analysisSentAt: Date.now() 
  }),

  triggerFallbackMode: () => set({ fallbackMode: true }),

  reset: () => set({
    primary_hazard: null,
    risk_level: null,
    summary: null,
    spatial_targets: [],
    fallback_plan: null,
    confidence: 0,
    original_bbox: null,
    fallbackMode: false,
    analysisStatus: 'idle',
    analysisSentAt: null,
    capsuleState: 'ready',
    activeHazards: [],
    arOverlays: [],
    overallRisk: 'LOW'
  }),

  setCapsuleState: (capsuleState) => set({ capsuleState }),
  setSceneData: (activeHazards, arOverlays, overallRisk) => set({ activeHazards, arOverlays, overallRisk }),
}));
