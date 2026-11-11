import { HolderOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Checkbox, Flex, Popover, Typography } from 'antd';
import type { TableColumnsType, TableProps } from 'antd';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

/**
 * Column width, visibility and order for a table, kept per user and per firm location.
 *
 * Everything lives in one localStorage entry per table; a saved layout is advice, not law. Columns the layout
 * no longer knows keep their default place and columns that disappeared from the code are dropped on read, so
 * an old layout can never leave a page without its columns.
 */

export interface TableLayoutOptions {
  /** Storage name of this table, unique within the application. */
  name: string;
  /** Columns that say which row this is; they can be moved but never hidden. */
  locked?: string[];
  /** Columns that start hidden - the table shows them only when the user asks. */
  defaultHidden?: string[];
  /** The narrowest a column may be dragged, so a heading never becomes unreadable. */
  minWidth?: number;
}

interface Layout {
  order: string[];
  hidden: string[];
  widths: Record<string, number>;
}

const EMPTY: Layout = { order: [], hidden: [], widths: {} };
const MIN_WIDTH = 64;

const keyOf = (column: { key?: unknown; dataIndex?: unknown }, index: number) =>
  String(column.key ?? column.dataIndex ?? index);

function read(storageKey: string): Layout {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Layout>;
    return {
      order: Array.isArray(parsed.order) ? parsed.order.map(String) : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.map(String) : [],
      widths: parsed.widths && typeof parsed.widths === 'object' ? parsed.widths : {},
    };
  } catch {
    return EMPTY;
  }
}

function write(storageKey: string, layout: Layout) {
  try {
    if (layout.order.length === 0 && layout.hidden.length === 0 && Object.keys(layout.widths).length === 0) {
      localStorage.removeItem(storageKey);
    } else {
      localStorage.setItem(storageKey, JSON.stringify(layout));
    }
  } catch {
    /* storage unavailable: the layout lasts for this page only */
  }
}

/**
 * The saved order, with what the code has since added put back where the code puts it. A key the layout knows
 * but the table no longer has is simply skipped.
 */
function merge(defaults: string[], saved: string[]): string[] {
  const known = new Set(defaults);
  const result = saved.filter((key) => known.has(key));
  const placed = new Set(result);
  defaults.forEach((key, index) => {
    if (!placed.has(key)) {
      result.splice(Math.min(index, result.length), 0, key);
      placed.add(key);
    }
  });
  return result;
}

/** A heading with a grip on its right edge: drag to resize, double-click to go back to the default width. */
function ResizableCell({ onResize, onReset, ...rest }: {
  onResize?: (width: number) => void;
  onReset?: () => void;
} & React.ThHTMLAttributes<HTMLTableCellElement>) {
  const cell = useRef<HTMLTableCellElement>(null);

  const start = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const from = event.clientX;
    const width = cell.current?.offsetWidth ?? 0;
    const move = (e: MouseEvent) => onResize?.(Math.max(MIN_WIDTH, width + e.clientX - from));
    const done = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', done);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', done);
  };

  if (!onResize) return <th {...rest} />;

  return (
    <th {...rest} ref={cell} style={{ ...rest.style, position: 'relative' }}>
      {rest.children}
      <span
        role="separator"
        aria-orientation="vertical"
        onMouseDown={start}
        onDoubleClick={(e) => { e.stopPropagation(); onReset?.(); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', insetBlock: 0, insetInlineEnd: -4, width: 9,
          cursor: 'col-resize', touchAction: 'none', zIndex: 1,
        }}
      />
    </th>
  );
}

const components: TableProps<never>['components'] = { header: { cell: ResizableCell } };

