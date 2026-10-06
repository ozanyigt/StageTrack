import { PlusOutlined } from '@ant-design/icons';
import { Select, Typography, type SelectProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customerApi, equipmentApi, stockLocationApi } from '../api/endpoints';
import type { EquipmentLookup } from '../api/types';
import { useDebounced } from '../utils/useDebounced';
import { CustomerQuickCreateModal } from './CustomerQuickCreateModal';

type BaseProps = Omit<SelectProps, 'options' | 'onSearch' | 'filterOption' | 'showSearch'>;

/** forQuote: for projects and quotes — office equipment and equipment with nothing rentable (e.g. in repair) are left out. */
export function EquipmentSelect(props: BaseProps & { onPick?: (item: EquipmentLookup | undefined) => void; forQuote?: boolean }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const { data = [], isFetching } = useQuery({
    queryKey: ['equipment-lookup', search, !!props.forQuote],
    queryFn: () => equipmentApi.lookup(search, !!props.forQuote),
  });
  const { onPick, onChange, forQuote: _forQuote, ...rest } = props;

  return (
    <Select
      showSearch
      filterOption={false}
      onSearch={setText}
      loading={isFetching}
      placeholder={t('equipment.searchPlaceholder')}
      options={data.map((e) => ({ value: e.id, label: `${e.code} · ${e.name}` }))}
      onChange={(value, option) => {
        onPick?.(data.find((e) => e.id === value));
        onChange?.(value, option);
      }}
      {...rest}
    />
  );
}

const NEW_CUSTOMER = '__new_customer__';

/** Customer picker; the first option creates a new customer (with address and contact details) and selects it. */
export function CustomerSelect(props: BaseProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const search = useDebounced(text, 250);
  const { data = [], isFetching } = useQuery({
    queryKey: ['customer-lookup', search],
    queryFn: () => customerApi.lookup(search),
  });
  const { onChange, ...rest } = props;

  const options = [
    {
      value: NEW_CUSTOMER,
      label: (
        <Typography.Text style={{ color: 'inherit' }} strong>
          <PlusOutlined /> {t('customerQuick.add')}
        </Typography.Text>
      ),
    },
    ...(created && !data.some((c) => c.id === created.id) ? [{ value: created.id, label: created.name }] : []),
    ...data.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <>
      <Select
        showSearch
        allowClear
        filterOption={false}
        onSearch={setText}
        loading={isFetching}
        placeholder={t('customers.searchPlaceholder')}
        options={options}
        optionLabelProp="label"
        onChange={(value, option) => {
          if (value === NEW_CUSTOMER) {
            setCreating(true);
            return;
          }
          onChange?.(value, option);
        }}
        {...rest}
      />
      <CustomerQuickCreateModal
        open={creating}
        initialName={text}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          setCreated({ id: c.id, name: c.name });
          onChange?.(c.id, { value: c.id, label: c.name });
        }}
      />
    </>
  );
}

export function StockLocationSelect(props: BaseProps) {
  const { data = [] } = useQuery({ queryKey: ['stock-locations'], queryFn: stockLocationApi.list });
  return (
    <Select allowClear options={data.filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} {...props} />
  );
}
