import { App, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { quoteApi } from '../../api/endpoints';
import type { Quote, QuoteStatus } from '../../api/types';
import { QuoteStatusTag } from '../../components/StatusTags';
import { useErrorToast } from '../../utils/errors';

const REASON_KEYS = ['price', 'dates', 'competitor', 'cancelled', 'budget'] as const;

/**
 * Quote status as a drop-down (list and editor): Accepted asks for confirmation (the job moves to Projects),
 * Rejected asks for the reason (the job is cancelled when no other revision is open).
 */
export function QuoteStatusControl({
  quoteId,
  status,
  allowedStatuses,
  disabled,
  size = 'middle',
  onChanged,
}: {
  quoteId: string;
  status: QuoteStatus;
  allowedStatuses: QuoteStatus[];
  disabled?: boolean;
  size?: 'small' | 'middle';
  onChanged?: (quote: Quote) => void;
}) {
  const { t } = useTranslation();
  const { modal, message } = App.useApp();
  const showError = useErrorToast();
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const change = useMutation({
    mutationFn: ({ to, why }: { to: QuoteStatus; why?: string }) => quoteApi.changeStatus(quoteId, to, why),
    onSuccess: (u) => {
      setRejectOpen(false);
      queryClient.setQueryData(['quote', quoteId], u);
      queryClient.invalidateQueries({ queryKey: ['quote-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', u.projectId] });
      if (u.status === 'Accepted') message.success(t('salesJobs.acceptedMoved', { number: u.projectNumber }));
      if (u.status === 'Rejected' && u.projectStatus === 'Cancelled') message.info(t('salesJobs.rejectedCancelled'));
      onChanged?.(u);
    },
    onError: showError,
  });

  const pick = (to: QuoteStatus) => {
    if (to === status) return;
    if (to === 'Rejected') {
      setReason('');
      setRejectOpen(true);
    } else if (to === 'Accepted') {
      modal.confirm({
        title: t('salesJobs.acceptConfirmTitle'),
        content: t('salesJobs.acceptConfirm'),
        okText: t('quotes.markAccepted'),
        cancelText: t('common.cancel'),
        onOk: () => change.mutateAsync({ to }),
      });
    } else {
      change.mutate({ to });
    }
  };

  const options = [status, ...allowedStatuses.filter((s) => s !== status)].map((s) => ({
    value: s,
    label: <QuoteStatusTag status={s} />,
  }));

  return (
    <>
      <Select
        size={size}
        variant="borderless"
        value={status}
        options={options}
        loading={change.isPending}
        disabled={disabled || allowedStatuses.length === 0}
        onChange={pick}
        onClick={(e) => e.stopPropagation()}
        popupMatchSelectWidth={false}
        style={{ minWidth: 120 }}
        aria-label={t('quotes.status')}
      />
      <Modal
        open={rejectOpen}
        title={t('salesJobs.rejectTitle')}
        onCancel={() => setRejectOpen(false)}
        onOk={() => change.mutate({ to: 'Rejected', why: reason.trim() || undefined })}
        okText={t('quotes.markRejected')}
        okButtonProps={{ danger: true, loading: change.isPending }}
        cancelText={t('common.cancel')}
        destroyOnHidden
      >
        <div onClick={(e) => e.stopPropagation()}>
          <Typography.Paragraph type="secondary">{t('salesJobs.rejectHelp')}</Typography.Paragraph>
          <Space wrap style={{ marginBottom: 8 }}>
            {REASON_KEYS.map((k) => (
              <Tag.CheckableTag key={k} checked={reason === t(`salesJobs.reasons.${k}`)} onChange={() => setReason(t(`salesJobs.reasons.${k}`))}>
                {t(`salesJobs.reasons.${k}`)}
              </Tag.CheckableTag>
            ))}
          </Space>
          <Input.TextArea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} autoSize={{ minRows: 2 }}
            placeholder={t('salesJobs.reasonPlaceholder')} />
        </div>
      </Modal>
    </>
  );
}
