import {
  pulsoCoreClient,
  resolveTauriInvoke,
  type PulsoProviderConfig,
  type PulsoProviderCatalog,
  type PulsoProviderBinding,
  type PulsoProviderHealth,
} from './pulsoCoreClient';

const STORAGE_KEY = 'pulso_core_provider_v1';
export const PULSO_CANONICAL_PROVIDER_CONFIG: PulsoProviderConfig = Object.freeze({
  providerId: 'codex-fe',
  adapterKind: 'codex_subscription',
  displayName: 'Fe · ChatGPT',
  model: 'gpt-6.1-sol',
  endpoint: null,
  allowExternalNetwork: true,
  profileId: 'fe-pessoal',
});
export const PULSO_LOCAL_PROVIDER_CONFIG: PulsoProviderConfig = Object.freeze({
  providerId: 'ollama-local',
  adapterKind: 'ollama',
  displayName: 'iMac · modelos locais',
  model: 'gemma4:26b',
  endpoint: 'http://127.0.0.1:11434',
  allowExternalNetwork: false,
  profileId: null,
});
const isLocalAdapter = (adapterKind: PulsoProviderConfig['adapterKind']): boolean => (
  adapterKind === 'local' || adapterKind === 'ollama'
);
const isSubscriptionAdapter = (adapterKind: PulsoProviderConfig['adapterKind']): boolean => (
  adapterKind === 'codex_subscription'
);

export interface PulsoProviderSecretReceipt {
  readonly providerId: string;
  readonly configured: boolean;
  readonly secretRef?: string | null;
}

export interface PulsoCoreSelectorModel {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly contextWindow: number;
  readonly contextWindows: readonly never[];
  readonly contextWindowDefault: string;
  readonly reasoning: boolean;
  readonly thinkingLevels: readonly Readonly<{ id: string; label: string }>[];
  readonly thinkingDefault: string;
  readonly tags: readonly string[];
  readonly available: boolean;
  readonly availabilityReason?: string;
}

export interface PulsoCoreSelectorProvider {
  readonly id: string;
  readonly displayName: string;
  readonly configured: boolean;
  readonly availability: 'available' | 'unavailable';
  readonly availabilityReason?: string;
  readonly authStatus: string;
  readonly modelCount: number;
  readonly profiles: readonly never[];
}

const localModelLabel = (model: string): string => {
  if (model === 'gemma4:26b') return 'Gemma 4 · 26B';
  if (model === 'SparkLLM/Spark-X2.6-4B:latest') return 'Spark X2.6 · 4B';
  return model.replace(/:latest$/i, '');
};

export const toPulsoCoreSelectorCatalog = (catalog: PulsoProviderCatalog): Readonly<{
  models: readonly PulsoCoreSelectorModel[];
  providers: readonly PulsoCoreSelectorProvider[];
}> => {
  const models = catalog.models.map(model => ({
    id: model.id,
    name: localModelLabel(model.id),
    provider: model.providerId,
    contextWindow: model.local === true ? 8_192 : 32_768,
    contextWindows: [] as const,
    contextWindowDefault: '',
    reasoning: model.local === true,
    thinkingLevels: model.local === true
      ? [
          { id: 'off', label: 'rápido' },
          { id: 'on', label: 'raciocínio local' },
        ] as const
      : [{ id: 'medium', label: 'médio' }] as const,
    thinkingDefault: model.local === true ? 'off' : 'medium',
    tags: model.id === PULSO_LOCAL_PROVIDER_CONFIG.model ? ['local', 'recommended'] : (model.local ? ['local'] : []),
    available: model.unavailable !== true,
    ...(model.availabilityReason ? { availabilityReason: model.availabilityReason } : {}),
  }));
  const providers = catalog.providers.map(provider => {
    const providerId = String(provider.providerId || '');
    const providerModels = models.filter(model => model.provider === providerId);
    const unavailable = providerModels.length > 0 && providerModels.every(model => !model.available);
    return {
      id: providerId,
      displayName: String(provider.displayName || providerId),
      configured: provider.enabled !== false,
      availability: unavailable ? 'unavailable' as const : 'available' as const,
      ...(unavailable ? { availabilityReason: providerModels[0]?.availabilityReason || 'provider_unavailable' } : {}),
      authStatus: provider.kind === 'local' ? 'local' : 'configured',
      modelCount: providerModels.length,
      profiles: [] as const,
    };
  }).filter(provider => provider.id && provider.modelCount > 0);
  return Object.freeze({ models, providers });
};

export const bindingForCoreSession = (
  catalog: PulsoProviderCatalog,
  sessionId: string,
): PulsoProviderBinding | null => (
  catalog.bindings.find(binding => binding.scope?.type === 'session' && binding.scope.scopeId === sessionId)
  || catalog.bindings.find(binding => ['system', 'global'].includes(binding.scope?.type) && binding.scope.scopeId === null)
  || null
);

