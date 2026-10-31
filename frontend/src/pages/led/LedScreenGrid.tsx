import { useMemo } from 'react';
import { theme } from 'antd';
import type { LedPanel } from '../../api/ledTypes';

/**
 * A screen drawn to scale: every cell is one panel, so the proportions on screen are the panel's own.
 * Deliberately plain SVG — it prints, scales and needs no canvas or WebGL, and the shape of an LED wall is
 * exactly a grid.
 */
export function LedScreenGrid({ columns, rows, panel, maxWidth = 420 }: {
  columns: number;
  rows: number;
  panel?: LedPanel | null;
  maxWidth?: number;
}) {
  const { token } = theme.useToken();
  const panelW = panel?.widthMm ?? 500;
  const panelH = panel?.heightMm ?? 500;

  const { width, height, cell } = useMemo(() => {
    const ratio = (columns * panelW) / Math.max(1, rows * panelH);
    const w = Math.min(maxWidth, 420);
    const h = Math.max(40, w / Math.max(0.2, ratio));
    return { width: w, height: Math.min(h, 320), cell: { w: w / Math.max(1, columns), h: Math.min(h, 320) / Math.max(1, rows) } };
  }, [columns, rows, panelW, panelH, maxWidth]);

  if (columns <= 0 || rows <= 0) return null;

  // Drawing every cell of a very large wall costs more than it shows; past this many the grid is drawn as lines.
  const asCells = columns * rows <= 2000;

  return (
    <svg width={width} height={height} role="img" style={{ background: token.colorFillQuaternary, borderRadius: 6 }}>
      {asCells
        ? Array.from({ length: rows }).flatMap((_, row) =>
            Array.from({ length: columns }).map((__, column) => (
              <rect
                key={`${column}-${row}`}
                x={column * cell.w}
                y={row * cell.h}
                width={cell.w}
                height={cell.h}
                fill={token.colorPrimaryBg}
                stroke={token.colorPrimaryBorder}
                strokeWidth={0.5}
              />
            )),
          )
        : (
          <>
            <rect x={0} y={0} width={width} height={height} fill={token.colorPrimaryBg} stroke={token.colorPrimaryBorder} />
            {Array.from({ length: Math.min(columns, 60) }).map((_, i) => (
              <line key={`c${i}`} x1={(i * width) / columns} y1={0} x2={(i * width) / columns} y2={height} stroke={token.colorPrimaryBorder} strokeWidth={0.5} />
            ))}
            {Array.from({ length: Math.min(rows, 40) }).map((_, i) => (
              <line key={`r${i}`} x1={0} y1={(i * height) / rows} x2={width} y2={(i * height) / rows} stroke={token.colorPrimaryBorder} strokeWidth={0.5} />
            ))}
          </>
        )}
    </svg>
  );
}
