import { useMemo, useState } from "react";
import {
  ANNOTATION_CATEGORIES,
  ANNOTATION_STATUSES,
  CATEGORY_LABELS,
  STATUS_LABELS,
  getReviewer,
  setReviewer,
} from "../annotationMeta";
import {
  resolveAnnotations,
  type ResolvedAnnotation,
} from "../analyzers/annotationAnchor";
import type {
  AnnotationCategory,
  AnnotationStatus,
  ReviewAnnotation,
  SubtitleCue,
} from "../models";
import { formatTimestamp } from "../parsers/timecode";
import type { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import { AnnotationComposer, type AnnotationDraft } from "./AnnotationComposer";

function formatDateTime(ms: number): string {
  const date = new Date(ms),
    pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type StatusFilter = "all" | AnnotationStatus;
type CategoryFilter = "all" | AnnotationCategory;

function AnchorChips({
  resolved,
  vm,
}: {
  resolved: ResolvedAnnotation;
  vm: SubtitleMeterViewModel;
}) {
  const { annotation, cues, orphan } = resolved;
  if (orphan)
    return (
      <span
        className="annotation-anchor orphan"
        title="时间码已无法匹配当前字幕"
      >
        {annotation.scope === "cue"
          ? `原第 ${annotation.originIndex ?? "-"} 条 · 已挪动，未锚定`
          : "区间未覆盖任何字幕 · 未锚定"}
      </span>
    );
  return (
    <span className="annotation-anchor">
      <span className="anchor-time">
        {formatTimestamp(annotation.startMs, "srt")} →{" "}
        {formatTimestamp(annotation.endMs, "srt")}
      </span>
      {cues.map((cue) => (
        <button
          key={cue.id}
          className="anchor-chip"
          onClick={() => vm.selectCue(cue.id)}
          title="定位到该字幕"
        >
          #{cue.index}
        </button>
      ))}
    </span>
  );
}

function AnnotationRow({
  resolved,
  vm,
  reviewer,
}: {
  resolved: ResolvedAnnotation;
  vm: SubtitleMeterViewModel;
  reviewer: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState("");
  const { annotation, orphan } = resolved;
  return (
    <article
      className={`annotation-row status-${annotation.status} ${
        orphan ? "orphan" : ""
      }`}
    >
      <div className="annotation-line">
        <span className={`annotation-tag cat-${annotation.category}`}>
          {CATEGORY_LABELS[annotation.category]}
        </span>
        <p className="annotation-body">{annotation.body}</p>
        <select
          aria-label="批注处理状态"
          className={`annotation-status-select status-${annotation.status}`}
          value={annotation.status}
          onChange={(event) =>
            void vm.setAnnotationStatus(
              annotation.id,
              event.target.value as AnnotationStatus,
              reviewer,
              note,
            )
          }
        >
          {ANNOTATION_STATUSES.map((status) => (
            <option key={status.id} value={status.id}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
      <div className="annotation-meta">
        <AnchorChips resolved={resolved} vm={vm} />
        <label className="inline-category">
          类别
          <select
            aria-label="修改问题类别"
            value={annotation.category}
            onChange={(event) =>
              void vm.setAnnotationCategory(
                annotation.id,
                event.target.value as AnnotationCategory,
              )
            }
          >
            {ANNOTATION_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="history-toggle"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          处理记录（{annotation.history.length}）
        </button>
        <button
          className="annotation-delete"
          onClick={() => void vm.deleteAnnotation(annotation.id)}
        >
          删除
        </button>
        <span className="annotation-author">
          {annotation.createdBy} · {formatDateTime(annotation.createdAt)}
        </span>
      </div>
      <div className="status-note-row">
        <input
          aria-label="状态变更说明"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="切换状态时可附处理说明（可选）"
        />
      </div>
      {expanded && (
        <ol className="annotation-history">
          {annotation.history
            .slice()
            .reverse()
            .map((event, index) => (
              <li key={`${event.at}-${index}`}>
                <strong>{event.actor}</strong>
                <time>{formatDateTime(event.at)}</time>
                <span>
                  {event.from
                    ? `${STATUS_LABELS[event.from]} → ${STATUS_LABELS[event.to]}`
                    : `提出 · ${STATUS_LABELS[event.to]}`}
                </span>
                {event.note && <em>{event.note}</em>}
              </li>
            ))}
        </ol>
      )}
    </article>
  );
}

export function AnnotationModule({
  cues,
  annotations,
  vm,
  composer,
  onOpenComposer,
  onCloseComposer,
}: {
  cues: SubtitleCue[];
  annotations: ReviewAnnotation[];
  vm: SubtitleMeterViewModel;
  composer: AnnotationDraft | null;
  onOpenComposer: (draft: AnnotationDraft) => void;
  onCloseComposer: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [reviewer, setReviewerState] = useState(getReviewer());
  const resolved = useMemo(
    () => resolveAnnotations(cues, annotations),
    [cues, annotations],
  );
  const counts = useMemo(() => {
    const map: Record<StatusFilter, number> = {
      all: annotations.length,
      open: 0,
      "in-progress": 0,
      resolved: 0,
      "wont-fix": 0,
    };
    annotations.forEach((annotation) => {
      map[annotation.status] += 1;
    });
    return map;
  }, [annotations]);
  const visible = resolved.filter(
    ({ annotation }) =>
      (statusFilter === "all" || annotation.status === statusFilter) &&
      (categoryFilter === "all" || annotation.category === categoryFilter),
  );
  const maxEnd = Math.max(0, ...cues.map((cue) => cue.endMs));
  return (
    <section className="module annotation-module">
      <div className="module-head">
        <div>
          <span className="module-kicker">REVIEW ANNOTATIONS</span>
          <h2>
            审校批注 <span className="issue-count">{annotations.length}</span>
            {counts.open > 0 && (
              <span className="annotation-open-count">
                {counts.open} 条待处理
              </span>
            )}
          </h2>
        </div>
        <button
          className="secondary-button"
          onClick={() =>
            onOpenComposer({
              scope: "range",
              startMs: 0,
              endMs: Math.max(1000, maxEnd),
            })
          }
        >
          ＋ 区间批注
        </button>
      </div>
      <div className="reviewer-row">
        <label>
          当前审校人
          <input
            aria-label="当前审校人"
            value={reviewer}
            onChange={(event) => {
              setReviewerState(event.target.value);
              setReviewer(event.target.value);
            }}
            placeholder="留空记为匿名审校"
          />
        </label>
        <span>状态变化会记录操作人与时间</span>
      </div>
      <div className="annotation-filters">
        <div className="status-filter" role="group" aria-label="按处理状态筛选">
          <button
            className={statusFilter === "all" ? "active" : ""}
            onClick={() => setStatusFilter("all")}
          >
            全部 {counts.all}
          </button>
          {ANNOTATION_STATUSES.map((status) => (
            <button
              key={status.id}
              className={statusFilter === status.id ? "active" : ""}
              onClick={() => setStatusFilter(status.id)}
            >
              {status.label} {counts[status.id]}
            </button>
          ))}
        </div>
        <select
          aria-label="按问题类别筛选"
          value={categoryFilter}
          onChange={(event) =>
            setCategoryFilter(event.target.value as CategoryFilter)
          }
        >
          <option value="all">全部类别</option>
          {ANNOTATION_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </div>
      {composer && (
        <AnnotationComposer
          vm={vm}
          draft={composer}
          cues={cues}
          onClose={onCloseComposer}
        />
      )}
      <div className="annotation-list">
        {visible.length ? (
          visible.map((item) => (
            <AnnotationRow
              key={item.annotation.id}
              resolved={item}
              vm={vm}
              reviewer={reviewer}
            />
          ))
        ) : (
          <div className="clear-state">
            {annotations.length ? "当前筛选条件下没有批注" : "还没有审校批注"}
          </div>
        )}
      </div>
    </section>
  );
}
