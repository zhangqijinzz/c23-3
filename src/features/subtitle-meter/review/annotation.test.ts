import { describe, expect, it } from "vitest";
import type { ReviewAnnotation, SubtitleCue } from "../models";
import {
  buildAnnotationReport,
  cuesOverlapping,
  filterAnnotations,
} from "./annotation";

const cues: SubtitleCue[] = [
  { id: "cue-1", index: 1, startMs: 1000, endMs: 3000, text: "一" },
  { id: "cue-2", index: 2, startMs: 3750, endMs: 6200, text: "二" },
  { id: "cue-3", index: 3, startMs: 6350, endMs: 8900, text: "三" },
];

const makeAnnotation = (
  patch: Partial<ReviewAnnotation> = {},
): ReviewAnnotation => ({
  id: "ann-1",
  startMs: 1000,
  endMs: 3000,
  category: "text",
  status: "open",
  body: "错字",
  createdAt: 100,
  createdBy: "审校甲",
  history: [{ at: 100, by: "审校甲", kind: "create" }],
  ...patch,
});

describe("annotation timecode anchoring", () => {
  it("matches cues by overlapping time ranges instead of index", () => {
    expect(cuesOverlapping(cues, 1000, 3000).map((cue) => cue.id)).toEqual([
      "cue-1",
    ]);
    // 跨条目的时间区间批注同时锚定两条
    expect(cuesOverlapping(cues, 2500, 5000).map((cue) => cue.index)).toEqual([
      1, 2,
    ]);
  });

  it("does not follow a cue after it is moved away from the anchor", () => {
    // cue-1 被整体挪到 20s 以后：原时间码处不应再锚定到任何条目
    const moved = cues.map((cue) =>
      cue.id === "cue-1" ? { ...cue, startMs: 20000, endMs: 22000 } : cue,
    );
    expect(cuesOverlapping(moved, 1000, 3000)).toEqual([]);
    // 挪走的条目按其新位置被同一时间区间之外的其它规则找到（不会串条目）
    expect(cuesOverlapping(moved, 20000, 22000).map((cue) => cue.id)).toEqual([
      "cue-1",
    ]);
  });

  it("re-anchors by timecode after a snapshot restore that changes indices", () => {
    // 快照回退后顺序/序号变了，时间码仍在 3.75~6.2s 的内容应锚到新序列
    const restored: SubtitleCue[] = [
      {
        id: "old-9",
        index: 1,
        startMs: 3750,
        endMs: 6200,
        text: "二（已成为第1条）",
      },
      {
        id: "old-1",
        index: 2,
        startMs: 1000,
        endMs: 3000,
        text: "一（变成第2条）",
      },
    ];
    const hit = cuesOverlapping(restored, 1000, 3000);
    expect(hit).toHaveLength(1);
    expect(hit[0].index).toBe(2);
  });
});

describe("filterAnnotations", () => {
  it("filters by status and category, sorted by anchor time", () => {
    const annotations = [
      makeAnnotation({ id: "a", startMs: 6000, status: "resolved" }),
      makeAnnotation({
        id: "b",
        startMs: 1000,
        category: "timing",
      }),
      makeAnnotation({ id: "c", startMs: 3000, status: "progress" }),
    ];
    expect(
      filterAnnotations(annotations, { status: "all", category: "all" }).map(
        (a) => a.id,
      ),
    ).toEqual(["b", "c", "a"]);
    expect(
      filterAnnotations(annotations, { status: "open", category: "all" }).map(
        (a) => a.id,
      ),
    ).toEqual(["b"]);
    expect(
      filterAnnotations(annotations, { status: "all", category: "timing" }).map(
        (a) => a.id,
      ),
    ).toEqual(["b"]);
  });
});

describe("buildAnnotationReport", () => {
  it("renders anchored indices and the status trail for delivery review", () => {
    const annotation = makeAnnotation({
      startMs: 2500,
      endMs: 5000,
      status: "resolved",
      history: [
        { at: 100, by: "审校甲", kind: "create" },
        {
          at: 200,
          by: "审校乙",
          kind: "status",
          from: "open",
          to: "progress",
        },
        {
          at: 300,
          by: "审校乙",
          kind: "status",
          from: "progress",
          to: "resolved",
        },
      ],
    });
    const csv = buildAnnotationReport([annotation], cues);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("00:00:02,500");
    expect(csv).toContain("#1 #2");
    expect(csv).toContain("文字差错");
    expect(csv).toContain("已处理");
    expect(csv).toContain("待处理 → 处理中");
    expect(csv).toContain("处理中 → 已处理");
  });

  it("marks annotations whose anchor no longer covers any cue", () => {
    const moved = cues.map((cue) =>
      cue.id === "cue-1" ? { ...cue, startMs: 20000, endMs: 22000 } : cue,
    );
    const csv = buildAnnotationReport([makeAnnotation()], moved);
    expect(csv).toContain("（无匹配条目）");
  });
});
