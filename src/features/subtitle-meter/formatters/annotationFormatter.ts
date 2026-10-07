import type { ReviewAnnotation, SubtitleCue } from "../models";
import { formatTimestamp } from "../parsers/timecode";
import { resolveAnnotations } from "../analyzers/annotationAnchor";
import { CATEGORY_LABELS, STATUS_LABELS } from "../annotationMeta";

export function formatCsvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatDateTime(ms: number): string {
  const date = new Date(ms),
    pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatHistory(annotation: ReviewAnnotation): string {
  return annotation.history
    .map(
      (event) =>
        `${formatDateTime(event.at)} ${event.actor}：${
          event.from
            ? `${STATUS_LABELS[event.from]} → ${STATUS_LABELS[event.to]}`
            : `提出（${STATUS_LABELS[event.to]}）`
        }${event.note ? `（${event.note}）` : ""}`,
    )
    .join("；");
}

export function formatAnnotationsCsv(
  annotations: ReviewAnnotation[],
  cues: SubtitleCue[],
): string {
  const header = [
    "批注编号",
    "锚定方式",
    "开始时间码",
    "结束时间码",
    "问题类别",
    "批注内容",
    "当前状态",
    "提出人",
    "提出时间",
    "最后处理人",
    "关联字幕序号",
    "锚定情况",
    "状态变化记录",
  ];
  const resolved = resolveAnnotations(cues, annotations);
  const rows = resolved.map(({ annotation, cues: matched, orphan }) => [
    annotation.id,
    annotation.scope === "cue" ? "单条字幕" : "时间区间",
    formatTimestamp(annotation.startMs, "srt"),
    formatTimestamp(annotation.endMs, "srt"),
    CATEGORY_LABELS[annotation.category],
    annotation.body,
    STATUS_LABELS[annotation.status],
    annotation.createdBy,
    formatDateTime(annotation.createdAt),
    annotation.history.at(-1)?.actor ?? annotation.createdBy,
    orphan
      ? `原第 ${annotation.originIndex ?? "-"} 条（时间码已不匹配）`
      : matched.map((cue) => `#${cue.index}`).join(" "),
    orphan ? "未锚定" : "正常",
    formatHistory(annotation),
  ]);
  return [header, ...rows]
    .map((row) => row.map(formatCsvCell).join(","))
    .join("\r\n");
}
