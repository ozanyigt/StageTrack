import { Select, type SelectProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { customerApi, equipmentApi, stockLocationApi } from '../api/endpoints';
import type { EquipmentLookup } from '../api/types';
import { useDebounced } from '../utils/useDebounced';

type BaseProps = Omit<SelectProps, 'options' | 'onSearch' | 'filterOption' | 'showSearch'>;

export function EquipmentSelect(props: BaseProps & { onPick?: (item: EquipmentLookup | undefined) => void }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const { data = [], isFetching } = useQuery({
    queryKey: ['equipment-lookup', search],
    queryFn: () => equipmentApi.lookup(search),
  });
  const { onPick, onChange, ...rest } = props;

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

export function CustomerSelect(props: BaseProps) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const { data = [], isFetching } = useQuery({
    queryKey: ['customer-lookup', search],
    queryFn: () => customerApi.lookup(search),
  });

  return (
    <Select
      showSearch
      allowClear
      filterOption={false}
      onSearch={setText}
      loading={isFetching}
      placeholder={t('customers.searchPlaceholder')}
      options={data.map((c) => ({ value: c.id, label: c.name }))}
      {...props}
    />
  );
}

export function StockLocationSelect(props: BaseProps) {
  const { data = [] } = useQuery({ queryKey: ['stock-locations'], queryFn: stockLocationApi.list });
  return (
    <Select allowClear options={data.filter((l) => l.isActive).map((l) => ({ value: l.id, label: l.name }))} {...props} />
  );
}
