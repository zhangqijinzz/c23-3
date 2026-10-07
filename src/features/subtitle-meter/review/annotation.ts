import type {
  AnnotationCategory,
  AnnotationHistoryEntry,
  AnnotationStatus,
  ReviewAnnotation,
  SubtitleCue,
} from "../models";
import { formatTimestamp } from "../parsers/timecode";

export const ANNOTATION_CATEGORY_LABELS: Record<AnnotationCategory, string> = {
  text: "文字差错",
  timing: "时间码",
  translation: "翻译措辞",
  punctuation: "标点格式",
  terminology: "术语统一",
  other: "其他",
};

export const ANNOTATION_STATUS_LABELS: Record<AnnotationStatus, string> = {
  open: "待处理",
  progress: "处理中",
  resolved: "已处理",
  wontfix: "无需处理",
};

/** 与批注时间区间重叠的条目，按开始时间排序；挪动条目后以时间码重新锚定。 */
export function cuesOverlapping(
  cues: SubtitleCue[],
  startMs: number,
  endMs: number,
): SubtitleCue[] {
  const lo = Math.min(startMs, endMs),
    hi = Math.max(startMs, endMs);
  return cues
    .filter((cue) => cue.startMs < hi && cue.endMs > lo)
    .sort((a, b) => a.startMs - b.startMs);
}

export interface AnnotationFilter {
  status: AnnotationStatus | "all";
  category: AnnotationCategory | "all";
}

export function filterAnnotations(
  annotations: ReviewAnnotation[],
  filter: AnnotationFilter,
): ReviewAnnotation[] {
  return [...annotations]
    .filter(
      (annotation) =>
        (filter.status === "all" || annotation.status === filter.status) &&
        (filter.category === "all" || annotation.category === filter.category),
    )
    .sort((a, b) => a.startMs - b.startMs || a.createdAt - b.createdAt);
}

export function formatDateTime(ms: number): string {
  const date = new Date(ms),
    pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function describeHistory(entry: AnnotationHistoryEntry): string {
  if (entry.kind === "create") return "提出批注";
  return `${
    ANNOTATION_STATUS_LABELS[entry.from ?? "open"]
  } → ${entry.to ? ANNOTATION_STATUS_LABELS[entry.to] : ""}`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 交付前核对用的批注清单（UTF-8 BOM，Excel 可直接打开）。 */
export function buildAnnotationReport(
  annotations: ReviewAnnotation[],
  cues: SubtitleCue[],
): string {
  const header = [
    "编号",
    "开始时间码",
    "结束时间码",
    "锚定条目",
    "类别",
    "状态",
    "批注内容",
    "提出人",
    "提出时间",
    "状态轨迹",
  ];
  const rows = [...annotations]
    .sort((a, b) => a.startMs - b.startMs || a.createdAt - b.createdAt)
    .map((annotation, index) => {
      const anchored = cuesOverlapping(
        cues,
        annotation.startMs,
        annotation.endMs,
      )
        .map((cue) => `#${cue.index}`)
        .join(" ");
      const trail = annotation.history
        .map(
          (entry) =>
            `${formatDateTime(entry.at)} ${entry.by}：${describeHistory(
              entry,
            )}`,
        )
        .join(" / ");
      return [
        String(index + 1),
        formatTimestamp(annotation.startMs, "srt"),
        formatTimestamp(annotation.endMs, "srt"),
        anchored || "（无匹配条目）",
        ANNOTATION_CATEGORY_LABELS[annotation.category],
        ANNOTATION_STATUS_LABELS[annotation.status],
        annotation.body,
        annotation.createdBy,
        formatDateTime(annotation.createdAt),
        trail,
      ]
        .map(csvCell)
        .join(",");
    });
  return `\uFEFF${[header.join(","), ...rows].join("\n")}\n`;
}
