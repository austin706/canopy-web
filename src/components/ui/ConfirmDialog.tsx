import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

interface PendingConfirm {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFn>(() => {
  console.error('[ConfirmProvider] useConfirm called outside provider');
  return Promise.resolve(false);
});

/**
 * Wrap this around the app (inside ThemeProvider, once). Exposes `useConfirm()`
 * which returns an imperative `confirm({...})` => Promise<boolean>. Any call
 * site can now trigger a typed confirmation dialog without managing open state.
 *
 * Example:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete?', message: '...', isDanger: true })) {
 *     doDelete();
 *   }
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ options, resolve });
      setIsLoading(false);
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    pending.resolve(true);
    setPending(null);
  }, [pending]);

  const handleCancel = useCallback(() => {
    if (!pending) return;
    pending.resolve(false);
    setPending(null);
  }, [pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmModal
          title={pending.options.title}
          message={pending.options.message}
          confirmLabel={pending.options.confirmLabel}
          cancelLabel={pending.options.cancelLabel}
          isDanger={pending.options.isDanger}
          isLoading={isLoading}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/** Imperative confirm hook — returns a function that resolves to user's choice. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext);
}
