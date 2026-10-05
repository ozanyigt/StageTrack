import { PictureOutlined } from '@ant-design/icons';
import { Image, theme } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { collaborationApi } from '../api/endpoints';

/** Shows a stored image (equipment/device photo). Files need the bearer token, so they are loaded as blobs. */
export function AuthImage({ attachmentId, size = 160 }: { attachmentId?: string | null; size?: number }) {
  const { token } = theme.useToken();
  const { data } = useQuery({
    queryKey: ['attachment-blob', attachmentId],
    queryFn: () => collaborationApi.download(attachmentId!),
    enabled: !!attachmentId,
    staleTime: Infinity,
  });
  const url = useMemo(() => (data ? URL.createObjectURL(data) : null), [data]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  if (!url) {
    return (
      <div
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 8,
          background: token.colorFillTertiary,
          color: token.colorTextQuaternary,
          fontSize: size / 4,
        }}
      >
        <PictureOutlined />
      </div>
    );
  }

  return <Image src={url} width={size} height={size} style={{ objectFit: 'contain', borderRadius: 8, background: token.colorFillTertiary }} />;
}
