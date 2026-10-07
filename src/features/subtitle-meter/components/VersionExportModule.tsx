import type { Format, ReviewAnnotation, SubtitleProject } from "../models";
import type { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import { ANNOTATION_STATUS_LABELS } from "../review/annotation";

const STATUS_ORDER = ["open", "progress", "resolved", "wontfix"] as const;

export function VersionExportModule({
  project,
  vm,
  phase,
}: {
  project: SubtitleProject;
  vm: SubtitleMeterViewModel;
  phase: string;
}) {
  const annotations: ReviewAnnotation[] = project.annotations;
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: annotations.filter((item) => item.status === status).length,
  }));
  const openCount = counts.find((item) => item.status === "open")?.count ?? 0;
  return (
    <section className="module version-module">
      <div className="module-head">
        <div>
          <span className="module-kicker">04 / VERSIONS & EXPORT</span>
          <h2>版本与交付</h2>
        </div>
        <span className="saved-label">● 自动保存</span>
      </div>
      <div className="version-row">
        <div>
          <strong>本地快照</strong>
          <small>
            {project.versions.length
              ? `最近：${project.versions.at(-1)?.label}`
              : "保存当前版本以便回退"}
          </small>
        </div>
        <button
          className="secondary-button"
          onClick={() => void vm.saveVersion()}
        >
          ＋ 保存快照
        </button>
      </div>
      {project.versions.length > 0 && (
        <div className="version-list">
          {project.versions.map((version) => (
            <button
              key={version.id}
              onClick={() => void vm.restoreVersion(version.id)}
            >
              {version.label}
              <span>恢复 ↗</span>
            </button>
          ))}
        </div>
      )}
      <div className="export-row">
        <label>
          格式
          <select
            aria-label="导出格式"
            value={project.format}
            onChange={(e) => vm.setFormat(e.target.value as Format)}
          >
            <option value="srt">SRT</option>
            <option value="vtt">WebVTT</option>
          </select>
        </label>
        <button
          className="export-button"
          disabled={phase === "exporting"}
          onClick={() => void vm.exportFile()}
        >
          导出字幕 <span>↓</span>
        </button>
      </div>
      {annotations.length > 0 && (
        <div className="annotation-delivery">
          <div className="version-row">
            <div>
              <strong>审校批注核对</strong>
              <small>
                {openCount > 0
                  ? `还有 ${openCount} 条批注待处理，交付前请核对`
                  : "批注均已处理，可导出清单随字幕交付"}
              </small>
            </div>
            <button
              className="secondary-button"
              onClick={() => vm.exportAnnotations()}
            >
              导出批注清单 <span>↓</span>
            </button>
          </div>
          <div className="annotation-delivery-counts">
            {counts.map(({ status, count }) => (
              <span
                key={status}
                className={`annotation-delivery-pill status-${status}`}
              >
                {ANNOTATION_STATUS_LABELS[status]} {count}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="privacy-note">字幕文件与项目版本仅保存在当前浏览器</p>
    </section>
  );
}
