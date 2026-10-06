import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useUnsavedChanges } from './UnsavedChanges';

/**
 * Unsaved-changes guard for a form that lives in a modal or drawer (or on a page).
 * - `onValuesChange`: pass to the antd Form (only user edits mark it dirty; setFieldsValue does not).
 * - `guardClose(close)`: use as the modal's onCancel / close handler; asks "save changes?" when dirty.
 * - `markSaved()`: call after a successful save (synchronous, so a navigation right after saving is not blocked).
 * The form counts as dirty only while `open` is true.
 */
export function useGuardedForm(open: boolean, save?: () => Promise<unknown>) {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!open) setDirty(false);
  }, [open]);

  const { confirmLeave } = useUnsavedChanges(open && dirty, save);

  const onValuesChange = useCallback(() => setDirty(true), []);

  const markSaved = useCallback(() => flushSync(() => setDirty(false)), []);

  const guardClose = useCallback(
    (close: () => void) => async () => {
      if (await confirmLeave()) {
        markSaved();
        close();
      }
    },
    [confirmLeave, markSaved],
  );

  return { dirty, onValuesChange, markSaved, guardClose, confirmLeave };
}
