import type { ReviewAnnotation, SubtitleCue } from "../models";
import { formatAnnotationsCsv } from "../formatters/annotationFormatter";

export function downloadAnnotations(
  name: string,
  annotations: ReviewAnnotation[],
  cues: SubtitleCue[],
): void {
  const bom = "﻿";
  const blob = new Blob([bom + formatAnnotationsCsv(annotations, cues)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/\.(srt|vtt)$/i, "")}-annotations.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
