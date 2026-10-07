import { useMemo, useState } from "react";
import type {
  AnnotationCategory,
  AnnotationStatus,
  ReviewAnnotation,
  SubtitleCue,
} from "../models";
import type { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
import { formatTimestamp } from "../parsers/timecode";
import {
  ANNOTATION_CATEGORY_LABELS,
  ANNOTATION_STATUS_LABELS,
  cuesOverlapping,
  filterAnnotations,
  formatDateTime,
} from "../review/annotation";

const REVIEWER_KEY = "subtitle-meter.reviewer";

const CATEGORY_ORDER: AnnotationCategory[] = [
  "text",
  "translation",
  "terminology",
  "punctuation",
  "timing",
  "other",
];
const STATUS_ORDER: AnnotationStatus[] = [
  "open",
  "progress",
  "resolved",
  "wontfix",
];

export interface AnnotationComposerRange {
  startMs: number;
  endMs: number;
}

function useReviewer(): [string, (value: string) => void] {
  const [reviewer, setReviewer] = useState(() => {
    try {
      return localStorage.getItem(REVIEWER_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const update = (value: string) => {
    setReviewer(value);
    try {
      localStorage.setItem(REVIEWER_KEY, value);
    } catch {
      /* 私密模式下忽略持久化失败 */
    }
  };
  return [reviewer, update];
}

function AnnotationComposer({
  range,
  cues,
  vm,
  reviewer,
  setReviewer,
  onClose,
}: {
  range: AnnotationComposerRange;
  cues: SubtitleCue[];
  vm: SubtitleMeterViewModel;
  reviewer: string;
  setReviewer: (value: string) => void;
  onClose: () => void;
}) {
  const [startMs, setStartMs] = useState(range.startMs);
  const [endMs, setEndMs] = useState(Math.max(range.endMs, range.startMs + 1));
  const [category, setCategory] = useState<AnnotationCategory>("text");
  const [body, setBody] = useState("");
  const overlapping = cuesOverlapping(cues, startMs, endMs);
  const valid = body.trim().length > 0 && endMs > startMs;
  const submit = () => {
    if (!valid) return;
    void vm
      .addAnnotation({ startMs, endMs, category, body, reviewer })
      .then(onClose);
  };
  return (
    <div className="annotation-composer">
      <div className="annotation-composer-head">
        <strong>新建审校批注</strong>
        <button
          type="button"
          className="annotation-icon-button"
          aria-label="取消新建批注"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="annotation-composer-row">
        <label>
          开始(ms)
          <input
            aria-label="批注锚点开始毫秒"
            type="number"
            min="0"
            step="100"
            value={startMs}
            onChange={(e) => setStartMs(Number(e.target.value))}
          />
        </label>
        <label>
          结束(ms)
          <input
            aria-label="批注锚点结束毫秒"
            type="number"
            min="0"
            step="100"
            value={endMs}
            onChange={(e) => setEndMs(Number(e.target.value))}
          />
        </label>
        <label className="annotation-category-field">
          类别
          <select
            aria-label="批注问题类别"
            value={category}
            onChange={(e) => setCategory(e.target.value as AnnotationCategory)}
          >
            {CATEGORY_ORDER.map((item) => (
              <option key={item} value={item}>
                {ANNOTATION_CATEGORY_LABELS[item]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="annotation-anchor-hint">
        锚定 {formatTimestamp(startMs, "srt")} → {formatTimestamp(endMs, "srt")}
        {overlapping.length
          ? ` · 当前覆盖 #${overlapping.map((cue) => cue.index).join("、#")}`
          : " · 该区间暂无字幕条目，批注仍会保留在时间码上"}
        {endMs <= startMs && (
          <em className="warning-color">（结束时间必须晚于开始时间）</em>
        )}
      </p>
      <textarea
        aria-label="批注内容"
        placeholder="说明问题与修改建议…"
        value={body}
        rows={3}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="annotation-composer-actions">
        <input
          aria-label="审校署名"
          className="annotation-reviewer-input"
          placeholder="署名（谁提的）"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
        />
        <span className="annotation-spacer" />
        <button type="button" className="secondary-button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="annotation-submit-button"
          disabled={!valid}
          onClick={submit}
        >
          提交批注
        </button>
      </div>
    </div>
  );
}

function AnnotationCard({
  annotation,
  cues,
  vm,
  reviewer,
  expanded,
  onToggle,
  onSelectCue,
}: {
  annotation: ReviewAnnotation;
  cues: SubtitleCue[];
  vm: SubtitleMeterViewModel;
  reviewer: string;
  expanded: boolean;
  onToggle: () => void;
  onSelectCue: (id: string) => void;
}) {
  const overlapping = cuesOverlapping(
    cues,
    annotation.startMs,
    annotation.endMs,
  );
  return (
    <article className={`annotation-card status-${annotation.status}`}>
      <div className="annotation-card-head">
        <span className={`annotation-chip category-${annotation.category}`}>
          {ANNOTATION_CATEGORY_LABELS[annotation.category]}
        </span>
        <span className="annotation-timecode">
          {formatTimestamp(annotation.startMs, "srt")} →{" "}
          {formatTimestamp(annotation.endMs, "srt")}
        </span>
        <label className="annotation-status-field">
          <span className="annotation-visually-hidden">处理状态</span>
          <select
            aria-label="批注处理状态"
            value={annotation.status}
            onChange={(e) =>
              void vm.setAnnotationStatus(
                annotation.id,
                e.target.value as AnnotationStatus,
                reviewer,
              )
            }
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {ANNOTATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="annotation-body">{annotation.body}</p>
      <div className="annotation-anchors">
        {overlapping.length ? (
          overlapping.map((cue) => (
            <button
              key={cue.id}
              type="button"
              className="annotation-anchor-chip"
              onClick={() => onSelectCue(cue.id)}
            >
              #{cue.index} ↗
            </button>
          ))
        ) : (
          <span className="annotation-orphan">
            锚点处暂无字幕条目（条目已挪动？批注仍保留在原时间码上）
          </span>
        )}
      </div>
      <div className="annotation-card-foot">
        <button
          type="button"
          className="annotation-link-button"
          onClick={onToggle}
        >
          {expanded ? "收起轨迹" : `状态轨迹 · ${annotation.history.length}`}
        </button>
        <button
          type="button"
          className="annotation-link-button danger"
          onClick={() => void vm.deleteAnnotation(annotation.id)}
        >
          删除
        </button>
      </div>
      {expanded && (
        <ul className="annotation-history">
          {annotation.history.map((entry, index) => (
            <li key={`${entry.at}-${index}`}>
              <span>{formatDateTime(entry.at)}</span>
              <strong>{entry.by}</strong>
              <em>
                {entry.kind === "create"
                  ? "提出批注"
                  : `${
                      entry.from ? ANNOTATION_STATUS_LABELS[entry.from] : ""
                    } → ${entry.to ? ANNOTATION_STATUS_LABELS[entry.to] : ""}`}
              </em>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function AnnotationPanel({
  cues,
  annotations,
  vm,
  onSelectCue,
  onNewAnnotation,
  composer,
  onCloseComposer,
}: {
  cues: SubtitleCue[];
  annotations: ReviewAnnotation[];
  vm: SubtitleMeterViewModel;
  onSelectCue: (id: string) => void;
  onNewAnnotation?: () => void;
  composer: AnnotationComposerRange | null;
  onCloseComposer: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<AnnotationStatus | "all">(
    "open",
  );
  const [categoryFilter, setCategoryFilter] = useState<
    AnnotationCategory | "all"
  >("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewer, setReviewer] = useReviewer();

  const openCount = useMemo(
    () => annotations.filter((item) => item.status === "open").length,
    [annotations],
  );
  const visible = useMemo(
    () =>
      filterAnnotations(annotations, {
        status: statusFilter,
        category: categoryFilter,
      }),
    [annotations, statusFilter, categoryFilter],
  );

  if (annotations.length === 0 && !composer) return null;

  return (
    <section className="module annotation-panel">
      <div className="module-head">
        <div>
          <span className="module-kicker">REVIEW ANNOTATIONS</span>
          <h2>
            审校批注 <span className="issue-count">{annotations.length}</span>
            {openCount > 0 && (
              <span className="annotation-open-count">{openCount} 待处理</span>
            )}
          </h2>
        </div>
        {onNewAnnotation && (
          <button
            type="button"
            className="secondary-button"
            onClick={onNewAnnotation}
          >
            ＋ 新批注
          </button>
        )}
      </div>
      {annotations.length > 0 && (
        <div className="annotation-filters">
          <select
            aria-label="按处理状态筛选批注"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as AnnotationStatus | "all")
            }
          >
            <option value="all">全部状态</option>
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {ANNOTATION_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <select
            aria-label="按问题类别筛选批注"
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(e.target.value as AnnotationCategory | "all")
            }
          >
            <option value="all">全部类别</option>
            {CATEGORY_ORDER.map((category) => (
              <option key={category} value={category}>
                {ANNOTATION_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
          <span className="annotation-filter-tip">
            {visible.length} / {annotations.length} 条
          </span>
        </div>
      )}
      {composer && (
        <AnnotationComposer
          key={`${composer.startMs}-${composer.endMs}`}
          range={composer}
          cues={cues}
          vm={vm}
          reviewer={reviewer}
          setReviewer={setReviewer}
          onClose={onCloseComposer}
        />
      )}
      {annotations.length > 0 &&
        (visible.length ? (
          <div className="annotation-list">
            {visible.map((annotation) => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                cues={cues}
                vm={vm}
                reviewer={reviewer}
                expanded={expandedId === annotation.id}
                onToggle={() =>
                  setExpandedId(
                    expandedId === annotation.id ? null : annotation.id,
                  )
                }
                onSelectCue={onSelectCue}
              />
            ))}
          </div>
        ) : (
          <div className="annotation-empty">当前筛选条件下没有批注</div>
        ))}
    </section>
  );
}
