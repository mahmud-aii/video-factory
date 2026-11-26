import type { SceneConfig } from '../types';

export type ScheduledScene = {
  scene: SceneConfig;
  index: number;
  from: number;
  durationInFrames: number;
};

/**
 * Distributes totalDurationInFrames proportionally across scenes by weight,
 * assigning any rounding remainder frames to the final scene so there are
 * zero black frames and exact frame coverage.
 */
export function computeSceneTimings(
  scenes: SceneConfig[],
  totalDurationInFrames: number
): ScheduledScene[] {
  if (!scenes.length || totalDurationInFrames <= 0) {
    return [];
  }

  const safeWeights = scenes.map((scene) =>
    typeof scene.weight === 'number' && Number.isFinite(scene.weight) && scene.weight > 0
      ? scene.weight
      : 1
  );

  const totalWeight = safeWeights.reduce((acc, w) => acc + w, 0);
  const scheduled: ScheduledScene[] = [];
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const isLast = i === scenes.length - 1;
    const remaining = Math.max(1, totalDurationInFrames - cursor);

    if (isLast) {
      scheduled.push({
        scene: scenes[i],
        index: i,
        from: cursor,
        durationInFrames: remaining,
      });
      cursor += remaining;
    } else {
      const remainingSceneCount = scenes.length - i - 1;
      const rawDuration = Math.floor((safeWeights[i] / totalWeight) * totalDurationInFrames);
      const maxAllowed = Math.max(1, totalDurationInFrames - cursor - remainingSceneCount);
      const durationInFrames = Math.max(1, Math.min(rawDuration, maxAllowed));

      scheduled.push({
        scene: scenes[i],
        index: i,
        from: cursor,
        durationInFrames,
      });
      cursor += durationInFrames;
    }
  }

  return scheduled;
}
