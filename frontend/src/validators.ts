import { SceneAnalysis } from './types';

export function validateSceneAnalysis(data: unknown): data is SceneAnalysis {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.primary_hazard === 'string' &&
    ['CRITICAL','HIGH','MEDIUM','LOW'].includes(d.risk_level as string) &&
    typeof d.summary === 'string' &&
    Array.isArray(d.spatial_targets) &&
    typeof d.fallback_plan === 'string' &&
    typeof d.confidence === 'number'
  );
}
