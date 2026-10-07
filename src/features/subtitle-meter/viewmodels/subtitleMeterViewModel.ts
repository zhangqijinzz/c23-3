import { detectIssues } from "../analyzers/issueDetector";
import { formatSubtitles } from "../formatters/subtitleFormatter";
import {
  emptyState,
  type AnnotationCategory,
  type AnnotationStatus,
  type Format,
  type MeterState,
  type ReviewAnnotation,
  type SubtitleCue,
  type SubtitleProject,
} from "../models";
import { detectFormat, parseSubtitles } from "../parsers/subtitleParser";
import { projectRepository } from "../repositories/projectRepository";
import { buildAnnotationReport } from "../review/annotation";
import { downloadSubtitles } from "../services/exportService";
import { readTextFile } from "../services/fileService";
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
        annotations: [],
        updatedAt: Date.now(),
        versions: [],
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
    this.publish({ notice: `已恢复${version.label}` });
  }
  private async commitAnnotations(annotations: ReviewAnnotation[]) {
    const project = this.state.project;
    if (project)
      await this.commit({
        ...project,
        annotations: structuredClone(annotations),
      });
  }
  async addAnnotation(input: {
    startMs: number;
    endMs: number;
    category: AnnotationCategory;
    body: string;
    reviewer: string;
  }) {
    const project = this.state.project;
    if (!project) return;
    const body = input.body.trim(),
      by = input.reviewer.trim() || "匿名审校";
    if (!body || input.endMs <= input.startMs) return;
    const now = Date.now(),
      id = `ann-${now}-${project.annotations.length}`;
    const annotation: ReviewAnnotation = {
      id,
      startMs: input.startMs,
      endMs: input.endMs,
      category: input.category,
      status: "open",
      body,
      createdAt: now,
      createdBy: by,
      history: [{ at: now, by, kind: "create" }],
    };
    await this.commitAnnotations([...project.annotations, annotation]);
    this.publish({ notice: "已添加审校批注" });
  }
  async setAnnotationStatus(
    id: string,
    status: AnnotationStatus,
    reviewer: string,
  ) {
    const project = this.state.project;
    if (!project) return;
    const target = project.annotations.find((item) => item.id === id);
    if (!target || target.status === status) return;
    const by = reviewer.trim() || "匿名审校",
      now = Date.now();
    const annotations = project.annotations.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            history: [
              ...item.history,
              {
                at: now,
                by,
                kind: "status" as const,
                from: item.status,
                to: status,
              },
            ],
          }
        : item,
    );
    await this.commitAnnotations(annotations);
  }
  async deleteAnnotation(id: string) {
    const project = this.state.project;
    if (!project) return;
    await this.commitAnnotations(
      project.annotations.filter((item) => item.id !== id),
    );
    this.publish({ notice: "批注已删除" });
  }
  exportAnnotations() {
    const project = this.state.project;
    if (!project || project.annotations.length === 0) return;
    try {
      const csv = buildAnnotationReport(project.annotations, project.cues);
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${project.name.replace(/\.(srt|vtt)$/i, "")}-annotations.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
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
