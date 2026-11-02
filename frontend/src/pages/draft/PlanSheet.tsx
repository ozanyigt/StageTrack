import { useTranslation } from 'react-i18next';
import type { SceneLayout } from '../led/core/stage3d/scene';
import type { Distro } from './cabling';
import { TRADE_COLOR, type StageProp } from './stageProps';
import type { RoomBox } from './venueObjects';

export interface PlanSheetProps {
  layout: SceneLayout | null;
  props: StageProp[];
  room: RoomBox | null;
  distros: Distro[];
  mains: { x: number; z: number } | null;
  /** 100 = 1:100; one metre of ground becomes 10 mm on paper. */
  scale: number;
  showDimensions: boolean;
  showGrid: boolean;
}

/**
 * The drawing that goes to the venue. Not a screenshot of the 3D view: an actual scaled plan, sized in
 * millimetres so that 1:100 means 1:100 on the printer, with a grid, measurements and a scale bar that can be
 * laid a ruler against. This is what "professional" means to the person receiving it.
 */
export function PlanSheet({ layout, props, room, distros, mains, scale, showDimensions, showGrid }: PlanSheetProps) {
  const { t } = useTranslation();

  const bounds = sheetBounds(layout, props, room, distros, mains);
  const widthM = bounds.maxX - bounds.minX;
  const depthM = bounds.maxZ - bounds.minZ;

  // Millimetres on paper: a metre of ground is 1000/scale of them.
  const mmPerM = 1000 / scale;
  const widthMm = widthM * mmPerM;
  const heightMm = depthM * mmPerM;

  /** Lines stay readable whatever the scale: a tenth of a millimetre on paper, expressed in metres. */
  const hair = 0.3 / mmPerM;
  const text = 2.6 / mmPerM;

  return (
    <svg
      viewBox={`${bounds.minX} ${bounds.minZ} ${widthM} ${depthM}`}
      width={`${widthMm.toFixed(1)}mm`}
      height={`${heightMm.toFixed(1)}mm`}
      style={{ background: '#fff', maxWidth: '100%' }}
      role="img"
      aria-label={t('plan.sheet')}
    >
      {showGrid && (
        <>
          <defs>
            <pattern id="plan-grid" width="1" height="1" patternUnits="userSpaceOnUse">
              <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#e5e7eb" strokeWidth={hair} />
            </pattern>
            <pattern id="plan-grid-5" width="5" height="5" patternUnits="userSpaceOnUse">
              <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#d1d5db" strokeWidth={hair * 1.5} />
            </pattern>
          </defs>
          <rect x={bounds.minX} y={bounds.minZ} width={widthM} height={depthM} fill="url(#plan-grid)" />
          <rect x={bounds.minX} y={bounds.minZ} width={widthM} height={depthM} fill="url(#plan-grid-5)" />
        </>
      )}

      {room && (
        <>
          <rect
            x={room.minX}
            y={room.minZ}
            width={room.maxX - room.minX}
            height={room.maxZ - room.minZ}
            fill="none"
            stroke="#111827"
            strokeWidth={hair * 4}
          />
          {showDimensions && (
            <>
              {dimension(room.minX, room.maxX, room.minZ - 1.5, 'x', hair, text)}
              {dimension(room.minZ, room.maxZ, room.minX - 1.5, 'z', hair, text)}
            </>
          )}
        </>
      )}

      {layout && (
        <>
          <rect
            x={-layout.podium.width / 2}
            y={layout.podium.back}
            width={layout.podium.width}
            height={layout.podium.depth}
            fill="#f3f4f6"
            stroke="#111827"
            strokeWidth={hair * 2}
          />
          <text x={0} y={layout.podium.back + layout.podium.depth / 2} fontSize={text} textAnchor="middle" fill="#6b7280">
            {t('draft.stageArea')}
          </text>
          {showDimensions && dimension(-layout.podium.width / 2, layout.podium.width / 2, layout.podium.back - 0.8, 'x', hair, text)}
        </>
      )}

      {/* The screens: the face drawn as a heavy line, which is how a plan shows a wall. */}
      {(layout?.screens ?? []).map((placed) => {
        const facing = (placed.rotationDeg * Math.PI) / 180;
        const half = placed.screen.widthM / 2;
        return (
          <g key={placed.screen.id}>
            <line
              x1={placed.x - Math.cos(facing) * half}
              y1={placed.z + Math.sin(facing) * half}
              x2={placed.x + Math.cos(facing) * half}
              y2={placed.z - Math.sin(facing) * half}
              stroke="#111827"
              strokeWidth={hair * 6}
              strokeLinecap="square"
            />
            <text x={placed.x} y={placed.z - 0.6} fontSize={text} textAnchor="middle" fill="#111827">
              {placed.screen.name ?? ''}
            </text>
          </g>
        );
      })}

      {props.map((prop) => {
        const span = prop.bodies * prop.size.w;
        return (
          <g key={prop.id}>
            <rect
              x={prop.x - span / 2}
              y={prop.z - prop.size.d / 2}
              width={span}
              height={prop.size.d}
              fill={TRADE_COLOR[prop.trade]}
              fillOpacity={0.25}
              stroke={TRADE_COLOR[prop.trade]}
              strokeWidth={hair * 2}
              transform={`rotate(${-prop.rotationDeg} ${prop.x} ${prop.z})`}
            />
            <text x={prop.x} y={prop.z - prop.size.d / 2 - 0.3} fontSize={text} textAnchor="middle" fill="#374151">
              {prop.label}
            </text>
          </g>
        );
      })}

      {distros.map((distro) => (
        <g key={distro.id}>
          <rect x={distro.x - 0.4} y={distro.z - 0.4} width={0.8} height={0.8} fill="#facc15" stroke="#111827" strokeWidth={hair * 2} />
          <text x={distro.x} y={distro.z + 1.1} fontSize={text} textAnchor="middle" fill="#374151">
            {distro.name} · {distro.amps}A
          </text>
        </g>
      ))}

      {mains && (
        <g>
          <circle cx={mains.x} cy={mains.z} r={0.5} fill="#dc2626" />
          <text x={mains.x} y={mains.z - 0.8} fontSize={text} textAnchor="middle" fill="#dc2626">
            {t('cable.mains')}
          </text>
        </g>
      )}

      {/* The scale bar: ten metres, with its ticks, so a ruler can check the print. */}
      <g transform={`translate(${bounds.minX + 1} ${bounds.maxZ - 1})`}>
        <line x1={0} y1={0} x2={10} y2={0} stroke="#111827" strokeWidth={hair * 3} />
        {[0, 5, 10].map((m) => (
          <line key={m} x1={m} y1={-0.3} x2={m} y2={0.3} stroke="#111827" strokeWidth={hair * 3} />
        ))}
        <text x={5} y={-0.6} fontSize={text} textAnchor="middle" fill="#111827">
          10 m · 1:{scale}
        </text>
      </g>

      {/* North-ish arrow: the audience is always towards the bottom of the sheet. */}
      <g transform={`translate(${bounds.maxX - 1.5} ${bounds.maxZ - 1.5})`}>
        <line x1={0} y1={0} x2={0} y2={-2} stroke="#111827" strokeWidth={hair * 3} />
        <path d={`M 0 -2.6 L 0.5 -1.8 L -0.5 -1.8 Z`} fill="#111827" />
        <text x={0} y={0.8} fontSize={text} textAnchor="middle" fill="#111827">
          {t('plan.stageUp')}
        </text>
      </g>
    </svg>
  );
}

