import { describe, expect, it } from "vitest";
import { formatAnnotationsCsv, formatCsvCell } from "./annotationFormatter";
import type { ReviewAnnotation, SubtitleCue } from "../models";

const cues: SubtitleCue[] = [
  { id: "cue-1", index: 1, startMs: 1000, endMs: 3000, text: "一" },
];

const annotation: ReviewAnnotation = {
  id: "ann-1",
  scope: "cue",
  startMs: 1000,
  endMs: 3000,
  category: "wording",
  body: "有错别字",
  status: "in-progress",
  createdBy: "审校甲",
  createdAt: Date.parse("2026-10-07T09:00:00Z"),
  history: [
    {
      at: Date.parse("2026-10-07T09:00:00Z"),
      actor: "审校甲",
      to: "open",
    },
    {
      at: Date.parse("2026-10-07T10:30:00Z"),
      actor: "编辑乙",
      from: "open",
      to: "in-progress",
      note: "已定位",
    },
  ],
  cueId: "cue-1",
  originIndex: 1,
};

describe("annotation CSV export", () => {
  it("escapes cells containing commas, quotes, and newlines", () => {
    expect(formatCsvCell("plain")).toBe("plain");
    expect(formatCsvCell("a,b")).toBe('"a,b"');
    expect(formatCsvCell('he said "hi"')).toBe('"he said ""hi"""');
    expect(formatCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("renders anchors, category, status, and the audit trail", () => {
    const csv = formatAnnotationsCsv([annotation], cues);
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("批注编号");
    expect(lines[0]).toContain("状态变化记录");
    expect(lines[1]).toContain("ann-1");
    expect(lines[1]).toContain("单条字幕");
    expect(lines[1]).toContain("00:00:01,000");
    expect(lines[1]).toContain("文字错漏");
    expect(lines[1]).toContain("处理中");
    expect(lines[1]).toContain("#1");
    expect(lines[1]).toContain("审校甲：提出（待处理）");
    expect(lines[1]).toContain("编辑乙：待处理 → 处理中（已定位）");
  });

  it("flags orphaned cue annotations with their original index", () => {
    const moved: SubtitleCue[] = [
      { id: "cue-9", index: 9, startMs: 9000, endMs: 11000, text: "挪走" },
    ];
    const csv = formatAnnotationsCsv([annotation], moved);
    expect(csv).toContain("未锚定");
    expect(csv).toContain("原第 1 条（时间码已不匹配）");
  });
});
