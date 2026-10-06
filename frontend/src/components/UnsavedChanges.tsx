import { App, Button, Space } from 'antd';
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlocker } from 'react-router-dom';

type Choice = 'save' | 'discard' | 'cancel';

interface Entry {
  dirty: boolean;
  /** Saves the form; throw (or reject) to stay on the page. */
  save?: () => Promise<unknown>;
}

interface UnsavedChangesApi {
  register: (id: string, entry: Entry) => void;
  unregister: (id: string) => void;
  /** Asks "save changes?" when something is dirty; resolves true when the user may leave. */
  confirmLeave: () => Promise<boolean>;
}

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

/**
 * One guard for the whole app: any form that registers as dirty stops route changes, page reloads/closing and
 * (through confirmLeave) tab switches or closing a modal, with a "Save / Leave without saving / Cancel" question.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { modal } = App.useApp();
  const entries = useRef(new Map<string, Entry>());
  const asking = useRef<Promise<boolean> | null>(null);

  const isDirty = () => [...entries.current.values()].some((e) => e.dirty);

  const ask = useCallback((): Promise<boolean> => {
    if (asking.current) return asking.current;
    const promise = new Promise<boolean>((resolve) => {
      const dirtyEntries = [...entries.current.values()].filter((e) => e.dirty);
      const canSave = dirtyEntries.every((e) => e.save);
      let instance: { destroy: () => void } | null = null;
      const finish = async (choice: Choice) => {
        if (choice === 'save') {
          try {
            for (const e of dirtyEntries) await e.save!();
          } catch {
            return; // the form shows its own error; stay in the dialog
          }
        }

        instance?.destroy();
        resolve(choice !== 'cancel');
      };
      instance = modal.confirm({
        title: t('unsaved.title'),
        content: t('unsaved.message'),
        closable: true,
        onCancel: () => finish('cancel'),
        footer: (
          <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 16 }} wrap>
            <Button onClick={() => finish('cancel')}>{t('common.cancel')}</Button>
            <Button danger onClick={() => finish('discard')}>{t('unsaved.discard')}</Button>
            {canSave && (
              <Button type="primary" onClick={() => finish('save')}>
                {t('unsaved.save')}
              </Button>
            )}
          </Space>
        ),
      });
    }).finally(() => {
      asking.current = null;
    });
    asking.current = promise;
    return promise;
  }, [modal, t]);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty() && currentLocation.pathname + currentLocation.search !== nextLocation.pathname + nextLocation.search,
  );

  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    ask().then((leave) => {
      if (leave) {
        entries.current.forEach((e) => (e.dirty = false));
        blocker.proceed?.();
      } else {
        blocker.reset?.();
      }
    });
  }, [blocker, ask]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const api = useMemo<UnsavedChangesApi>(
    () => ({
      register: (id, entry) => entries.current.set(id, entry),
      unregister: (id) => entries.current.delete(id),
      confirmLeave: async () => {
        if (!isDirty()) return true;
        const leave = await ask();
        if (leave) entries.current.forEach((e) => (e.dirty = false));
        return leave;
      },
    }),
    [ask],
  );

  return <UnsavedChangesContext.Provider value={api}>{children}</UnsavedChangesContext.Provider>;
}

/**
 * Registers a form with the unsaved-changes guard. Pass the form's dirty state and its save function.
 * Use `confirmLeave()` before switching tabs or closing a modal/drawer that holds the form.
 */
export function useUnsavedChanges(dirty: boolean, save?: () => Promise<unknown>) {
  const ctx = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => {
    ctx?.register(id, { dirty, save });
  }, [ctx, id, dirty, save]);
  useEffect(() => () => ctx?.unregister(id), [ctx, id]);
  const confirmLeave = useCallback(async () => (ctx ? (dirty ? ctx.confirmLeave() : true) : true), [ctx, dirty]);
  return { confirmLeave };
}
