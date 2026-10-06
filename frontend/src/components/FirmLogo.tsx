import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { firmApi } from '../api/endpoints';
import { useAuth } from '../auth/AuthContext';

/** Object URL of the firm's logo (null when none); used on printed quotes and packing slips. */
export function useFirmLogoUrl() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ['firm-logo'],
    queryFn: firmApi.logo,
    enabled: !!user && !user.isHost && user.hasFirmLogo,
    staleTime: Infinity,
  });
  const url = useMemo(() => (data ? URL.createObjectURL(data) : null), [data]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

/** The firm logo, or the app logo when the firm has not uploaded one. */
export function FirmLogo({ size = 44 }: { size?: number }) {
  const url = useFirmLogoUrl();
  return <img src={url ?? '/favicon.svg'} alt="" style={{ height: size, maxWidth: size * 3, objectFit: 'contain' }} />;
}
