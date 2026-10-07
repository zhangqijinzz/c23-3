import { detectIssues } from "../analyzers/issueDetector";
import { formatSubtitles } from "../formatters/subtitleFormatter";
import {
  emptyState,
  type AnnotationCategory,
  type AnnotationEvent,
  type AnnotationScope,
  type AnnotationStatus,
  type Format,
  type MeterState,
  type ReviewAnnotation,
  type SubtitleCue,
  type SubtitleProject,
} from "../models";
import { STATUS_ORDER } from "../annotationMeta";
import { detectFormat, parseSubtitles } from "../parsers/subtitleParser";
import { projectRepository } from "../repositories/projectRepository";
import { downloadSubtitles } from "../services/exportService";
import { downloadAnnotations } from "../services/annotationExportService";
import { readTextFile } from "../services/fileService";

export interface NewAnnotationInput {
  scope: AnnotationScope;
  startMs: number;
  endMs: number;
  category: AnnotationCategory;
  body: string;
  actor: string;
}
export class SubtitleMeterViewModel {
  state: MeterState = emptyState();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSnapshot = () => this.state;
  private publish(patch: Partial<MeterState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
  private async commit(
    project: SubtitleProject,
    phase: MeterState["phase"] = "editing",
  ) {
    project.updatedAt = Date.now();
    const issues = detectIssues(project.cues);
    this.publish({ project, issues, phase, notice: "" });
    try {
      await projectRepository.save(project);
    } catch {
      if (this.state.project?.updatedAt === project.updatedAt) {
        this.publish({
          phase: "error",
          notice: "本地保存失败；当前修改仍保留在页面中，请导出备份",
        });
      }
    }
  }
  async restore() {
    try {
      const project = await projectRepository.load();
      if (project)
        this.publish({
          project,
          issues: detectIssues(project.cues),
          phase: "ready",
          selectedId: project.cues[0]?.id ?? null,
          notice: "已恢复上次编辑",
        });
    } catch {
      this.publish({ notice: "本地项目暂时无法读取，可继续导入字幕文件" });
    }
  }
  async importFile(file: File) {
    this.publish({ phase: "importing", notice: "正在读取并解析字幕文件…" });
    try {
      const format = detectFormat(file.name),
        text = await readTextFile(file),
        cues = parseSubtitles(text, format);
      const project: SubtitleProject = {
        id: "subtitle-meter.current.v1",
        name: file.name,
        format,
        cues,
        updatedAt: Date.now(),
        versions: [],
        annotations: [],
      };
      this.publish({
        selectedId: cues[0].id,
        notice: `已解析 ${cues.length} 条字幕`,
      });
      await this.commit(project, "ready");
    } catch (error) {
      this.publish({
        phase: "error",
        notice:
          error instanceof Error ? error.message : "导入失败，请检查文件后重试",
      });
    }
  }
  selectCue(id: string) {
    this.publish({ selectedId: id });
  }
  setZoom(zoom: number) {
    this.publish({ zoom });
  }
  async editCue(
    id: string,
    patch: Partial<Pick<SubtitleCue, "text" | "startMs" | "endMs">>,
  ) {
    if (!this.state.project) return;
    const cues = this.state.project.cues.map((cue) =>
      cue.id === id ? { ...cue, ...patch } : cue,
    );
    await this.commit({ ...this.state.project, cues });
  }
  async saveVersion() {
    const project = this.state.project;
    if (!project) return;
    const versions = [
      ...project.versions,
      {
        id: `v-${Date.now()}`,
        label: `快照 ${project.versions.length + 1}`,
        savedAt: Date.now(),
        cues: structuredClone(project.cues),
      },
    ];
    await this.commit({ ...project, versions });
    this.publish({ notice: "已保存版本快照" });
  }
  async restoreVersion(id: string) {
    const project = this.state.project,
      version = project?.versions.find((item) => item.id === id);
    if (!project || !version) return;
    await this.commit({ ...project, cues: structuredClone(version.cues) });
    this.publish({ notice: `已恢复${version.label}，批注仍按时间码锚定` });
  }
  private requireProject(): SubtitleProject | null {
    return this.state.project;
  }
  async addAnnotation(input: NewAnnotationInput) {
    const project = this.requireProject();
    if (!project) return;
    const body = input.body.trim();
    if (!body) throw new Error("请先填写批注内容");
    if (!Number.isFinite(input.startMs) || !Number.isFinite(input.endMs))
      throw new Error("批注的时间码无效");
    if (input.startMs < 0 || input.endMs <= input.startMs)
      throw new Error("批注区间的结束时间必须晚于开始时间");
    const actor = input.actor.trim() || "匿名审校";
    const cue =
      input.scope === "cue"
        ? project.cues.find(
            (item) =>
              item.startMs === input.startMs && item.endMs === input.endMs,
          )
        : undefined;
    const now = Date.now();
    const annotation: ReviewAnnotation = {
      id: `ann-${now}-${project.annotations.length + 1}`,
      scope: input.scope,
      startMs: Math.trunc(input.startMs),
      endMs: Math.trunc(input.endMs),
      category: input.category,
      body,
      status: "open",
      createdBy: actor,
      createdAt: now,
      history: [{ at: now, actor, to: "open" }],
      cueId: cue?.id,
      originIndex: cue?.index,
    };
    await this.commit({
      ...project,
      annotations: [...project.annotations, annotation],
    });
  }
  async setAnnotationStatus(
    id: string,
    status: AnnotationStatus,
    actor: string,
    note = "",
  ) {
    const project = this.requireProject();
    if (!project || !STATUS_ORDER.includes(status)) return;
    const current = project.annotations.find((item) => item.id === id);
    if (!current || current.status === status) return;
    const event: AnnotationEvent = {
      at: Date.now(),
      actor: actor.trim() || "匿名审校",
      from: current.status,
      to: status,
    };
    if (note.trim()) event.note = note.trim();
    await this.commit({
      ...project,
      annotations: project.annotations.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              history: [...item.history, event],
            }
          : item,
      ),
    });
  }
  async setAnnotationCategory(id: string, category: AnnotationCategory) {
    const project = this.requireProject();
    if (!project) return;
    const current = project.annotations.find((item) => item.id === id);
    if (!current || current.category === category) return;
    await this.commit({
      ...project,
      annotations: project.annotations.map((item) =>
        item.id === id ? { ...item, category } : item,
      ),
    });
  }
  async deleteAnnotation(id: string) {
    const project = this.requireProject();
    if (!project) return;
    await this.commit({
      ...project,
      annotations: project.annotations.filter((item) => item.id !== id),
    });
  }
  exportAnnotations() {
    const project = this.state.project;
    if (!project || project.annotations.length === 0) return;
    try {
      downloadAnnotations(project.name, project.annotations, project.cues);
      this.publish({ notice: "批注清单已导出" });
    } catch {
      this.publish({
        phase: "error",
        notice: "批注清单导出失败，请重试",
      });
    }
  }
  async exportFile() {
    const project = this.state.project;
    if (!project) return;
    this.publish({ phase: "exporting" });
    try {
      formatSubtitles(project.cues, project.format);
      downloadSubtitles(project.name, project.cues, project.format);
      this.publish({ phase: "ready", notice: "字幕文件已导出" });
    } catch {
      this.publish({
        phase: "error",
        notice: "导出失败，编辑内容已保留，请重试",
      });
    }
  }
  setFormat(format: Format) {
    const project = this.state.project;
    if (project) void this.commit({ ...project, format });
  }
}
export const createViewModel = () => new SubtitleMeterViewModel();
