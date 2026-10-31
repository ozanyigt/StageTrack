import { useTranslation } from "react-i18next";
import type { CarrierBom } from "../core/stage3d/carriers";

/** A carrier's parts as lines: "Dikme: 4", "2 m demir: 4 adet", … (LED demiri) or uprights, ledgers, diagonals (scaff). */
export function useBomLines(): (bom: CarrierBom) => [string, string][] {
  const { t } = useTranslation();
  const pcs = (n: number) => t("stage3d.bom.pcs", { n });
  return (bom) =>
    bom.kind === "LedFrame"
      ? [
          [t("stage3d.bom.posts"), String(bom.posts)],
          [t("stage3d.bom.twoM"), pcs(bom.twoM)],
          [t("stage3d.bom.oneM"), pcs(bom.oneM)],
        ]
      : [
          [t("stage3d.bom.uprights"), pcs(bom.uprights)],
          [t("stage3d.bom.ledgers"), pcs(bom.ledgers)],
          [t("stage3d.bom.diagonals"), pcs(bom.diagonals)],
          [t("stage3d.bom.basePlates"), pcs(bom.basePlates)],
        ];
}
