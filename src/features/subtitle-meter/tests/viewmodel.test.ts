import { beforeEach, describe, expect, it, vi } from "vitest";
import { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import { readTextFile } from "../services/fileService";
import { downloadSubtitles } from "../services/exportService";
vi.mock("../services/fileService", () => ({
  readTextFile: vi.fn(
    async () => "1\n00:00:01,000 --> 00:00:03,000\nOriginal caption",
  ),
}));
vi.mock("../repositories/projectRepository", () => ({
  projectRepository: {
    save: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
  },
}));
vi.mock("../services/exportService", () => ({ downloadSubtitles: vi.fn() }));
describe("SubtitleMeterViewModel", () => {
  let vm: SubtitleMeterViewModel;
  beforeEach(() => {
    vm = new SubtitleMeterViewModel();
  });
  it("imports, edits, rechecks, snapshots, and exports", async () => {
    await vm.importFile(new File(["x"], "clip.srt"));
    expect(vm.state.phase).toBe("ready");
    const cue = vm.state.project!.cues[0];
    await vm.editCue(cue.id, { text: "Edited" });
    expect(vm.state.project!.cues[0].text).toBe("Edited");
    await vm.saveVersion();
    expect(vm.state.project!.versions).toHaveLength(1);
    await vm.exportFile();
    expect(vm.state.notice).toBe("字幕文件已导出");
  });
  it("keeps a recoverable error when an unsupported import is selected", async () => {
    await vm.importFile(new File(["x"], "clip.txt"));
    expect(vm.state.phase).toBe("error");
    expect(vm.state.notice).toContain("仅支持");
  });
  it("shows a parse failure as a recoverable import error", async () => {
    vi.mocked(readTextFile).mockResolvedValueOnce("not a subtitle block");
    await vm.importFile(new File(["x"], "clip.srt"));
    expect(vm.state.phase).toBe("error");
    expect(vm.state.notice).toContain("缺少时间码");
  });
  it("keeps editing visible immediately and reports export failures", async () => {
    await vm.importFile(new File(["x"], "clip.srt"));
    const cue = vm.state.project!.cues[0];
    const saving = vm.editCue(cue.id, { text: "Immediate edit" });
    expect(vm.state.project!.cues[0].text).toBe("Immediate edit");
    await saving;
    vi.mocked(downloadSubtitles).mockImplementationOnce(() => {
      throw new Error("download unavailable");
    });
    await vm.exportFile();
    expect(vm.state.phase).toBe("error");
    expect(vm.state.notice).toContain("导出失败");
    expect(vm.state.project!.cues[0].text).toBe("Immediate edit");
  });
  it("tracks review annotations with status history and clears them on re-import", async () => {
    await vm.importFile(new File(["x"], "clip.srt"));
    const cue = vm.state.project!.cues[0];
    await vm.addAnnotation({
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "timing",
      body: "建议提前 200ms",
      reviewer: "审校甲",
    });
    let annotation = vm.state.project!.annotations[0];
    expect(annotation.status).toBe("open");
    expect(annotation.createdBy).toBe("审校甲");
    await vm.setAnnotationStatus(annotation.id, "resolved", "校对乙");
    annotation = vm.state.project!.annotations[0];
    expect(annotation.status).toBe("resolved");
    expect(annotation.history).toHaveLength(2);
    expect(annotation.history[1]).toMatchObject({
      kind: "status",
      from: "open",
      to: "resolved",
      by: "校对乙",
    });
    // 空白内容或空时间区间不创建批注
    await vm.addAnnotation({
      startMs: 0,
      endMs: 0,
      category: "text",
      body: "  ",
      reviewer: "",
    });
    expect(vm.state.project!.annotations).toHaveLength(1);
    // 重新导入后批注全部清空，避免串到新项目的时间码上
    await vm.importFile(new File(["x"], "clip.srt"));
    expect(vm.state.project!.annotations).toEqual([]);
  });
  it("keeps annotations anchored when cues move or a snapshot is restored", async () => {
    await vm.importFile(new File(["x"], "clip.srt"));
    const cue = vm.state.project!.cues[0];
    await vm.addAnnotation({
      startMs: cue.startMs,
      endMs: cue.endMs,
      category: "text",
      body: "锚在时间码上",
      reviewer: "审校甲",
    });
    const annotation = vm.state.project!.annotations[0];
    await vm.saveVersion();
    // 条目被挪走，批注仍留在原时间码（且不引用条目序号）
    await vm.editCue(cue.id, {
      startMs: cue.startMs + 20000,
      endMs: cue.endMs + 20000,
    });
    const stored = vm.state.project!.annotations[0];
    expect(stored.id).toBe(annotation.id);
    expect(stored.startMs).toBe(cue.startMs);
    expect(stored).not.toHaveProperty("cueId");
    // 快照回退不影响批注本身，只改变其重新匹配结果
    await vm.restoreVersion(vm.state.project!.versions[0].id);
    expect(vm.state.project!.annotations[0].startMs).toBe(cue.startMs);
  });
});
