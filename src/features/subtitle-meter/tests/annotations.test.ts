import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";

vi.mock("../services/fileService", () => ({
  readTextFile: vi.fn(
    async () =>
      "1\n00:00:01,000 --> 00:00:03,000\n第一条\n\n2\n00:00:03,500 --> 00:00:06,000\n第二条",
  ),
}));
vi.mock("../repositories/projectRepository", () => ({
  projectRepository: {
    save: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
  },
}));
vi.mock("../services/exportService", () => ({ downloadSubtitles: vi.fn() }));
vi.mock("../services/annotationExportService", () => ({
  downloadAnnotations: vi.fn(),
}));

async function readyVm() {
  const vm = new SubtitleMeterViewModel();
  await vm.importFile(new File(["x"], "clip.srt"));
  return vm;
}

describe("review annotations in the view model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("anchors a new cue annotation to exact timecodes and records the opener", async () => {
    const vm = await readyVm();
    const cue = vm.state.project!.cues[0];
    await vm.addAnnotation({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "timing",
      body: "停留太短",
      actor: "审校甲",
    });
    const stored = vm.state.project!.annotations[0];
    expect(stored).toMatchObject({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "timing",
      status: "open",
      createdBy: "审校甲",
      cueId: cue.id,
      originIndex: cue.index,
    });
    expect(stored.history).toEqual([
      expect.objectContaining({ actor: "审校甲", to: "open" }),
    ]);
  });

  it("appends an audited entry on every status change", async () => {
    const vm = await readyVm();
    const cue = vm.state.project!.cues[1];
    await vm.addAnnotation({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "wording",
      body: "用词",
      actor: "审校甲",
    });
    const id = vm.state.project!.annotations[0].id;
    await vm.setAnnotationStatus(id, "in-progress", "编辑乙", "正在改");
    await vm.setAnnotationStatus(id, "resolved", "编辑乙");
    const annotation = vm.state.project!.annotations[0];
    expect(annotation.status).toBe("resolved");
    expect(annotation.history).toHaveLength(3);
    expect(annotation.history[1]).toMatchObject({
      actor: "编辑乙",
      from: "open",
      to: "in-progress",
      note: "正在改",
    });
    expect(annotation.history[2]).toMatchObject({
      actor: "编辑乙",
      from: "in-progress",
      to: "resolved",
    });
    for (const event of annotation.history)
      expect(typeof event.at).toBe("number");
  });

  it("defaults an empty actor name to anonymous reviewer", async () => {
    const vm = await readyVm();
    const cue = vm.state.project!.cues[0];
    await vm.addAnnotation({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "other",
      body: "问题",
      actor: "   ",
    });
    expect(vm.state.project!.annotations[0].createdBy).toBe("匿名审校");
  });

  it("changes category without touching the audit history", async () => {
    const vm = await readyVm();
    const cue = vm.state.project!.cues[0];
    await vm.addAnnotation({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "wording",
      body: "问题",
      actor: "甲",
    });
    const id = vm.state.project!.annotations[0].id;
    await vm.setAnnotationCategory(id, "terminology");
    const annotation = vm.state.project!.annotations[0];
    expect(annotation.category).toBe("terminology");
    expect(annotation.history).toHaveLength(1);
  });

  it("deletes an annotation", async () => {
    const vm = await readyVm();
    await vm.addAnnotation({
      scope: "range",
      startMs: 0,
      endMs: 6000,
      category: "style",
      body: "整段语气",
      actor: "甲",
    });
    const id = vm.state.project!.annotations[0].id;
    await vm.deleteAnnotation(id);
    expect(vm.state.project!.annotations).toEqual([]);
  });

  it("rejects empty bodies and inverted ranges", async () => {
    const vm = await readyVm();
    await expect(
      vm.addAnnotation({
        scope: "range",
        startMs: 0,
        endMs: 1000,
        category: "other",
        body: "  ",
        actor: "甲",
      }),
    ).rejects.toThrow("批注内容");
    await expect(
      vm.addAnnotation({
        scope: "range",
        startMs: 5000,
        endMs: 1000,
        category: "other",
        body: "倒序区间",
        actor: "甲",
      }),
    ).rejects.toThrow("结束时间");
  });

  it("keeps annotations attached through snapshot restore by timecode", async () => {
    const vm = await readyVm();
    const cue = vm.state.project!.cues[0];
    await vm.saveVersion();
    await vm.addAnnotation({
      scope: "cue",
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "wording",
      body: "先批注",
      actor: "甲",
    });
    await vm.editCue(cue.id, { startMs: 9000, endMs: 11000 });
    expect(vm.state.project!.annotations[0].startMs).toBe(1000);
    // 旧快照里第一条还在原位；恢复后批注应按时间码重新命中
    await vm.restoreVersion(vm.state.project!.versions[0].id);
    const restoredCue = vm.state.project!.cues[0];
    expect(restoredCue.startMs).toBe(1000);
    expect(vm.state.project!.annotations).toHaveLength(1);
    expect(vm.state.project!.annotations[0].startMs).toBe(restoredCue.startMs);
  });
});
