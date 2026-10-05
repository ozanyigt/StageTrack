import { BoldOutlined, ItalicOutlined, LinkOutlined, OrderedListOutlined, UnderlineOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, theme } from 'antd';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Small formatted-text editor (bold, italic, underline, lists, links) for remarks. The HTML is
 * sanitized on the server, so only these formatting tags survive.
 */
export function RichTextEditor({ value, onChange, minHeight = 120 }: { value?: string | null; onChange?: (html: string) => void; minHeight?: number }) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value ?? '')) ref.current.innerHTML = value ?? '';
  }, [value]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    onChange?.(ref.current?.innerHTML ?? '');
  };

  const tools = [
    { key: 'bold', icon: <BoldOutlined />, run: () => exec('bold') },
    { key: 'italic', icon: <ItalicOutlined />, run: () => exec('italic') },
    { key: 'underline', icon: <UnderlineOutlined />, run: () => exec('underline') },
    { key: 'bulletList', icon: <UnorderedListOutlined />, run: () => exec('insertUnorderedList') },
    { key: 'numberedList', icon: <OrderedListOutlined />, run: () => exec('insertOrderedList') },
    {
      key: 'link',
      icon: <LinkOutlined />,
      run: () => {
        const url = window.prompt(t('richText.linkPrompt'), 'https://');
        if (url && /^(https?:|mailto:)/i.test(url)) exec('createLink', url);
      },
    },
  ];

  return (
    <div style={{ border: `1px solid ${token.colorBorder}`, borderRadius: token.borderRadius }}>
      <Space size={2} style={{ padding: 4, borderBottom: `1px solid ${token.colorBorderSecondary}`, width: '100%' }}>
        {tools.map((tool) => (
          <Tooltip key={tool.key} title={t(`richText.${tool.key}`)}>
            <Button type="text" size="small" icon={tool.icon} onMouseDown={(e) => e.preventDefault()} onClick={tool.run} aria-label={t(`richText.${tool.key}`)} />
          </Tooltip>
        ))}
      </Space>
      <div
        ref={ref}
        className="rich-text"
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange?.(ref.current?.innerHTML ?? '')}
        style={{ minHeight, padding: '8px 11px', outline: 'none' }}
      />
    </div>
  );
}

/** Read-only display of sanitized remark HTML. */
export function RichTextView({ html }: { html?: string | null }) {
  if (!html) return null;
  return <div className="rich-text" dangerouslySetInnerHTML={{ __html: html }} />;
}