const nativeInvoke = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  const invoke = resolveTauriInvoke();
  if (!invoke) throw new Error('A ponte nativa do PULSO não está disponível.');
  return invoke<T>(command, args);
};

const validateConfig = (config: PulsoProviderConfig): PulsoProviderConfig => {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(config.providerId)) throw new Error('Identificador de provider inválido.');
  if (!config.model.trim()) throw new Error('Modelo é obrigatório.');
  if (!['codex_subscription', 'openai', 'anthropic', 'local', 'ollama'].includes(config.adapterKind)) throw new Error('Tipo de provider inválido.');
  return Object.freeze({
    ...config,
    providerId: config.providerId.trim(),
    displayName: config.displayName.trim() || config.providerId.trim(),
    model: config.model.trim(),
    endpoint: config.endpoint?.trim() || null,
    allowExternalNetwork: !isLocalAdapter(config.adapterKind),
    profileId: config.profileId?.trim() || null,
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

  async configure(
    configInput: PulsoProviderConfig,
    secret?: string,
    options: { bind?: boolean; save?: boolean } = {},
  ): Promise<PulsoProviderSecretReceipt> {
    const config = validateConfig(configInput);
    let receipt: PulsoProviderSecretReceipt = {
      providerId: config.providerId,
      configured: isLocalAdapter(config.adapterKind) || isSubscriptionAdapter(config.adapterKind),
      secretRef: isLocalAdapter(config.adapterKind) || isSubscriptionAdapter(config.adapterKind) ? null : `keychain:${config.providerId}`,
    };

    if (!isLocalAdapter(config.adapterKind) && !isSubscriptionAdapter(config.adapterKind)) {
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

    const configured = await pulsoCoreClient.configureProvider(config, { bind: options.bind !== false });
    if (!configured.ok) throw new Error(configured.error.message);
    if (options.save !== false && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    }
    return receipt;
  },

  async restore(): Promise<boolean> {
    const config = this.readSavedConfig() || PULSO_CANONICAL_PROVIDER_CONFIG;
    await this.configure(config, undefined, { bind: true, save: false });
    await this.configure(PULSO_LOCAL_PROVIDER_CONFIG, undefined, { bind: false, save: false });
    return true;
  },

  async catalog(): Promise<PulsoProviderCatalog> {
    const result = await pulsoCoreClient.listProviderCatalog();
    if (!result.ok) throw new Error(result.error.message);
    return result.result;
  },

  async selectForSession(
    sessionId: string,
    providerId: string,
    model: string,
    thinkingLevel = 'off',
  ): Promise<PulsoProviderBinding> {
    const result = await pulsoCoreClient.selectProvider({
      providerId,
      model,
      thinkingLevel,
      scope: { type: 'session', scopeId: sessionId },
      idempotencyKey: `provider-select:${sessionId}:${providerId}:${model}:${thinkingLevel}`,
    });
    if (!result.ok) throw new Error(result.error.message);
    if (result.result.fallbackEnabled !== false || result.result.binding.fallbackChain.length !== 0) {
      throw new Error('O Core não confirmou a seleção exclusiva do modelo solicitado.');
    }
    return result.result.binding;
  },

  async test(providerId: string): Promise<PulsoProviderHealth> {
    const tested = await pulsoCoreClient.testProvider(providerId);
    if (!tested.ok) throw new Error(tested.error.message);
    return tested.result;
  },

  async status(providerId: string): Promise<PulsoProviderSecretReceipt> {
    return nativeInvoke<PulsoProviderSecretReceipt>('provider_secret_status', { providerId });
  },

  async startSubscriptionLogin(configInput: PulsoProviderConfig) {
    const config = validateConfig(configInput);
    if (!isSubscriptionAdapter(config.adapterKind)) throw new Error('Este provider não usa assinatura.');
    await this.configure(config);
    const started = await pulsoCoreClient.startSubscriptionLogin(config.providerId);
    if (!started.ok) throw new Error(started.error.message);
    await nativeInvoke<void>('local_open_url', { url: started.result.authUrl });
    return started.result;
  },

  async readSubscriptionAccount(providerId: string, refreshToken = false) {
    const result = await pulsoCoreClient.readSubscriptionAccount(providerId, refreshToken);
    if (!result.ok) throw new Error(result.error.message);
    return result.result;
  },

  async cancelSubscriptionLogin(providerId: string, loginId: string) {
    const result = await pulsoCoreClient.cancelSubscriptionLogin(providerId, loginId);
    if (!result.ok) throw new Error(result.error.message);
    return result.result;
  },

  async listSubscriptionModels(providerId: string) {
    const result = await pulsoCoreClient.listSubscriptionModels(providerId);
    if (!result.ok) throw new Error(result.error.message);
    return result.result;
  },

  async logoutSubscription(providerId: string) {
    const result = await pulsoCoreClient.logoutSubscription(providerId);
    if (!result.ok) throw new Error(result.error.message);
    return result.result;
  },
});
