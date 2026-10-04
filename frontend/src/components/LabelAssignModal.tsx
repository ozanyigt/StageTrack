import { Alert, Form, Modal, Select, Tag, Typography } from 'antd';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { labelApi, unitApi } from '../api/endpoints';
import { LABEL_TYPES, type EquipmentLookup, type Label, type LabelType } from '../api/types';
import { useErrorToast } from '../utils/errors';
import { EquipmentSelect } from './Selects';

interface Props {
  code: string | null;
  onClose: () => void;
  onAssigned: (label: Label) => void;
}

/**
 * Links a label that the system does not know yet (typically an existing Rentman QR) to a device.
 * Devices without any label are listed first, because those are the ones waiting for their sticker.
 */
export function LabelAssignModal({ code, onClose, onAssigned }: Props) {
  const { t } = useTranslation();
  const showError = useErrorToast();
  const [equipment, setEquipment] = useState<EquipmentLookup>();
  const [unitId, setUnitId] = useState<string>();
  const [type, setType] = useState<LabelType>('RentmanQr');

  useEffect(() => {
    if (code) {
      setEquipment(undefined);
      setUnitId(undefined);
      setType('RentmanQr');
    }
  }, [code]);

  const units = useQuery({
    queryKey: ['units-for-label', equipment?.id],
    queryFn: () => unitApi.list({ equipmentId: equipment!.id, maxResultCount: 500 }),
    enabled: !!equipment?.isSerialized,
  });

  const assign = useMutation({
    mutationFn: () =>
      labelApi.assign({
        code: code!,
        type,
        equipmentId: equipment?.isSerialized ? null : equipment?.id,
        unitId: equipment?.isSerialized ? unitId : null,
      }),
    onSuccess: onAssigned,
    onError: showError,
  });

  const sortedUnits = [...(units.data?.items ?? [])].sort((a, b) => a.labelCount - b.labelCount || a.internalRef.localeCompare(b.internalRef));
  const canSave = !!equipment && (!equipment.isSerialized || !!unitId);

  return (
    <Modal
      open={!!code}
      title={t('labels.assignTitle')}
      okText={t('labels.assign')}
      cancelText={t('common.cancel')}
      onCancel={onClose}
      onOk={() => assign.mutate()}
      okButtonProps={{ disabled: !canSave, loading: assign.isPending }}
      destroyOnHidden
    >
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={t('labels.unknownLabel', { code })} description={t('labels.assignHint')} />
      <Form layout="vertical">
        <Form.Item label={t('labels.equipment')} required>
          <EquipmentSelect value={equipment?.id} onPick={(e) => { setEquipment(e); setUnitId(undefined); }} />
        </Form.Item>
        {equipment?.isSerialized && (
          <Form.Item label={t('labels.unit')} required>
            <Select
              showSearch
              loading={units.isLoading}
              value={unitId}
              onChange={setUnitId}
              optionFilterProp="label"
              options={sortedUnits.map((u) => ({
                value: u.id,
                label: `${u.internalRef}${u.serialNumber ? ` · ${u.serialNumber}` : ''}`,
                labelCount: u.labelCount,
              }))}
              optionRender={(option) => (
                <span>
                  {option.data.label}{' '}
                  {option.data.labelCount === 0 ? <Tag color="orange">{t('labels.noLabel')}</Tag> : <Tag>{t('labels.labelCount', { count: option.data.labelCount })}</Tag>}
                </span>
              )}
            />
          </Form.Item>
        )}
        {equipment && !equipment.isSerialized && (
          <Typography.Paragraph type="secondary">{t('labels.bulkHint')}</Typography.Paragraph>
        )}
        <Form.Item label={t('labels.type')}>
          <Select value={type} onChange={setType} options={LABEL_TYPES.map((v) => ({ value: v, label: t(`enums.labelType.${v}`) }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
