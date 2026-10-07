import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { InspectionModule } from "../components/InspectionModule";
import { AnnotationModule } from "../components/AnnotationModule";
import { VersionExportModule } from "../components/VersionExportModule";
import { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import type {
  ReviewAnnotation,
  SubtitleCue,
  SubtitleIssue,
  SubtitleProject,
} from "../models";

const cues: SubtitleCue[] = [
  { id: "cue-1", index: 1, startMs: 1000, endMs: 3000, text: "第一条" },
  { id: "cue-2", index: 2, startMs: 3500, endMs: 6000, text: "第二条" },
];
const issues: SubtitleIssue[] = [];

const annotation: ReviewAnnotation = {
  id: "ann-1",
  scope: "cue",
  startMs: 1000,
  endMs: 3000,
  category: "wording",
  body: "这里有错别字",
  status: "open",
  createdBy: "审校甲",
  createdAt: Date.parse("2026-10-07T09:00:00Z"),
  history: [
    {
      at: Date.parse("2026-10-07T09:00:00Z"),
      actor: "审校甲",
      to: "open",
    },
  ],
  cueId: "cue-1",
  originIndex: 1,
};

const vm = new SubtitleMeterViewModel();
const noop = () => undefined;

describe("annotation UI rendering", () => {
  it("renders the inspection module with only the hover affordance when no annotations exist", () => {
    const html = renderToStaticMarkup(
      createElement(InspectionModule, {
        cues,
        issues,
        vm,
        selectedId: "cue-1",
        onAnnotateCue: noop,
      }),
    );
    expect(html).toContain("cue-annotate-button");
    expect(html).not.toContain("annotation-module");
    expect(html).not.toContain("REVIEW ANNOTATIONS");
  });

  it("renders the annotation module with filters and rows once annotations exist", () => {
    const html = renderToStaticMarkup(
      createElement(AnnotationModule, {
        cues,
        annotations: [annotation],
        vm,
        composer: null,
        onOpenComposer: noop,
        onCloseComposer: noop,
      }),
    );
    expect(html).toContain("审校批注");
    expect(html).toContain("1 条待处理");
    expect(html).toContain("文字错漏");
    expect(html).toContain("这里有错别字");
    expect(html).toContain("审校甲");
    expect(html).toContain("#1");
    expect(html).toContain("按处理状态筛选");
    expect(html).toContain("按问题类别筛选");
  });

  it("shows an orphan annotation after its cue timecode moves away", () => {
    const moved: SubtitleCue[] = [
      { id: "cue-2", index: 2, startMs: 3500, endMs: 6000, text: "二" },
      { id: "cue-1", index: 1, startMs: 9000, endMs: 11000, text: "一" },
    ];
    const html = renderToStaticMarkup(
      createElement(AnnotationModule, {
        cues: moved,
        annotations: [annotation],
        vm,
        composer: null,
        onOpenComposer: noop,
        onCloseComposer: noop,
      }),
    );
    expect(html).toContain("已挪动，未锚定");
    expect(html).not.toContain("anchor-chip");
  });

  it("exposes annotation export only when the project has annotations", () => {
    const base: SubtitleProject = {
      id: "p",
      name: "clip.srt",
      format: "srt",
      cues,
      updatedAt: 1,
      versions: [],
      annotations: [],
    };
    const without = renderToStaticMarkup(
      createElement(VersionExportModule, {
        project: base,
        vm,
        phase: "ready",
      }),
    );
    expect(without).not.toContain("批注清单");
    const withAnnotations = renderToStaticMarkup(
      createElement(VersionExportModule, {
        project: { ...base, annotations: [annotation] },
        vm,
        phase: "ready",
      }),
    );
    expect(withAnnotations).toContain("审校批注清单");
    expect(withAnnotations).toContain("1 条待处理");
    expect(withAnnotations).toContain("导出批注 CSV");
  });
});
