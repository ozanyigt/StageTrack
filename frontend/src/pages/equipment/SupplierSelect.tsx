import { Select, type SelectProps } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supplierApi } from '../../api/endpoints';
import { useDebounced } from '../../utils/useDebounced';

/** Supplier picker; the current value keeps its label even when it is not in the search results. */
export function SupplierSelect({ currentName, ...props }: Omit<SelectProps, 'options' | 'onSearch' | 'filterOption' | 'showSearch'> & { currentName?: string | null }) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const search = useDebounced(text, 250);
  const { data = [], isFetching } = useQuery({ queryKey: ['supplier-lookup', search], queryFn: () => supplierApi.lookup(search) });
  const options = data.map((s) => ({ value: s.id, label: s.name }));
  if (props.value && currentName && !options.some((o) => o.value === props.value)) options.unshift({ value: props.value, label: currentName });

  return (
    <Select
      showSearch
      allowClear
      filterOption={false}
      onSearch={setText}
      loading={isFetching}
      placeholder={t('unitDetail.supplier')}
      options={options}
      {...props}
    />
  );
}
