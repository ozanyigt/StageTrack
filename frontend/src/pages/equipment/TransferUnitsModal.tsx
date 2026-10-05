import { SwapOutlined } from '@ant-design/icons';
import { Alert, Button, Modal, Radio, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { unitApi } from '../../api/endpoints';
import type { TransferResult } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { useErrorToast } from '../../utils/errors';

/** True when the user may move devices to another location (company) they also work at. */
export function useCanTransfer() {
  const { can, user } = useAuth();
  return can(Permissions.EquipmentTransfer) && (user?.companies.length ?? 0) > 1;
}

/**
 * Moves the selected devices to another location (e.g. Staras TR → Staras Dubai). The devices, their
 * labels and their history go along; they arrive in the target's first warehouse.
 */
export function TransferUnitsModal({ unitIds, open, onClose, onDone }: { unitIds: string[]; open: boolean; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const showError = useErrorToast();
  const targets = (user?.companies ?? []).filter((c) => c.id !== company?.id);
  const [target, setTarget] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TransferResult | null>(null);

  const close = () => {
    setResult(null);
    setTarget(undefined);
    onClose();
  };

  const run = async () => {
    if (!target) return;
    setBusy(true);
    try {
      setResult(await unitApi.transfer(unitIds, target));
      onDone();
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('transfer.title', { count: unitIds.length })}
      onCancel={close}
      destroyOnHidden
      footer={
        result ? (
          <Button type="primary" onClick={close}>
            {t('common.close')}
          </Button>
        ) : (
          <Space>
            <Button onClick={close}>{t('common.cancel')}</Button>
            <Button type="primary" icon={<SwapOutlined />} disabled={!target} loading={busy} onClick={run}>
              {t('transfer.submit')}
            </Button>
          </Space>
        )
      }
    >
      {result ? (
        <Alert
          type="success"
          showIcon
          message={t('transfer.done', { count: result.unitCount, company: result.targetCompanyName, location: result.targetLocationName })}
        />
      ) : (
        <Space direction="vertical" style={{ width: '100%' }}>
          <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
            {t('transfer.hint', { from: company?.name })}
          </Typography.Paragraph>
          <Radio.Group value={target} onChange={(e) => setTarget(e.target.value)}>
            <Space direction="vertical">
              {targets.map((c) => (
                <Radio key={c.id} value={c.id}>
                  {c.name}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        </Space>
      )}
    </Modal>
  );
}
