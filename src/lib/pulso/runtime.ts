type PulsoRuntimeWindow = Window & {
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

export const isTauriRuntime = (): boolean => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as PulsoRuntimeWindow;
  return (
    window.location.protocol === 'tauri:'
    || window.location.protocol === 'file:'
    || Boolean(runtimeWindow.__TAURI__)
    || Boolean(runtimeWindow.__TAURI_INTERNALS__)
  );
};

export const isAppleMobileRuntime = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const iPadDesktopMode = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/i.test(userAgent) || iPadDesktopMode;
};

export const isTauriDesktopRuntime = (): boolean => (
  isTauriRuntime() && !isAppleMobileRuntime()
);

export const getPulsoRuntimeLabel = (): 'tauri_desktop' | 'tauri_mobile' | 'web' => {
  if (!isTauriRuntime()) return 'web';
  return isTauriDesktopRuntime() ? 'tauri_desktop' : 'tauri_mobile';
};
