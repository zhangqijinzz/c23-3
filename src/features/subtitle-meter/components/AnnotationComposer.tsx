import { useState } from "react";
import {
  ANNOTATION_CATEGORIES,
  getReviewer,
  setReviewer,
} from "../annotationMeta";
import type {
  AnnotationCategory,
  AnnotationScope,
  SubtitleCue,
} from "../models";
import { formatTimestamp, parseTimestamp } from "../parsers/timecode";
import type {
  NewAnnotationInput,
  SubtitleMeterViewModel,
} from "../viewmodels/subtitleMeterViewModel";

export interface AnnotationDraft {
  scope: AnnotationScope;
  startMs: number;
  endMs: number;
}

export function AnnotationComposer({
  vm,
  draft,
  cues,
  onClose,
}: {
  vm: SubtitleMeterViewModel;
  draft: AnnotationDraft;
  cues: SubtitleCue[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<AnnotationScope>(draft.scope);
  const [startText, setStartText] = useState(
    formatTimestamp(Math.max(0, draft.startMs), "srt"),
  );
  const [endText, setEndText] = useState(
    formatTimestamp(Math.max(1, draft.endMs), "srt"),
  );
  const [category, setCategory] = useState<AnnotationCategory>("wording");
  const [body, setBody] = useState("");
  const [reviewer, setReviewerState] = useState(getReviewer());
  const [error, setError] = useState("");
  const cue = cues.find(
    (item) => item.startMs === draft.startMs && item.endMs === draft.endMs,
  );
  const submit = async () => {
    setError("");
    let input: NewAnnotationInput;
    try {
      if (scope === "cue") {
        if (!cue) throw new Error("对应的字幕条目已不存在");
      }
      const startMs =
        scope === "cue" ? cue!.startMs : parseTimestamp(startText);
      const endMs = scope === "cue" ? cue!.endMs : parseTimestamp(endText);
      if (endMs <= startMs) throw new Error("结束时间码必须晚于开始时间码");
      input = {
        scope,
        startMs,
        endMs,
        category,
        body,
        actor: reviewer,
      };
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "时间码无效");
      return;
    }
    try {
      await vm.addAnnotation(input);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "批注保存失败");
    }
  };
  return (
    <div className="annotation-composer">
      <div className="composer-row">
        <div className="scope-toggle" role="group" aria-label="批注锚定方式">
          <button
            type="button"
            className={scope === "cue" ? "active" : ""}
            onClick={() => setScope("cue")}
          >
            锚定单条字幕
          </button>
          <button
            type="button"
            className={scope === "range" ? "active" : ""}
            onClick={() => setScope("range")}
          >
            锚定时间区间
          </button>
        </div>
        {scope === "cue" ? (
          <span className="composer-cue">
            {cue
              ? `第 ${cue.index} 条 · ${formatTimestamp(cue.startMs, "srt")} → ${formatTimestamp(cue.endMs, "srt")}`
              : "未找到对应字幕"}
          </span>
        ) : (
          <span className="composer-times">
            <input
              aria-label="区间开始时间码"
              value={startText}
              onChange={(event) => setStartText(event.target.value)}
              placeholder="00:00:01,000"
            />
            <em>→</em>
            <input
              aria-label="区间结束时间码"
              value={endText}
              onChange={(event) => setEndText(event.target.value)}
              placeholder="00:00:03,000"
            />
          </span>
        )}
      </div>
      <textarea
        aria-label="批注内容"
        className="composer-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="描述问题与修改建议…"
        rows={3}
        autoFocus
      />
      <div className="composer-row">
        <label className="composer-field">
          问题类别
          <select
            aria-label="问题类别"
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as AnnotationCategory)
            }
          >
            {ANNOTATION_CATEGORIES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="composer-field">
          审校人
          <input
            aria-label="审校人姓名"
            value={reviewer}
            onChange={(event) => {
              setReviewerState(event.target.value);
              setReviewer(event.target.value);
            }}
            placeholder="留空记为匿名审校"
          />
        </label>
      </div>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <div className="composer-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="annotation-submit"
          onClick={() => void submit()}
        >
          提交批注
        </button>
      </div>
    </div>
  );
}
