import { Combine } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Pixel Map's "Birleştir" button, next to "Kırp": turns the merge mode on; while on it shows how many screens are
 * picked and a click merges them (as Enter does).
 */
export function MergeToolButton({ active, count, disabled, onToggle }: { active: boolean; count: number; disabled: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled && !active}
      title={disabled ? t("pixel.merge.needTwo") : t("pixel.merge.hint")}
      onClick={onToggle}
      className={`h-8 px-2 rounded border text-sm inline-flex items-center gap-1.5 disabled:opacity-50 ${
        active ? "bg-pink-600 border-pink-500 text-white" : "bg-neutral-800/90 border-neutral-700 text-neutral-100 hover:bg-neutral-700"
      }`}
      data-merge-tool
    >
      <Combine className="size-4" aria-hidden />
      {active ? t("pixel.merge.toolCount", { count }) : t("pixel.merge.tool")}
    </button>
  );
}

/** The merge mode's hint under the buttons: how it works and how many screens are picked. */
export function MergeHint({ count, onCancel }: { count: number; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 max-w-[min(90%,460px)] rounded bg-neutral-900/90 border border-pink-500/60 px-2 py-1 text-xs text-neutral-100 pointer-events-auto" data-merge-hint>
      <span>{t("pixel.merge.hint")}</span>
      {count > 0 && (
        <span className="text-pink-300 shrink-0" data-merge-picked>
          {t("pixel.merge.picked", { count })}
        </span>
      )}
      <button type="button" className="shrink-0 underline text-neutral-300 hover:text-white" onClick={onCancel}>
        {t("pixel.merge.cancel")}
      </button>
    </div>
  );
}
