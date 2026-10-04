import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Flex, Form, Input, Select, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, useAuth } from '../auth/AuthContext';
import { LANGUAGES } from '../i18n';
import { translateError } from '../utils/errors';

export function LoginPage() {
  const { t, i18n } = useTranslation();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
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
    <Flex align="center" justify="center" style={{ minHeight: '100vh', padding: 16, background: 'linear-gradient(135deg,#1f1f1f,#3a2412)' }}>
      <Card style={{ width: '100%', maxWidth: 380 }}>
        <Flex vertical align="center" gap={4} style={{ marginBottom: 24 }}>
          <img src="/favicon.svg" width={48} height={48} alt="" />
          <Typography.Title level={3} style={{ margin: 0 }}>StageTrack</Typography.Title>
          <Typography.Text type="secondary">{t('login.subtitle')}</Typography.Text>
        </Flex>
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
        <Flex justify="space-between" align="center" style={{ marginTop: 20 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('login.demoUsers')}</Typography.Text>
          <Select
            size="small"
            value={i18n.language}
            onChange={(code) => changeLanguage(code, false)}
            options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))}
            style={{ width: 110 }}
          />
        </Flex>
      </Card>
    </Flex>
  );
}
