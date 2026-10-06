import { QRCodeSVG } from 'qrcode.react';
import type { LabelTemplate, PrintLabelItem } from '../../api/types';

type TemplateLook = Omit<LabelTemplate, 'id' | 'name' | 'isDefault'>;

/**
 * One label at its real size in millimetres: QR on the start side, the enabled fields next to it.
 * Used by the print page and by the template editor's preview (scaled with CSS transform).
 */
export function LabelPreview({ template, item, companyName, note }: {
  template: TemplateLook;
  item: PrintLabelItem;
  companyName?: string | null;
  /** Free text printed under the fields (e.g. "Kırılabilir"). */
  note?: string | null;
}) {
  const lines: { text: string; bold?: boolean; small?: boolean }[] = [];
  if (template.showCompanyName && companyName) lines.push({ text: companyName });
  if (template.showName) lines.push({ text: item.equipmentName, bold: true });
  const brandModel = [template.showBrand ? item.brand : null, template.showModel ? item.model : null].filter(Boolean).join(' ');
  if (brandModel) lines.push({ text: brandModel });
  if (template.showCode) lines.push({ text: item.equipmentCode });
  if (template.showInternalRef && item.internalRef) lines.push({ text: item.internalRef, bold: true });
  if (template.showSerialNumber && item.serialNumber) lines.push({ text: `S/N ${item.serialNumber}` });
  if (note?.trim()) lines.push({ text: note.trim(), small: true });

  const padding = 1.5;
  const qr = Math.min(template.qrSizeMm, template.heightMm - padding * 2, template.widthMm - padding * 2);

  return (
    <div
      className="label-sheet"
      dir="ltr"
      style={{
        width: `${template.widthMm}mm`,
        height: `${template.heightMm}mm`,
        padding: `${padding}mm`,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '1.5mm',
        background: '#fff',
        color: '#000',
        overflow: 'hidden',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: `${template.fontSizePt}pt`,
        lineHeight: 1.15,
      }}
    >
      <QRCodeSVG value={item.qrValue} level="M" marginSize={0} style={{ width: `${qr}mm`, height: `${qr}mm`, flex: 'none' }} />
      {lines.length > 0 && (
        <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
          {lines.map((l, i) => (
            <div key={i} style={{ fontWeight: l.bold ? 700 : 400, fontSize: l.small ? '0.8em' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
