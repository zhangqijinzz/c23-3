import type { ReviewAnnotation, SubtitleCue } from "../models";

export interface ResolvedAnnotation {
  annotation: ReviewAnnotation;
  cues: SubtitleCue[];
  orphan: boolean;
}

/**
 * 批注锚定在时间码上：
 * - 单条批注仅在时间码与当前某条字幕完全一致时才附着；条目被挪动或快照
 *   回退后时间码对不上时标记为「未锚定」，绝不按序号或邻近位置串到别的条目。
 * - 区间批注按时间重叠动态计算覆盖到的条目，对不上任何条目时同样视为未锚定。
 */
export function resolveAnnotations(
  cues: SubtitleCue[],
  annotations: ReviewAnnotation[],
): ResolvedAnnotation[] {
  return annotations
    .map((annotation) => {
      const overlaps = cues.filter(
        (cue) =>
          cue.startMs < annotation.endMs && annotation.startMs < cue.endMs,
      );
      let matched: SubtitleCue[];
      if (annotation.scope === "cue") {
        const exact = overlaps.find(
          (cue) =>
            cue.startMs === annotation.startMs &&
            cue.endMs === annotation.endMs,
        );
        matched = exact ? [exact] : [];
      } else {
        matched = overlaps;
      }
      return { annotation, cues: matched, orphan: matched.length === 0 };
    })
    .sort(
      (a, b) =>
        a.annotation.startMs - b.annotation.startMs ||
        b.annotation.createdAt - a.annotation.createdAt,
    );
}

export function openAnnotationCount(annotations: ReviewAnnotation[]): number {
  return annotations.filter((annotation) => annotation.status === "open")
    .length;
}