/** A measurement line with ticks and its length written over it. */
function dimension(from: number, to: number, at: number, axis: 'x' | 'z', hair: number, text: number) {
  const length = Math.abs(to - from);
  const label = `${length.toFixed(1)} m`;
  if (axis === 'x') {
    return (
      <g>
        <line x1={from} y1={at} x2={to} y2={at} stroke="#6b7280" strokeWidth={hair * 2} />
        <line x1={from} y1={at - 0.3} x2={from} y2={at + 0.3} stroke="#6b7280" strokeWidth={hair * 2} />
        <line x1={to} y1={at - 0.3} x2={to} y2={at + 0.3} stroke="#6b7280" strokeWidth={hair * 2} />
        <text x={(from + to) / 2} y={at - 0.4} fontSize={text} textAnchor="middle" fill="#374151">
          {label}
        </text>
      </g>
    );
  }
  return (
    <g>
      <line x1={at} y1={from} x2={at} y2={to} stroke="#6b7280" strokeWidth={hair * 2} />
      <line x1={at - 0.3} y1={from} x2={at + 0.3} y2={from} stroke="#6b7280" strokeWidth={hair * 2} />
      <line x1={at - 0.3} y1={to} x2={at + 0.3} y2={to} stroke="#6b7280" strokeWidth={hair * 2} />
      <text x={at - 0.4} y={(from + to) / 2} fontSize={text} textAnchor="middle" fill="#374151" transform={`rotate(-90 ${at - 0.4} ${(from + to) / 2})`}>
        {label}
      </text>
    </g>
  );
}

/** Everything on the sheet, with a margin wide enough for the measurements and the scale bar. */
function sheetBounds(
  layout: SceneLayout | null,
  props: StageProp[],
  room: RoomBox | null,
  distros: Distro[],
  mains: { x: number; z: number } | null,
) {
  const xs: number[] = [];
  const zs: number[] = [];
  if (room) {
    xs.push(room.minX, room.maxX);
    zs.push(room.minZ, room.maxZ);
  }
  if (layout) {
    xs.push(-layout.podium.width / 2, layout.podium.width / 2);
    zs.push(layout.podium.back, layout.podium.front);
    for (const placed of layout.screens) {
      xs.push(placed.x - placed.screen.widthM, placed.x + placed.screen.widthM);
      zs.push(placed.z - 1, placed.z + 1);
    }
  }
  for (const prop of props) {
    xs.push(prop.x - 2, prop.x + 2);
    zs.push(prop.z - 2, prop.z + 2);
  }
  for (const distro of distros) {
    xs.push(distro.x - 1, distro.x + 1);
    zs.push(distro.z - 1, distro.z + 1);
  }
  if (mains) {
    xs.push(mains.x - 1, mains.x + 1);
    zs.push(mains.z - 1, mains.z + 1);
  }
  if (xs.length === 0) {
    xs.push(-10, 10);
    zs.push(-5, 20);
  }
  const margin = 3;
  return {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minZ: Math.min(...zs) - margin,
    maxZ: Math.max(...zs) + margin,
  };
}
