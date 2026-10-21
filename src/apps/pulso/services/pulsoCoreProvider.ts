import {
  pulsoCoreClient,
  resolveTauriInvoke,
  type PulsoProviderConfig,
  type PulsoProviderHealth,
} from './pulsoCoreClient';

const STORAGE_KEY = 'pulso_core_provider_v1';
const isLocalAdapter = (adapterKind: PulsoProviderConfig['adapterKind']): boolean => (
  adapterKind === 'local' || adapterKind === 'ollama'
);

export interface PulsoProviderSecretReceipt {
  readonly providerId: string;
  readonly configured: boolean;
  readonly secretRef?: string | null;
}

const nativeInvoke = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  const invoke = resolveTauriInvoke();
  if (!invoke) throw new Error('A ponte nativa do PULSO não está disponível.');
  return invoke<T>(command, args);
};

const validateConfig = (config: PulsoProviderConfig): PulsoProviderConfig => {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(config.providerId)) throw new Error('Identificador de provider inválido.');
  if (!config.model.trim()) throw new Error('Modelo é obrigatório.');
  if (!['openai', 'anthropic', 'local', 'ollama'].includes(config.adapterKind)) throw new Error('Tipo de provider inválido.');
  return Object.freeze({
    ...config,
    providerId: config.providerId.trim(),
    displayName: config.displayName.trim() || config.providerId.trim(),
    model: config.model.trim(),
    endpoint: config.endpoint?.trim() || null,
    allowExternalNetwork: !isLocalAdapter(config.adapterKind),
  });
};

export const pulsoCoreProvider = Object.freeze({
  readSavedConfig(): PulsoProviderConfig | null {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return validateConfig(JSON.parse(raw));
    } catch {
      return null;
    }
  },

  async configure(configInput: PulsoProviderConfig, secret?: string): Promise<PulsoProviderSecretReceipt> {
    const config = validateConfig(configInput);
    let receipt: PulsoProviderSecretReceipt = {
      providerId: config.providerId,
      configured: isLocalAdapter(config.adapterKind),
      secretRef: isLocalAdapter(config.adapterKind) ? null : `keychain:${config.providerId}`,
    };

    if (!isLocalAdapter(config.adapterKind)) {
      if (secret?.trim()) {
        receipt = await nativeInvoke<PulsoProviderSecretReceipt>('store_provider_secret', {
          providerId: config.providerId,
          secret,
        });
      } else {
        receipt = await nativeInvoke<PulsoProviderSecretReceipt>('hydrate_provider_secret', {
          providerId: config.providerId,
        });
      }
      if (!receipt.configured) throw new Error('Credencial ausente no Keychain do macOS.');
    }

    const configured = await pulsoCoreClient.configureProvider(config);
    if (!configured.ok) throw new Error(configured.error.message);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    return receipt;
  },

  async restore(): Promise<boolean> {
    const config = this.readSavedConfig();
    if (!config) return false;
    await this.configure(config);
    return true;
  },

  async test(providerId: string): Promise<PulsoProviderHealth> {
    const tested = await pulsoCoreClient.testProvider(providerId);
    if (!tested.ok) throw new Error(tested.error.message);
    return tested.result;
  },

  async status(providerId: string): Promise<PulsoProviderSecretReceipt> {
    return nativeInvoke<PulsoProviderSecretReceipt>('provider_secret_status', { providerId });
  },
});
