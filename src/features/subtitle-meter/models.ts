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
export type AnnotationScope = "cue" | "range";
export type AnnotationCategory =
  | "timing"
  | "wording"
  | "punctuation"
  | "terminology"
  | "translation"
  | "style"
  | "other";
export type AnnotationStatus = "open" | "in-progress" | "resolved" | "wont-fix";
export interface AnnotationEvent {
  at: number;
  actor: string;
  from?: AnnotationStatus;
  to: AnnotationStatus;
  note?: string;
}
export interface ReviewAnnotation {
  id: string;
  scope: AnnotationScope;
  startMs: number;
  endMs: number;
  category: AnnotationCategory;
  body: string;
  status: AnnotationStatus;
  createdBy: string;
  createdAt: number;
  history: AnnotationEvent[];
  cueId?: string;
  originIndex?: number;
}
export interface SubtitleProject {
  id: string;
  name: string;
  format: Format;
  cues: SubtitleCue[];
  updatedAt: number;
  versions: Array<{
    id: string;
    label: string;
    savedAt: number;
    cues: SubtitleCue[];
  }>;
  annotations: ReviewAnnotation[];
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
