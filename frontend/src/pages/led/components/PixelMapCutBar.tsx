import { Lock, Scissors } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Pixel Map's "Kırp" button, left of the zoom controls: turns the cut mode on / off (highlighted while on). A Pro /
 * Team feature: locked with the reason on Demo.
 */
export function CutToolButton({ active, locked, onToggle }: { active: boolean; locked: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={locked}
      title={locked ? t("pixel.cut.locked") : t("pixel.cut.hint")}
      onClick={onToggle}
      className={`h-8 px-2 rounded border text-sm inline-flex items-center gap-1.5 disabled:opacity-50 ${
        active ? "bg-pink-600 border-pink-500 text-white" : "bg-neutral-800/90 border-neutral-700 text-neutral-100 hover:bg-neutral-700"
      }`}
    >
      {locked ? <Lock className="size-4" aria-hidden /> : <Scissors className="size-4" aria-hidden />}
      {t("pixel.cut.tool")}
    </button>
  );
}

/** The cut mode's hint under the buttons: how it works, how many panels are picked, why the last Del did nothing. */
export function CutHint({ pickedCount, error }: { pickedCount: number; error: "all" | "tooMany" | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-end gap-1 max-w-[min(90%,460px)] text-right" data-cut-hint>
      <p className="rounded bg-neutral-900/90 border border-pink-500/60 px-2 py-1 text-xs text-neutral-100">
        {t("pixel.cut.hintOn")}
        {pickedCount > 0 && (
          <span className="ml-2 text-pink-300" data-cut-picked>
            {t("pixel.cut.picked", { count: pickedCount })}
          </span>
        )}
      </p>
      {error && (
        <p role="alert" className="rounded bg-neutral-900/90 border border-red-500/60 px-2 py-1 text-xs text-red-300">
          {t(`pixel.cut.error.${error}`)}
        </p>
      )}
    </div>
  );
}
