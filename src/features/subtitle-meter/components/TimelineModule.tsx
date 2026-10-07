import type { PointerEvent } from "react";
import type { ReviewAnnotation, SubtitleCue, SubtitleProject } from "../models";
import { resolveAnnotations } from "../analyzers/annotationAnchor";
import { CATEGORY_LABELS, STATUS_LABELS } from "../annotationMeta";
import type { SubtitleMeterViewModel } from "../viewmodels/subtitleMeterViewModel";
export function TimelineModule({
  project,
  vm,
  selectedId,
  zoom,
  annotations,
}: {
  project: SubtitleProject;
  vm: SubtitleMeterViewModel;
  selectedId: string | null;
  zoom: number;
  annotations: ReviewAnnotation[];
}) {
  const maxTime = Math.max(1000, ...project.cues.map((cue) => cue.endMs));
  const resolvedAnnotations = resolveAnnotations(project.cues, annotations);
  const trackPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    cue: SubtitleCue,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const x0 = event.clientX,
      start = cue.startMs,
      end = cue.endMs,
      trackWidth =
        event.currentTarget.parentElement?.getBoundingClientRect().width ?? 1;
    let shift = 0;
    const move = (moveEvent: globalThis.PointerEvent) => {
      shift = Math.round(((moveEvent.clientX - x0) / trackWidth) * maxTime);
    };
    const done = () => {
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointermove", move);
      if (shift)
        void vm.editCue(cue.id, {
          startMs: Math.max(0, start + shift),
          endMs: Math.max(1, end + shift),
        });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", done, { once: true });
  };
  return (
    <section className="module timeline-module">
      <div className="module-head">
        <div>
          <span className="module-kicker">02 / TIMELINE</span>
          <h2>时间轴分布</h2>
        </div>
        <label className="zoom-control">
          缩放{" "}
          <input
            aria-label="时间轴缩放"
            type="range"
            min="0.6"
            max="2"
            step="0.1"
            value={zoom}
            onChange={(e) => vm.setZoom(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="time-ruler">
        <span>00:00</span>
        <span>{(maxTime / 2000).toFixed(0)}s</span>
        <span>{(maxTime / 1000).toFixed(0)}s</span>
      </div>
      <div className="timeline-track" style={{ minWidth: `${zoom * 100}%` }}>
        {project.cues.map((cue) => (
          <button
            key={cue.id}
            title={`第 ${cue.index} 条 · ${(cue.startMs / 1000).toFixed(2)}s`}
            className={`timeline-cue ${selectedId === cue.id ? "selected" : ""}`}
            style={{
              left: `${(cue.startMs / maxTime) * 100}%`,
              width: `${Math.max(2.5, ((cue.endMs - cue.startMs) / maxTime) * 100)}%`,
            }}
            onClick={() => vm.selectCue(cue.id)}
            onPointerDown={(event) => trackPointerDown(event, cue)}
          >
            {cue.index}
          </button>
        ))}
      </div>
      {resolvedAnnotations.length > 0 && (
        <div
          className="annotation-rail"
          style={{ minWidth: `${zoom * 100}%` }}
          aria-label="批注锚点轨道"
        >
          {resolvedAnnotations.map(({ annotation, cues: matched, orphan }) =>
            annotation.scope === "range" ? (
              <span
                key={annotation.id}
                className={`annotation-range status-${annotation.status} ${
                  orphan ? "orphan" : ""
                }`}
                title={`${CATEGORY_LABELS[annotation.category]} · ${STATUS_LABELS[annotation.status]} · ${annotation.body}`}
                style={{
                  left: `${(annotation.startMs / maxTime) * 100}%`,
                  width: `${Math.max(
                    0.8,
                    ((annotation.endMs - annotation.startMs) / maxTime) * 100,
                  )}%`,
                }}
              />
            ) : (
              !orphan &&
              matched.map((cue) => (
                <span
                  key={`${annotation.id}-${cue.id}`}
                  className={`annotation-dot status-${annotation.status}`}
                  title={`第 ${cue.index} 条 · ${CATEGORY_LABELS[annotation.category]} · ${STATUS_LABELS[annotation.status]}`}
                  style={{
                    left: `calc(${((cue.startMs + cue.endMs) / 2 / maxTime) * 100}% - 4px)`,
                  }}
                />
              ))
            ),
          )}
        </div>
      )}
      <div className="timeline-hint">
        拖动时间块调整起止位置 · 点击条目进行编辑
        {resolvedAnnotations.length > 0 &&
          " · 琥珀色标记为审校批注，始终按时间码锚定"}
      </div>
    </section>
  );
}
