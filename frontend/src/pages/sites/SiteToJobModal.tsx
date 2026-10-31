import { Alert, Checkbox, Input, Modal, Select, Table, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sitePlanApi } from '../../api/endpoints';
import type { SitePlan, SiteToJobLine, SiteToJobResult } from '../../api/siteTypes';
import { useErrorToast } from '../../utils/errors';

interface Props {
  open: boolean;
  plan: SitePlan;
  onClose: () => void;
  onTransferred: (result: SiteToJobResult) => void;
}

/**
 * Turns the plan into planned equipment on its job. The job is not chosen here — a site plan already belongs to
 * one — so the only decisions left are which layers go over and whether this replaces what was sent before.
 */
export function SiteToJobModal({ open, plan, onClose, onTransferred }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [sectionName, setSectionName] = useState(plan.name);
  const [append, setAppend] = useState(false);
  const [layers, setLayers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      setSectionName(plan.name);
      setAppend(false);
      setLayers([]);
    }
  }, [open, plan.name]);

  const input = useMemo(
    () => ({ sectionName: sectionName.trim() || undefined, append, layers }),
    [sectionName, append, layers],
  );

  const preview = useQuery({
    queryKey: ['site-transfer-preview', plan.id, input, plan.items.length],
    queryFn: () => sitePlanApi.previewJob(plan.id, input),
    enabled: open,
  });

  const transfer = useMutation({
    mutationFn: () => sitePlanApi.transferToJob(plan.id, input),
    onSuccess: onTransferred,
    onError: showError,
  });

  const lines = preview.data?.lines ?? [];
  const problems = lines.filter((l) => l.problem);
  const short = lines.filter((l) => !l.problem && l.quantity > l.stock);

  return (
    <Modal
      open={open}
      title={t('site.transferToJob')}
      okText={t('site.transfer')}
      cancelText={t('common.cancel')}
      onCancel={onClose}
      onOk={() => transfer.mutate()}
      okButtonProps={{ disabled: lines.length === 0, loading: transfer.isPending }}
      width={720}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        {t('site.transferHint', { number: plan.projectNumber, name: plan.projectName })}
      </Typography.Paragraph>

      <Select
        mode="multiple"
        allowClear
        style={{ width: '100%', marginBottom: 8 }}
        placeholder={t('site.allLayers')}
        value={layers}
        onChange={setLayers}
        options={plan.layers.map((l) => ({ value: l, label: t(`site.layer.${l}`, { defaultValue: l }) }))}
      />
      <Input
        style={{ marginBottom: 8 }}
        addonBefore={t('site.section')}
        value={sectionName}
        onChange={(e) => setSectionName(e.target.value)}
        maxLength={128}
      />
      <Checkbox checked={append} onChange={(e) => setAppend(e.target.checked)} style={{ marginBottom: 12 }}>
        {t('site.appendToSection')}
      </Checkbox>

      {problems.length > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t('site.transferProblems', { count: problems.length })} />
      )}
      {short.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message={t('site.transferShortage', { codes: short.map((l) => l.code).join(', ') })}
        />
      )}

      <Table
        size="small"
        rowKey="equipmentId"
        loading={preview.isFetching}
        dataSource={lines}
        pagination={false}
        locale={{ emptyText: t('site.transferEmpty') }}
        columns={[
          { title: t('equipment.code'), dataIndex: 'code', width: 130 },
          { title: t('equipment.name'), dataIndex: 'name' },
          { title: t('site.quantity'), dataIndex: 'quantity', width: 80, align: 'end' },
          {
            title: t('site.stock'),
            width: 90,
            align: 'end',
            render: (_: unknown, l: SiteToJobLine) =>
              l.quantity > l.stock ? <Tag color="orange">{l.stock}</Tag> : l.stock,
          },
          {
            title: '',
            width: 150,
            render: (_: unknown, l: SiteToJobLine) =>
              l.problem ? <Tag color="red">{t(`errors.${l.problem}`, { defaultValue: l.problem })}</Tag> : null,
          },
        ]}
      />
    </Modal>
  );
}
