import { ExportOutlined } from '@ant-design/icons';
import { Button, Space, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useParams } from 'react-router-dom';
import type { EquipmentDiscipline } from '../../api/types';
import { Permissions, useAuth } from '../../auth/AuthContext';
import { LedDesignPage } from '../led/LedDesignPage';
import { LedToJobModal } from '../led/LedToJobModal';
import { useLedJob } from '../led/useLedJob';
import { DisciplineDesign } from './DisciplineDesign';

/** The URL says the trade, so every door is a link a user can keep, and the back button works between them. */
const BY_PATH: Record<string, EquipmentDiscipline> = {
  led: 'Led',
  sound: 'Sound',
  light: 'Light',
  truss: 'Truss',
  scaff: 'Scaff',
};

export const DESIGN_PATHS = Object.keys(BY_PATH);

/**
 * One design screen per trade, behind five doors in the menu. LED keeps its own designer - a wall is drawn, and
 * the server answers with panels, circuits and processors. The other four are chosen rather than drawn, so they
 * share one list. Both write into the same job, which is what the power, stock, 3D and quote screens read.
 */
export function DesignPage() {
  const { t } = useTranslation();
  const { can } = useAuth();
  const { discipline: path } = useParams<{ discipline?: string }>();
  const discipline = path ? BY_PATH[path] : undefined;
  const { job, addLine, updateLine, removeLine } = useLedJob();
  const [transferOpen, setTransferOpen] = useState(false);

  if (!discipline) {
    return <Navigate to="/draft/design/led" replace />;
  }

  if (discipline === 'Led') {
    return <LedDesignPage />;
  }

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t('draft.designTitle', { trade: t(`enums.equipmentDiscipline.${discipline}`) })}
        </Typography.Title>
        {/* The draft goes over as a whole - screens and every trade's groups - from whichever door it is sent. */}
        {can(Permissions.LedQuote) && (
          <Space>
            <Button
              icon={<ExportOutlined />}
              disabled={job.lines.every((l) => !l.equipmentId) && job.screens.length === 0}
              onClick={() => setTransferOpen(true)}
            >
              {t('led.transferToJob')}
            </Button>
          </Space>
        )}
      </div>

      <LedToJobModal open={transferOpen} screens={[]} onClose={() => setTransferOpen(false)} />

      <DisciplineDesign
        discipline={discipline}
        lines={job.lines.filter((l) => l.discipline === discipline)}
        onAdd={() => addLine(discipline)}
        onChange={updateLine}
        onRemove={removeLine}
      />
    </>
  );
}
