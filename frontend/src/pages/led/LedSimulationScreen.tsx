import { Empty, Flex, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScreenEvaluationDto } from '../../api/ledTypes';
import { CHAIN_INK, chainColor, chainPattern, contrast, dashArray } from './core/simulation/chainStyle';
import { cutCells } from './core/cutCells';
import type { WallConfig } from './core/types';

type View = 'power' | 'signal';

/**
 * One screen's panels with every panel coloured by the circuit (or the data chain) it belongs to. The server
 * decides which panel goes on which circuit — this only paints its answer, which is why changing the wiring
 * direction here changes the CEE count on the power page too.
 *
 * Colour alone is not enough when a screen has a dozen circuits and some viewers cannot tell two of them apart,
 * so each chain also carries its number and its own dash pattern.
 */
export function LedSimulationScreen({ wall, evaluated, view, maxWidth = 640 }: {
  wall: WallConfig;
  evaluated?: ScreenEvaluationDto;
  view: View;
  maxWidth?: number;
}) {
  const { t } = useTranslation();
  const { token } = theme.useToken();

  const cut = useMemo(
    () => cutCells(wall.widthPanels, wall.heightPanels, wall.cutouts),
    [wall.widthPanels, wall.heightPanels, wall.cutouts],
  );

  /** cell → chain index, from whichever answer is being shown. */
  const chainOf = useMemo(() => {
    const map = new Map<number, number>();
    if (view === 'power') {
      for (const circuit of evaluated?.wiring?.circuits ?? []) {
        for (const cell of circuit.cells) map.set(cell, circuit.index);
      }
    } else {
      for (const port of evaluated?.signal?.ports ?? []) {
        for (const cell of port.cells) map.set(cell, port.index);
      }
    }

    return map;
  }, [view, evaluated]);

  const locked = view === 'power' ? evaluated?.wiring?.locked : evaluated?.signal?.locked;
  const tooLarge = view === 'power' ? evaluated?.wiring?.tooLarge : evaluated?.signal?.tooLarge;

  if (wall.widthPanels <= 0 || wall.heightPanels <= 0) return null;
  if (tooLarge) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('led.sim.tooLarge')} />;
  if (locked || chainOf.size === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t(view === 'power' ? 'led.sim.noWiring' : 'led.sim.noSignal')} />;
  }

  const panelW = wall.panel ? Number(wall.panel.Panel_Boyut.split('x')[0]) || 500 : 500;
  const panelH = wall.panel ? Number(wall.panel.Panel_Boyut.split('x')[1]) || 500 : 500;
  const ratio = (wall.widthPanels * panelW) / (wall.heightPanels * panelH);
  const width = Math.min(maxWidth, 640);
  const height = Math.max(60, Math.min(width / Math.max(0.2, ratio), 420));
  const cw = width / wall.widthPanels;
  const ch = height / wall.heightPanels;

  const chains = [...new Set(chainOf.values())].sort((a, b) => a - b);

  return (
    <div>
      <svg width={width} height={height} role="img" style={{ background: token.colorFillQuaternary, borderRadius: 6 }}>
        {Array.from({ length: wall.widthPanels }).flatMap((_, column) =>
          Array.from({ length: wall.heightPanels }).map((__, rowFromTop) => {
            // The server counts rows from the bottom; the drawing starts at the top.
            const row = wall.heightPanels - 1 - rowFromTop;
            const cell = column * wall.heightPanels + row;
            if (cut.has(cell)) {
              return (
                <rect
                  key={`${column}-${row}`}
                  x={column * cw}
                  y={rowFromTop * ch}
                  width={cw}
                  height={ch}
                  fill="none"
                  stroke={token.colorBorder}
                  strokeDasharray="3 2"
                />
              );
            }

            const chain = chainOf.get(cell);
            const color = chain === undefined ? token.colorFillSecondary : chainColor(chain);
            return (
              <g key={`${column}-${row}`}>
                <rect
                  x={column * cw}
                  y={rowFromTop * ch}
                  width={cw}
                  height={ch}
                  fill={color}
                  stroke={token.colorBgContainer}
                  strokeWidth={0.5}
                  strokeDasharray={chain === undefined ? undefined : dashArray(chainPattern(chain), 1)}
                />
                {chain !== undefined && cw > 14 && ch > 12 && (
                  <text
                    x={column * cw + cw / 2}
                    y={rowFromTop * ch + ch / 2}
                    fontSize={Math.min(11, ch * 0.6)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={contrast(color, CHAIN_INK) >= 3 ? CHAIN_INK : '#fff'}
                    pointerEvents="none"
                  >
                    {chain + 1}
                  </text>
                )}
              </g>
            );
          }),
        )}
      </svg>

      <Flex gap={6} wrap style={{ marginTop: 8 }}>
        {chains.map((chain) => (
          <Tooltip key={chain} title={t(view === 'power' ? 'led.sim.circuitNo' : 'led.sim.portNo', { n: chain + 1 })}>
            <Tag color={chainColor(chain)} style={{ color: CHAIN_INK }}>
              {chain + 1}
            </Tag>
          </Tooltip>
        ))}
      </Flex>

      {view === 'signal' && evaluated?.signal && (
        <Space size={8} wrap style={{ marginTop: 6 }}>
          <Typography.Text type="secondary">
            {t('led.sim.portsNeeded', { count: evaluated.signal.portsNeeded })}
          </Typography.Text>
          <Typography.Text type="secondary">
            {t('led.sim.pixelsPerPort', { count: evaluated.signal.pixelsPerPort.toLocaleString() })}
          </Typography.Text>
        </Space>
      )}
    </div>
  );
}