export function useTableLayout<T>(columns: TableColumnsType<T>, options: TableLayoutOptions) {
  const { t } = useTranslation();
  const { user, company } = useAuth();
  const storageKey = `stagetrack.table.${user?.id ?? 'anon'}.${company?.id ?? 'none'}.${options.name}`;
  const minWidth = options.minWidth ?? MIN_WIDTH;

  const [layout, setLayout] = useState<Layout>(() => read(storageKey));
  const [storedFor, setStoredFor] = useState(storageKey);
  if (storedFor !== storageKey) {
    // Another user or another location: that layout is not this one's.
    setStoredFor(storageKey);
    setLayout(read(storageKey));
  }

  const save = useCallback((next: Layout) => {
    setLayout(next);
    write(storageKey, next);
  }, [storageKey]);

  const defs = useMemo(
    () => columns.map((column, index) => ({ key: keyOf(column as never, index), column })),
    [columns],
  );
  const defaultOrder = defs.map((d) => d.key);
  const order = merge(defaultOrder, layout.order.length > 0 ? layout.order : defaultOrder);
  const hidden = new Set(layout.hidden.length > 0 ? layout.hidden : (options.defaultHidden ?? []));
  const locked = new Set(options.locked ?? []);

  const byKey = new Map(defs.map((d) => [d.key, d.column]));
  const visibleKeys = order.filter((key) => !hidden.has(key) || locked.has(key));

  const resized: TableColumnsType<T> = visibleKeys.map((key) => {
    const column = byKey.get(key)!;
    const width = layout.widths[key] ?? (column as { width?: number }).width;
    return {
      ...column,
      key,
      width,
      onHeaderCell: () => ({
        onResize: (next: number) => save({ ...layout, widths: { ...layout.widths, [key]: Math.max(minWidth, next) } }),
        onReset: () => {
          const { [key]: _dropped, ...rest } = layout.widths;
          save({ ...layout, widths: rest });
        },
      }),
    } as TableColumnsType<T>[number];
  });

  const scrollX = resized.reduce((sum, c) => sum + (typeof c.width === 'number' ? c.width : 160), 0);

  const toggle = (key: string, on: boolean) =>
    save({ ...layout, hidden: on ? [...hidden].filter((k) => k !== key) : [...new Set([...hidden, key])] });

  const chooser = (
    <ColumnChooser
      order={order}
      hidden={hidden}
      locked={locked}
      title={(key) => titleOf(byKey.get(key))}
      onToggle={toggle}
      onReorder={(next) => save({ ...layout, order: next })}
      onReset={() => save(EMPTY)}
    />
  );

  const button = (
    <Popover trigger="click" placement="bottomRight" content={chooser}>
      <Button icon={<TableOutlined />}>{t('table.columns')}</Button>
    </Popover>
  );

  return { columns: resized, components: components as TableProps<T>['components'], scrollX, button, visibleKeys };
}

function titleOf(column?: { title?: unknown }): string {
  const title = column?.title;
  return typeof title === 'string' && title.length > 0 ? title : '—';
}

/** The list behind the Columns button: a checkbox each, dragged by the grip to change the order. */
function ColumnChooser({ order, hidden, locked, title, onToggle, onReorder, onReset }: {
  order: string[];
  hidden: Set<string>;
  locked: Set<string>;
  title: (key: string) => string;
  onToggle: (key: string, on: boolean) => void;
  onReorder: (next: string[]) => void;
  onReset: () => void;
}): ReactNode {
  const { t } = useTranslation();
  const [dragged, setDragged] = useState<string | null>(null);

  const drop = (over: string) => {
    if (!dragged || dragged === over) return;
    const next = order.filter((k) => k !== dragged);
    next.splice(order.indexOf(over), 0, dragged);
    setDragged(null);
    onReorder(next);
  };

  return (
    <div style={{ width: 260 }}>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('table.columnsHint')}</Typography.Text>
      <Flex vertical gap={2} style={{ maxHeight: 360, overflow: 'auto', marginTop: 8 }}>
        {order.map((key) => (
          <Flex
            key={key}
            align="center"
            gap={6}
            draggable
            onDragStart={() => setDragged(key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => drop(key)}
            style={{ padding: '2px 4px', borderRadius: 4, cursor: 'grab', background: dragged === key ? 'rgba(128,128,128,0.15)' : undefined }}
          >
            <HolderOutlined style={{ opacity: 0.45 }} />
            <Checkbox
              checked={!hidden.has(key) || locked.has(key)}
              disabled={locked.has(key)}
              onChange={(e) => onToggle(key, e.target.checked)}
            >
              {title(key)}
            </Checkbox>
          </Flex>
        ))}
      </Flex>
      <Button type="link" size="small" style={{ paddingInline: 0, marginTop: 8 }} onClick={onReset}>
        {t('table.resetColumns')}
      </Button>
    </div>
  );
}
