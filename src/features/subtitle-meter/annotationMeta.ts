import type { AnnotationCategory, AnnotationStatus } from "./models";

export const ANNOTATION_CATEGORIES: Array<{
  id: AnnotationCategory;
  label: string;
}> = [
  { id: "timing", label: "时间码" },
  { id: "wording", label: "文字错漏" },
  { id: "punctuation", label: "标点格式" },
  { id: "terminology", label: "术语统一" },
  { id: "translation", label: "翻译准确性" },
  { id: "style", label: "语气风格" },
  { id: "other", label: "其他" },
];
export const ANNOTATION_STATUSES: Array<{
  id: AnnotationStatus;
  label: string;
}> = [
  { id: "open", label: "待处理" },
  { id: "in-progress", label: "处理中" },
  { id: "resolved", label: "已解决" },
  { id: "wont-fix", label: "无需处理" },
];
export const STATUS_ORDER: AnnotationStatus[] = [
  "open",
  "in-progress",
  "resolved",
  "wont-fix",
];
export const CATEGORY_LABELS: Record<AnnotationCategory, string> =
  Object.fromEntries(
    ANNOTATION_CATEGORIES.map((item) => [item.id, item.label]),
  ) as Record<AnnotationCategory, string>;
export const STATUS_LABELS: Record<AnnotationStatus, string> =
  Object.fromEntries(
    ANNOTATION_STATUSES.map((item) => [item.id, item.label]),
  ) as Record<AnnotationStatus, string>;

const REVIEWER_KEY = "subtitle-meter.reviewer.v1";
export function getReviewer(): string {
  try {
    return localStorage.getItem(REVIEWER_KEY)?.trim() || "";
  } catch {
    return "";
  }
}
export function setReviewer(name: string): void {
  try {
    const trimmed = name.trim();
    if (trimmed) localStorage.setItem(REVIEWER_KEY, trimmed);
    else localStorage.removeItem(REVIEWER_KEY);
  } catch {
    /* 存储不可用时仅在本次会话中使用 */
  }
}
