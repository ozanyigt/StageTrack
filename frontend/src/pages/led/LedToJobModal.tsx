import { Alert, Checkbox, Input, Modal, Select, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ledApi, projectApi } from '../../api/endpoints';
import type { EvaluateResponse, EvaluateScreenRequest, LedJobLine, LedToJobInput } from '../../api/ledTypes';
import { useErrorToast } from '../../utils/errors';

interface Props {
  open: boolean;
  screens: EvaluateScreenRequest[];
  evaluation?: EvaluateResponse;
  onClose: () => void;
}

/**
 * Turns the calculated screens into planned equipment on a job. What the panels come to is worked out on the
 * server, so the preview shown here is exactly what will be planned; the processors and extenders are the
 * options the calculation selected for each screen.
 */
export function LedToJobModal({ open, screens, evaluation, onClose }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [projectId, setProjectId] = useState<string>();
  const [sectionName, setSectionName] = useState('');
  const [append, setAppend] = useState(false);

  useEffect(() => {
    if (open) {
      setSectionName(t('led.jobSectionDefault'));
      setAppend(false);
    }
  }, [open, t]);

  const projects = useQuery({
    queryKey: ['projects', 'led-transfer'],
    queryFn: () => projectApi.list({ statuses: ['Draft', 'Pending', 'Confirmed'], maxResultCount: 200, sorting: 'planStart' }),
    enabled: open,
  });

  /** The devices the calculation picked, summed over the screens (two screens may share a processor model). */
  const devices = useMemo(() => {
    const processors = new Map<string, number>();
    const extenders = new Map<string, number>();
    for (const screen of evaluation?.screens ?? []) {
      const option = screen.processor?.options[screen.processor.selectedIndex];
      if (!option) continue;
      processors.set(option.processorId, (processors.get(option.processorId) ?? 0) + option.units);
      if (option.extenderId && option.extenderUnits > 0) {
        extenders.set(option.extenderId, (extenders.get(option.extenderId) ?? 0) + option.extenderUnits);
      }
    }
    return {
      processors: [...processors].map(([equipmentId, count]) => ({ equipmentId, count })),
      extenders: [...extenders].map(([equipmentId, count]) => ({ equipmentId, count })),
    };
  }, [evaluation]);

  const input: LedToJobInput = useMemo(
    () => ({
      screens: screens.map((s) => ({
        id: s.id,
        equipmentId: s.panelModelId ?? null,
        stockLocationId: null,
        columns: s.columns,
        rows: s.rows,
        cutouts: s.cutouts ?? null,
        corners: s.corners?.map((c) => ({ afterColumn: c.afterColumn, equipmentId: c.panelModelId, stockLocationId: null })) ?? null,
      })),
      processors: devices.processors,
      extenders: devices.extenders,
      sectionName: sectionName.trim() || undefined,
      append,
    }),
    [screens, devices, sectionName, append],
  );

  const preview = useQuery({
    queryKey: ['led-transfer-preview', projectId, input],
    queryFn: () => ledApi.previewJob(projectId!, input),
    enabled: open && !!projectId,
  });

  const transfer = useMutation({
    mutationFn: () => ledApi.transferToJob(projectId!, input),
    onSuccess: onClose,
    onError: showError,
  });

  const lines: LedJobLine[] = preview.data?.lines ?? [];
  const problems = lines.filter((l) => l.problem);

  return (
    <Modal
      open={open}
      title={t('led.transferToJob')}
      okText={t('led.transfer')}
      cancelText={t('common.cancel')}
      onCancel={onClose}
      onOk={() => transfer.mutate()}
      okButtonProps={{ disabled: !projectId || lines.length === 0, loading: transfer.isPending }}
      width={720}
      destroyOnHidden
    >
      <Select
        showSearch
        optionFilterProp="label"
        style={{ width: '100%', marginBottom: 12 }}
        placeholder={t('led.pickJob')}
        value={projectId}
        loading={projects.isFetching}
        onChange={setProjectId}
        options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: `${p.number} · ${p.name}` }))}
      />

      <Input
        style={{ marginBottom: 8 }}
        addonBefore={t('led.jobSection')}
        value={sectionName}
        onChange={(e) => setSectionName(e.target.value)}
        maxLength={128}
      />
      <Checkbox checked={append} onChange={(e) => setAppend(e.target.checked)} style={{ marginBottom: 12 }}>
        {t('led.appendToSection')}
      </Checkbox>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {t(append ? 'led.appendHint' : 'led.replaceHint')}
      </Typography.Paragraph>

      {problems.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('led.transferProblems', { count: problems.length })}
        />
      )}

      <Table
        size="small"
        rowKey={(r) => `${r.source}-${r.equipmentId}`}
        loading={preview.isFetching}
        dataSource={lines}
        pagination={false}
        locale={{ emptyText: projectId ? t('led.transferEmpty') : t('led.pickJobFirst') }}
        columns={[
          { title: t('led.lineSource'), dataIndex: 'source', width: 110, render: (v: string) => t(`enums.ledJobLineSource.${v}`) },
          { title: t('equipment.code'), dataIndex: 'code', width: 130 },
          { title: t('equipment.name'), dataIndex: 'name' },
          { title: t('led.quantity'), dataIndex: 'quantity', width: 90, align: 'end' },
          {
            title: '',
            width: 160,
            render: (_: unknown, r: LedJobLine) =>
              r.problem ? <Tag color="red">{t(`errors.${r.problem}`, { defaultValue: r.problem })}</Tag> : null,
          },
        ]}
      />
    </Modal>
  );
}
