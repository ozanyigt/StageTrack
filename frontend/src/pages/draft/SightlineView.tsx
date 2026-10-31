import { useTranslation } from 'react-i18next';
import type { SightCell, SightResult, SightScreen, SightVerdict } from './sightlines';

const COLOUR: Record<SightVerdict, string> = {
  Good: '#16a34a',
  TooClose: '#f59e0b',
  TooFar: '#64748b',
  TooSteep: '#d97706',
  Blocked: '#dc2626',
};

interface Props {
  result: SightResult;
  screens: SightScreen[];
  podium: { width: number; depth: number; front: number; back: number };
  room: { minX: number; maxX: number; minZ: number; maxZ: number } | null;
}

/**
 * The hall from above, every square metre of it coloured by what can be seen from there. Green is a seat that
 * sees a screen properly; the other colours each say why not, because "no" is not an answer a client accepts and
 * "too steep on the left wing" is something a designer can fix in a minute.
 */
export function SightlineView({ result, screens, podium, room }: Props) {
  const { t } = useTranslation();

  const minX = room?.minX ?? -podium.width;
  const maxX = room?.maxX ?? podium.width;
  const minZ = room?.minZ ?? podium.back - 2;
  const maxZ = room?.maxZ ?? podium.front + 30;

  return (
    <svg
      viewBox={`${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`}
      style={{ width: '100%', height: 480, background: '#0a0a0a', borderRadius: 6, display: 'block' }}
      role="img"
      aria-label={t('draft.sightlines')}
    >
      {result.cells.map((cell: SightCell, index) => (
        <rect
          key={index}
          x={cell.x - result.cellM / 2}
          y={cell.z - result.cellM / 2}
          width={result.cellM}
          height={result.cellM}
          fill={COLOUR[cell.verdict]}
          fillOpacity={cell.verdict === 'Good' ? 0.45 : 0.4}
        />
      ))}

      {/* The deck, so the picture is read the right way up. */}
      <rect
        x={-podium.width / 2}
        y={podium.back}
        width={podium.width}
        height={podium.depth}
        fill="#1c1c1f"
        stroke="#52525b"
        strokeWidth="0.08"
      />

      {screens.map((screen) => {
        const facing = (screen.rotationDeg * Math.PI) / 180;
        // The face drawn as a line across the screen's width, turned the way it faces.
        const half = screen.widthM / 2;
        const ax = screen.x - Math.cos(facing) * half;
        const az = screen.z + Math.sin(facing) * half;
        const bx = screen.x + Math.cos(facing) * half;
        const bz = screen.z - Math.sin(facing) * half;
        return <line key={screen.id} x1={ax} y1={az} x2={bx} y2={bz} stroke="#a78bfa" strokeWidth="0.3" strokeLinecap="round" />;
      })}

      {room && (
        <rect
          x={room.minX}
          y={room.minZ}
          width={room.maxX - room.minX}
          height={room.maxZ - room.minZ}
          fill="none"
          stroke="#3f3f46"
          strokeWidth="0.15"
        />
      )}
    </svg>
  );
}

export const VERDICT_COLOUR = COLOUR;
