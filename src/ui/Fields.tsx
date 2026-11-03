import type { ParamField } from "../engine/types";
import { useStudio } from "../store";

export function Fields({ fields }: { fields: ParamField[] }) {
  const params = useStudio((s) => s.scene.layers.find((layer) => layer.id === s.activeLayerId)?.params ?? {});
  const locks = useStudio((s) => s.scene.locks);
  const setParam = useStudio((s) => s.setParam);
  const toggleLock = useStudio((s) => s.toggleLock);

  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const lockKey = `param:${field.key}`;
        const locked = locks.includes(lockKey);
        const value = params[field.key] ?? field.default;
        return (
          <label key={field.key} className="block">
            <span className="mb-1 flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.14em] text-muted">
              {field.label}
              <button
                type="button"
                aria-pressed={locked}
                aria-label={locked ? `Unlock ${field.label}` : `Lock ${field.label}`}
                className={`rounded px-1.5 py-0.5 text-[10px] ${locked ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
                onClick={(event) => {
                  event.preventDefault();
                  toggleLock(lockKey);
                }}
              >
                {locked ? "Locked" : "Lock"}
              </button>
            </span>
            {field.kind === "boolean" ? (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(event) => setParam(field.key, event.target.checked)}
              />
            ) : field.kind === "select" ? (
              <select
                className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-sm"
                value={String(value)}
                onChange={(event) => setParam(field.key, event.target.value)}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="flex items-center gap-2">
                <input
                  className="w-full accent-accent"
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={Number(value)}
                  onChange={(event) => setParam(field.key, field.kind === "int" ? Number(event.target.value) : Number(event.target.value))}
                />
                <input
                  className="w-16 rounded-md border border-line bg-white px-1.5 py-1 text-right text-xs"
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={Number(value)}
                  onChange={(event) => setParam(field.key, Number(event.target.value))}
                />
              </span>
            )}
            {field.hint ? <span className="mt-1 block text-[11px] text-muted">{field.hint}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
