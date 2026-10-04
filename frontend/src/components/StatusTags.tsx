import { Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ProjectStatus, QuoteStatus, UnitStatus } from '../api/types';

export const projectStatusColor: Record<ProjectStatus, string> = {
  Draft: 'default',
  Pending: 'gold',
  Confirmed: 'blue',
  Prepped: 'cyan',
  OnLocation: 'purple',
  Returned: 'green',
  Cancelled: 'red',
};

const quoteStatusColor: Record<QuoteStatus, string> = {
  Draft: 'default',
  Sent: 'blue',
  Accepted: 'green',
  Rejected: 'red',
  Superseded: 'default',
};

const unitStatusColor: Record<UnitStatus, string> = {
  InStock: 'green',
  OnProject: 'purple',
  InRepair: 'orange',
  Lost: 'red',
};

export function ProjectStatusTag({ status }: { status: ProjectStatus }) {
  const { t } = useTranslation();
  return <Tag color={projectStatusColor[status]}>{t(`enums.projectStatus.${status}`)}</Tag>;
}

export function QuoteStatusTag({ status }: { status: QuoteStatus }) {
  const { t } = useTranslation();
  return <Tag color={quoteStatusColor[status]}>{t(`enums.quoteStatus.${status}`)}</Tag>;
}

export function UnitStatusTag({ status }: { status: UnitStatus }) {
  const { t } = useTranslation();
  return <Tag color={unitStatusColor[status]}>{t(`enums.unitStatus.${status}`)}</Tag>;
}
