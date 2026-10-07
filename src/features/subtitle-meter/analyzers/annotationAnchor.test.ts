import { describe, expect, it } from "vitest";
import { openAnnotationCount, resolveAnnotations } from "./annotationAnchor";
import type { ReviewAnnotation, SubtitleCue } from "../models";

const cues: SubtitleCue[] = [
  { id: "cue-1", index: 1, startMs: 1000, endMs: 3000, text: "一" },
  { id: "cue-2", index: 2, startMs: 3500, endMs: 6000, text: "二" },
  { id: "cue-3", index: 3, startMs: 6500, endMs: 9000, text: "三" },
];

const cueAnnotation = (
  override: Partial<ReviewAnnotation> = {},
): ReviewAnnotation => ({
  id: "ann-1",
  scope: "cue",
  startMs: 1000,
  endMs: 3000,
  category: "wording",
  body: "有错别字",
  status: "open",
  createdBy: "审校甲",
  createdAt: 10,
  history: [{ at: 10, actor: "审校甲", to: "open" }],
  cueId: "cue-1",
  originIndex: 1,
  ...override,
});

describe("annotation anchoring", () => {
  it("attaches a cue annotation only on exact timecode match", () => {
    const resolved = resolveAnnotations(cues, [cueAnnotation()]);
    expect(resolved[0].cues.map((cue) => cue.id)).toEqual(["cue-1"]);
    expect(resolved[0].orphan).toBe(false);
  });

  it("orphans a cue annotation when the cue moves instead of drifting to a neighbour", () => {
    // 原第 1 条被拖到更晚的位置；第 2 条仍在原处，批注不得串到第 2 条
    const moved: SubtitleCue[] = [
      { ...cues[1] },
      { ...cues[2] },
      { ...cues[0], startMs: 9500, endMs: 11500 },
    ];
    const resolved = resolveAnnotations(moved, [cueAnnotation()]);
    expect(resolved[0].orphan).toBe(true);
    expect(resolved[0].cues).toEqual([]);
  });

  it("does not attach to a merely overlapping cue", () => {
    // 时间码只重叠而非完全一致，视为未锚定
    const shifted: SubtitleCue[] = [
      { ...cues[0], startMs: 1100, endMs: 3100 },
      ...cues.slice(1),
    ];
    const resolved = resolveAnnotations(shifted, [cueAnnotation()]);
    expect(resolved[0].orphan).toBe(true);
  });

  it("reattaches by timecode after a snapshot restore brings the cue back", () => {
    const moved: SubtitleCue[] = [
      { ...cues[1] },
      { ...cues[0], startMs: 9500, endMs: 11500 },
    ];
    expect(resolveAnnotations(moved, [cueAnnotation()])[0].orphan).toBe(true);
    // 快照回退，字幕时间码恢复
    const restored = resolveAnnotations(cues, [cueAnnotation()]);
    expect(restored[0].orphan).toBe(false);
    expect(restored[0].cues[0]?.id).toBe("cue-1");
  });

  it("resolves a range annotation to every cue it overlaps", () => {
    const range = cueAnnotation({
      id: "ann-2",
      scope: "range",
      startMs: 2000,
      endMs: 7000,
      cueId: undefined,
      originIndex: undefined,
    });
    const resolved = resolveAnnotations(cues, [range]);
    expect(resolved[0].cues.map((cue) => cue.index)).toEqual([1, 2, 3]);
    expect(resolved[0].orphan).toBe(false);
  });

  it("orphans a range covering no cue after edits", () => {
    const range = cueAnnotation({
      id: "ann-3",
      scope: "range",
      startMs: 20000,
      endMs: 30000,
    });
    expect(resolveAnnotations(cues, [range])[0].orphan).toBe(true);
  });

  it("counts only open annotations as pending", () => {
    expect(
      openAnnotationCount([
        cueAnnotation({ id: "a", status: "open" }),
        cueAnnotation({ id: "b", status: "in-progress" }),
        cueAnnotation({ id: "c", status: "resolved" }),
        cueAnnotation({ id: "d", status: "wont-fix" }),
      ]),
    ).toBe(1);
  });
});
