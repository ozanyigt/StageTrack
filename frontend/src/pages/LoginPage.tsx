import { EnvironmentOutlined, LockOutlined, RightOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Avatar, Button, Card, Flex, Form, Input, Select, Typography } from 'antd';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, useAuth } from '../auth/AuthContext';
import { LANGUAGES } from '../i18n';
import { translateError } from '../utils/errors';
import { ApiError } from '../api/http';
import { session } from '../auth/session';

function AuthShell({ children, width = 380 }: { children: ReactNode; width?: number }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', padding: 16, background: 'radial-gradient(circle at 30% 10%, #4338ca 0%, #1e1b4b 45%, #0f0d2e 100%)' }}
    >
      <Card style={{ width: '100%', maxWidth: width }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 24 }}>
          <img src="/favicon.svg" width={52} height={52} alt="" />
          <Typography.Title level={3} style={{ margin: 0 }}>
            StageTrack
          </Typography.Title>
          <Typography.Text type="secondary">{t('login.subtitle')}</Typography.Text>
        </Flex>
        {children}
        <Flex justify="flex-end" style={{ marginTop: 20 }}>
          <Select
            size="small"
            value={i18n.language}
            onChange={(code) => changeLanguage(code, !!user)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            style={{ width: 110 }}
            aria-label={t('layout.language')}
          />
        </Flex>
      </Card>
    </Flex>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  // Signed out by the server (suspended firm, expired subscription): show why.
  const [error, setError] = useState<string | null>(() => {
    const reason = session.takeExpireReason();
    return reason ? translateError(t, new ApiError(reason.code, 401, reason.details)) : null;
  });
  const [loading, setLoading] = useState(false);

  const submit = async (values: { userName: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.userName, values.password);
    } catch (e) {
      setError(translateError(t, e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={submit}>
        <Form.Item name="userName" label={t('login.userName')} rules={[{ required: true, message: t('validation.required') }]}>
          <Input prefix={<UserOutlined />} autoComplete="username" />
        </Form.Item>
        <Form.Item name="password" label={t('login.password')} rules={[{ required: true, message: t('validation.required') }]}>
          <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
        </Form.Item>
        <Button type="primary" htmlType="submit" block loading={loading}>
          {t('login.submit')}
        </Button>
      </Form>
      <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 16 }}>
        {t('login.demoUsers')}
      </Typography.Text>
    </AuthShell>
  );
}

/** Location (workspace) picker shown after sign-in when the user works at several locations. */
export function LocationPickerPage() {
  const { t } = useTranslation();
  const { user, company, chooseLocation, cancelLocationChoice, logout } = useAuth();

  return (
    <AuthShell width={460}>
      <Typography.Title level={5} style={{ marginTop: 0 }}>
        {t('login.chooseLocation', { name: user?.fullName })}
      </Typography.Title>
      <Flex vertical gap={10}>
        {(user?.companies ?? []).map((c) => (
          <Card
            key={c.id}
            size="small"
            className="location-card"
            onClick={() => chooseLocation(c.id)}
            style={c.id === company?.id ? { borderColor: '#6366f1' } : undefined}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && chooseLocation(c.id)}
          >
            <Flex align="center" gap={12}>
              <Avatar shape="square" size={40} style={{ background: '#312e81', fontWeight: 600 }}>
                {c.code}
              </Avatar>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Typography.Text strong ellipsis style={{ display: 'block' }}>
                  {c.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  <EnvironmentOutlined /> {t(`login.country.${c.countryCode}`, { defaultValue: c.countryCode })} · {c.defaultCurrency}
                </Typography.Text>
              </div>
              <RightOutlined />
            </Flex>
          </Card>
        ))}
      </Flex>
      <Flex justify="space-between" style={{ marginTop: 16 }}>
        <Button type="link" style={{ paddingInline: 0 }} onClick={logout}>
          {t('layout.logout')}
        </Button>
        {company && (
          <Button type="link" style={{ paddingInline: 0 }} onClick={cancelLocationChoice}>
            {t('common.cancel')}
          </Button>
        )}
      </Flex>
    </AuthShell>
  );
}
