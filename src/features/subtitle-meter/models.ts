export type Format = "srt" | "vtt";
export interface SubtitleCue {
  id: string;
  index: number;
  startMs: number;
  endMs: number;
  text: string;
}
export type IssueType =
  | "overlap"
  | "too-short"
  | "too-fast"
  | "too-long"
  | "empty"
  | "invalid-time";
export interface SubtitleIssue {
  id: string;
  cueId: string;
  type: IssueType;
  severity: "info" | "warning" | "error";
  message: string;
}
export type AnnotationCategory =
  | "text"
  | "timing"
  | "translation"
  | "punctuation"
  | "terminology"
  | "other";
export type AnnotationStatus = "open" | "progress" | "resolved" | "wontfix";
export interface AnnotationHistoryEntry {
  at: number;
  by: string;
  kind: "create" | "status";
  from?: AnnotationStatus;
  to?: AnnotationStatus;
}
export interface ReviewAnnotation {
  id: string;
  startMs: number;
  endMs: number;
  category: AnnotationCategory;
  status: AnnotationStatus;
  body: string;
  createdAt: number;
  createdBy: string;
  history: AnnotationHistoryEntry[];
}
export interface SubtitleProject {
  id: string;
  name: string;
  format: Format;
  cues: SubtitleCue[];
  annotations: ReviewAnnotation[];
  updatedAt: number;
  versions: Array<{
    id: string;
    label: string;
    savedAt: number;
    cues: SubtitleCue[];
  }>;
}
export interface MeterState {
  phase: "empty" | "importing" | "ready" | "editing" | "exporting" | "error";
  project: SubtitleProject | null;
  issues: SubtitleIssue[];
  selectedId: string | null;
  notice: string;
  zoom: number;
}
export const emptyState = (): MeterState => ({
  phase: "empty",
  project: null,
  issues: [],
  selectedId: null,
  notice: "",
  zoom: 1,
});
