import { MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Card, Flex, Input, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { crewApi } from '../../api/endpoints';
import type { CrewDirectoryEntry } from '../../api/types';
import { roleLabel } from '../../auth/AuthContext';
import { ExportButton } from '../../components/ExcelButtons';

/** Everyone working at this location with contact details; visible to every user. */
export function CrewDirectoryPage() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const { data = [], isLoading } = useQuery({ queryKey: ['crew-directory'], queryFn: crewApi.directory });

  const filtered = useMemo(() => {
    const q = text.trim().toLocaleLowerCase();
    if (!q) return data;
    return data.filter((c) =>
      [c.fullName, c.jobTitle, c.phone, c.email].some((v) => v?.toLocaleLowerCase().includes(q)),
    );
  }, [data, text]);

  return (
    <>
      <div className="page-header">
        <Typography.Title level={3}>{t('crew.title')}</Typography.Title>
        <ExportButton<CrewDirectoryEntry>
          fileName={t('crew.title')}
          load={async () => filtered}
          columns={[
            { header: t('crew.fullName'), value: (c) => c.fullName },
            { header: t('crew.jobTitle'), value: (c) => c.jobTitle },
            { header: t('crew.phone'), value: (c) => c.phone },
            { header: t('crew.email'), value: (c) => c.email },
            { header: t('crew.roles'), value: (c) => c.roles.map((r) => roleLabel(t, r)).join(', ') },
          ]}
        />
      </div>
      <Card size="small">
        <Input.Search
          allowClear
          placeholder={t('crew.searchPlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ maxWidth: 360, marginBottom: 12 }}
        />
        <Table
          size="small"
          rowKey="userId"
          loading={isLoading}
          dataSource={filtered}
          pagination={false}
          scroll={{ x: 700 }}
          columns={[
            {
              title: t('crew.fullName'),
              dataIndex: 'fullName',
              render: (v: string, c) => (
                <Flex align="center" gap={10}>
                  <Avatar icon={<UserOutlined />} style={{ background: '#4f46e5', flexShrink: 0 }} />
                  <div>
                    <Typography.Text strong>{v}</Typography.Text>
                    {c.jobTitle && (
                      <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        {c.jobTitle}
                      </Typography.Text>
                    )}
                  </div>
                </Flex>
              ),
            },
            {
              title: t('crew.phone'),
              dataIndex: 'phone',
              width: 180,
              render: (v?: string | null) =>
                v ? (
                  <a href={`tel:${v.replace(/\s/g, '')}`} dir="ltr">
                    <PhoneOutlined /> {v}
                  </a>
                ) : (
                  '—'
                ),
            },
            {
              title: t('crew.email'),
              dataIndex: 'email',
              width: 240,
              ellipsis: true,
              render: (v?: string | null) =>
                v ? (
                  <a href={`mailto:${v}`}>
                    <MailOutlined /> {v}
                  </a>
                ) : (
                  '—'
                ),
            },
            {
              title: t('crew.roles'),
              dataIndex: 'roles',
              width: 200,
              responsive: ['md'],
              render: (roles: string[]) => roles.map((r) => <Tag key={r}>{roleLabel(t, r)}</Tag>),
            },
          ]}
        />
      </Card>
    </>
  );
}
