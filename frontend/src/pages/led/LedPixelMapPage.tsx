import { Alert, Card, Checkbox, Col, ColorPicker, Empty, Flex, Row, Slider, Space, Statistic, Typography, theme } from 'antd';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CutHint, CutToolButton } from './components/PixelMapCutBar';
import { MergeHint, MergeToolButton } from './components/PixelMapMergeBar';
import { PixelMapCanvas } from './components/PixelMapCanvas';
import { cutoutsFromCells, cutCells } from './core/cutCells';
import { groupLabelInfo, mergeScreens, splitGroup } from './core/pixelGroups';
import { totalArea } from './core/pixelMap';
import { usePixelMap } from './usePixelMap';
import { useLedJob } from './useLedJob';

/**
 * Pixel Map: where each screen sits in the media server's composition. Panelyze's canvas, cut tool and merge tool
 * came over as they were — the drawing is the part that took the longest to get right there, and it is pure
 * geometry over the screens the job already has.
 *
 * Cutting a panel out here is not only a drawing: the cut-outs travel with the screen into the calculation, the
 * loading plan and the transfer to a job, so a wall with a hole in it is costed and packed as a wall with a hole.
 */
export function LedPixelMapPage() {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { job, walls, nameOf, update } = useLedJob();
  const { state, setState, screens, groups, move, setView, setLayout, reset } = usePixelMap(walls, nameOf);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'move' | 'cut' | 'merge'>('move');
  const [picked, setPicked] = useState<Map<string, Set<number>>>(new Map());
  const [mergePicked, setMergePicked] = useState<Set<string>>(new Set());
  const [cutError, setCutError] = useState<'all' | 'tooMany' | null>(null);

  const area = useMemo(() => totalArea(screens), [screens]);

  /** Groups as the canvas draws them: the outline, one label and whether the group shows a logo. */
  const drawGroups = useMemo(
    () =>
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        logo: g.logo,
        members: g.members,
        x: g.x,
        y: g.y,
        width: g.width,
        height: g.height,
        info: groupLabelInfo(g, (key, vars) => String(t(key, vars as never)), 'tr'),
      })),
    [groups, t],
  );

  const applyCuts = useCallback(() => {
    for (const [screenId, cells] of picked) {
      const wall = walls.find((w) => w.id === screenId);
      if (!wall) continue;
      const kept = cutCells(wall.widthPanels, wall.heightPanels, wall.cutouts);
      for (const cell of cells) kept.add(cell);
      if (kept.size >= wall.widthPanels * wall.heightPanels) {
        setCutError('all');
        return;
      }

      update(screenId, { cutouts: cutoutsFromCells(wall.widthPanels, wall.heightPanels, kept) });
    }

    setPicked(new Map());
    setCutError(null);
  }, [picked, walls, update]);

  const restoreCuts = useCallback(() => {
    for (const [screenId, cells] of picked) {
      const wall = walls.find((w) => w.id === screenId);
      if (!wall) continue;
      const kept = cutCells(wall.widthPanels, wall.heightPanels, wall.cutouts);
      for (const cell of cells) kept.delete(cell);
      update(screenId, { cutouts: kept.size > 0 ? cutoutsFromCells(wall.widthPanels, wall.heightPanels, kept) : undefined });
    }

    setPicked(new Map());
    setCutError(null);
  }, [picked, walls, update]);

  const onPick = useCallback((picks: { id: string; cells: number[] }[], pickMode: 'toggle' | 'add') => {
    setPicked((current) => {
      const next = new Map(current);
      for (const pick of picks) {
        const cells = new Set(next.get(pick.id) ?? []);
        for (const cell of pick.cells) {
          if (pickMode === 'add') cells.add(cell);
          else if (cells.has(cell)) cells.delete(cell);
          else cells.add(cell);
        }

        if (cells.size > 0) next.set(pick.id, cells);
        else next.delete(pick.id);
      }

      return next;
    });
  }, []);

  const toggleMerge = useCallback((id: string) => {
    setMergePicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const doMerge = useCallback(() => {
    const members = [...mergePicked];
    if (members.length < 2) return;
    const merged = mergeScreens(
      state.groups,
      members,
      state.order,
      { id: `g${Date.now().toString(36)}`, name: t('led.pixel.mergedName') },
      (id) => state.layouts[id]?.logo ?? false,
    );
    if (merged) setState((s) => ({ ...s, groups: merged }));
    setMergePicked(new Set());
    setMode('move');
  }, [mergePicked, state, setState, t]);

  const selected = screens.find((s) => s.id === selectedId) ?? null;
  const selectedLayout = selectedId ? state.layouts[selectedId] : undefined;
  const selectedGroup = groups.find((g) => g.members.includes(selectedId ?? ''));

  if (job.screens.length === 0) {
    return (
      <>
        <Typography.Title level={3} style={{ marginTop: 0 }}>{t('led.pixelMapTitle')}</Typography.Title>
        <Card><Empty description={t('led.noScreensForPixelMap')} /></Card>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('led.pixelMapTitle')}</Typography.Title>
        <Space size="large" wrap>
          <Statistic title={t('led.canvasSize')} value={`${area.width} × ${area.height}`} suffix="px" valueStyle={{ fontSize: 18 }} />
          <Statistic title={t('led.screens')} value={screens.length} valueStyle={{ fontSize: 18 }} />
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        <Col xs={24} xl={18}>
          <Card size="small" styles={{ body: { padding: 0, height: 560 } }}>
            <PixelMapCanvas
              screens={screens}
              view={state.view}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onMove={move}
              accentColor={token.colorPrimary}
              groups={drawGroups}
              cutting={
                mode === 'cut'
                  ? {
                      picked,
                      onPick,
                      onClear: () => {
                        setPicked(new Map());
                        setCutError(null);
                      },
                    }
                  : null
              }
              merging={mode === 'merge' ? { picked: mergePicked, onToggle: toggleMerge } : null}
              toolbar={
                <Space size={6}>
                  <CutToolButton
                    active={mode === 'cut'}
                    locked={false}
                    onToggle={() => {
                      setMode((m) => (m === 'cut' ? 'move' : 'cut'));
                      setPicked(new Map());
                      setCutError(null);
                    }}
                  />
                  <MergeToolButton
                    active={mode === 'merge'}
                    disabled={false}
                    count={mergePicked.size}
                    onToggle={() => {
                      setMode((m) => (m === 'merge' ? 'move' : 'merge'));
                      setMergePicked(new Set());
                    }}
                  />
                </Space>
              }
              toolbarNote={
                mode === 'cut' ? (
                  <CutHint pickedCount={[...picked.values()].reduce((sum, c) => sum + c.size, 0)} error={cutError} />
                ) : mode === 'merge' ? (
                  <MergeHint count={mergePicked.size} onCancel={() => setMergePicked(new Set())} />
                ) : null
              }
            />
          </Card>

          {mode === 'merge' && mergePicked.size >= 2 && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message={t('led.pixel.mergeReady', { count: mergePicked.size })}
              action={<a onClick={doMerge}>{t('led.pixel.merge')}</a>}
            />
          )}

          {mode === 'cut' && (
            <Alert
              type="info"
              showIcon
              style={{ marginTop: 8 }}
              message={t('led.pixel.cutActions')}
              action={
                <Space>
                  <a onClick={applyCuts}>{t('led.pixel.cutApply')}</a>
                  <a onClick={restoreCuts}>{t('led.pixel.cutRestore')}</a>
                </Space>
              }
            />
          )}
        </Col>

        <Col xs={24} xl={6}>
          <Card size="small" title={t('led.mapView')}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Checkbox checked={state.view.showModuleBorders} onChange={(e) => setView({ showModuleBorders: e.target.checked })}>
                {t('led.pixel.moduleBorders')}
              </Checkbox>
              <Checkbox checked={state.view.showDiagonals} onChange={(e) => setView({ showDiagonals: e.target.checked })}>
                {t('led.pixel.diagonals')}
              </Checkbox>
              <Checkbox checked={state.view.showCenterCross} onChange={(e) => setView({ showCenterCross: e.target.checked })}>
                {t('led.pixel.centerCross')}
              </Checkbox>
              <div>
                <Typography.Text type="secondary">{t('led.pixel.labelScale')}</Typography.Text>
                <Slider min={0.5} max={2} step={0.1} value={state.view.labelScale} onChange={(v) => setView({ labelScale: v })} />
              </div>
            </Space>
          </Card>

          <Card size="small" title={t('led.selectedScreen')} style={{ marginTop: 12 }}>
            {selected ? (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Typography.Text strong>{selected.name}</Typography.Text>
                <Typography.Text type="secondary">
                  {selected.width} × {selected.height} px · {t('led.atPosition', { x: selected.x, y: selected.y })}
                </Typography.Text>
                {selectedLayout && (
                  <>
                    <Flex gap={8} align="center">
                      <Typography.Text type="secondary">{t('led.pixel.color')}</Typography.Text>
                      <ColorPicker
                        value={selectedLayout.color}
                        onChangeComplete={(c) => setLayout(selected.id, { color: c.toHexString() })}
                      />
                    </Flex>
                    <Checkbox checked={selectedLayout.panelNo} onChange={(e) => setLayout(selected.id, { panelNo: e.target.checked })}>
                      {t('led.pixel.panelNo')}
                    </Checkbox>
                    <Checkbox checked={selectedLayout.tip} onChange={(e) => setLayout(selected.id, { tip: e.target.checked })}>
                      {t('led.pixel.showType')}
                    </Checkbox>
                  </>
                )}
                {selectedGroup && (
                  <a onClick={() => setState((s) => ({ ...s, groups: splitGroup(s.groups, selectedGroup.id) }))}>
                    {t('led.pixel.split')}
                  </a>
                )}
              </Space>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('led.pickScreenOnMap')} />
            )}
          </Card>

          <Card size="small" style={{ marginTop: 12 }}>
            <a onClick={reset}>{t('led.pixel.resetMap')}</a>
          </Card>
        </Col>
      </Row>
    </>
  );
}
