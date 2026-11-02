import { useTranslation } from 'react-i18next';
import { TRADE_COLOR } from './stageProps';
import type { EquipmentDiscipline } from '../../api/types';

export interface CoverageItem {
  id: string;
  label: string;
  trade: EquipmentDiscipline;
  /** Metres, the same floor the 3D stage uses: x across, z towards the audience. */
  x: number;
  z: number;
  /** Where it faces; 0 points at the audience. */
  rotationDeg: number;
  /** How wide it throws. A light at 0 draws a circle under itself instead of a wedge. */
  spreadDeg: number;
  /** How far it reaches, metres. */
  throwM: number;
  count: number;
}

interface Props {
  podium: { width: number; depth: number };
  items: CoverageItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * The stage from above with what each group covers drawn on it. This is the question a plan is read for - which
 * part of the audience hears the mains, which corner of the deck nobody lit - and it is answerable from the
 * places the designer already set on the 3D stage plus one angle and one distance per group.
 *
 * It is not an acoustic or photometric model and does not pretend to be: there is no dispersion data in an
 * inventory. What it is, is honest about where things point and how far they reach.
 */
export function CoverageView({ podium, items, selectedId, onSelect }: Props) {
  const { t } = useTranslation();

  // The drawing covers the deck plus the audience in front of it, with room for whatever reaches furthest.
  const reach = Math.max(8, ...items.map((i) => Math.abs(i.z) + i.throwM), podium.depth + 6);
  const halfWidth = Math.max(podium.width / 2 + 4, ...items.map((i) => Math.abs(i.x) + i.throwM / 2));
  const minX = -halfWidth;
  const minZ = -podium.depth / 2 - 3;
  const width = halfWidth * 2;
  const height = reach - minZ;

  return (
    <svg
      viewBox={`${minX} ${minZ} ${width} ${height}`}
      style={{ width: '100%', height: 460, background: '#0a0a0a', borderRadius: 6, display: 'block' }}
      role="img"
      aria-label={t('draft.coverage')}
    >
      {/* A metre grid, so distances can be read off the picture. */}
      <defs>
        <pattern id="coverage-grid" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="#232326" strokeWidth="0.02" />
        </pattern>
      </defs>
      <rect x={minX} y={minZ} width={width} height={height} fill="url(#coverage-grid)" />

      {/* The deck, with the audience in front of it (towards +z). */}
      <rect
        x={-podium.width / 2}
        y={-podium.depth / 2}
        width={podium.width}
        height={podium.depth}
        fill="#1c1c1f"
        stroke="#52525b"
        strokeWidth="0.05"
      />
      <text x={0} y={-podium.depth / 2 - 0.5} fill="#71717a" fontSize="0.7" textAnchor="middle">
        {t('draft.stageArea')}
      </text>
      <text x={0} y={reach - 0.6} fill="#71717a" fontSize="0.8" textAnchor="middle">
        {t('draft.audienceArea')}
      </text>

      {items.map((item) => {
        const colour = TRADE_COLOR[item.trade];
        const selected = item.id === selectedId;
        return (
          <g key={item.id} onClick={() => onSelect(item.id)} style={{ cursor: 'pointer' }}>
            {item.spreadDeg > 0 ? (
              <path
                d={wedge(item)}
                fill={colour}
                fillOpacity={selected ? 0.3 : 0.16}
                stroke={colour}
                strokeOpacity={selected ? 0.8 : 0.35}
                strokeWidth="0.04"
              />
            ) : (
              <circle
                cx={item.x}
                cy={item.z}
                r={item.throwM}
                fill={colour}
                fillOpacity={selected ? 0.3 : 0.16}
                stroke={colour}
                strokeOpacity={selected ? 0.8 : 0.35}
                strokeWidth="0.04"
              />
            )}
            <circle cx={item.x} cy={item.z} r={0.22} fill={colour} />
            <text x={item.x} y={item.z - 0.45} fill="#e4e4e7" fontSize="0.55" textAnchor="middle">
              {item.label} {item.count > 1 ? `×${item.count}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** The covered wedge: from the group, `spreadDeg` wide, `throwM` long, turned the way it faces. */
function wedge(item: CoverageItem): string {
  const half = (item.spreadDeg / 2) * (Math.PI / 180);
  // 0° faces the audience (+z); the same convention the 3D stage turns things by.
  const facing = (item.rotationDeg * Math.PI) / 180 + Math.PI / 2;
  const a = facing - half;
  const b = facing + half;
  const ax = item.x + Math.cos(a) * item.throwM;
  const az = item.z + Math.sin(a) * item.throwM;
  const bx = item.x + Math.cos(b) * item.throwM;
  const bz = item.z + Math.sin(b) * item.throwM;
  const large = item.spreadDeg > 180 ? 1 : 0;
  return `M ${item.x} ${item.z} L ${ax} ${az} A ${item.throwM} ${item.throwM} 0 ${large} 1 ${bx} ${bz} Z`;
}
