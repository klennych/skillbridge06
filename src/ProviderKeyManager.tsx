import { useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { callBackend } from './backend';

type Provider = 'openai' | 'gemini';
type ProviderModel = { id: string; displayName: string; inputTokenLimit: number | null; outputTokenLimit: number | null; supportedAction?: string };
export type SavedProviderKey = { id: string; provider: Provider; label: string; models: string[] | null; createdAt: string | null; updatedAt?: string | null };

type Props = {
  keys: SavedProviderKey[];
  configured: Record<Provider, boolean>;
  busy?: boolean;
  onEditName: (entry: SavedProviderKey) => void;
  onReplace: (entry: SavedProviderKey) => void;
  onEditModels: (entry: SavedProviderKey) => void;
  onDelete: (entry: SavedProviderKey) => void;
  loaded?: boolean;
  loading?: boolean;
  loadError?: string;
};

const CACHE_KEY = 'skillbridge-provider-key-checks-v1';
type CachedChecks = {
  health: Record<string, 'healthy' | 'issue'>;
  catalog: Record<string, ProviderModel[]>;
};

function readChecks(): CachedChecks {
  try {
    const value = sessionStorage.getItem(CACHE_KEY);
    return value ? JSON.parse(value) as CachedChecks : { health: {}, catalog: {} };
  } catch {
    return { health: {}, catalog: {} };
  }
}

const providers: { id: Provider; name: string; short: string }[] = [
  { id: 'openai', name: 'OpenAI', short: 'O' },
  { id: 'gemini', name: 'Google AI Studio', short: 'G' },
];

export default function ProviderKeyManager({ keys, configured, busy = false, onEditName, onReplace, onEditModels, onDelete, loaded = true, loading = false, loadError = '' }: Props) {
  const [expanded, setExpanded] = useState<Provider[]>([]);
  const [health, setHealth] = useState<Record<string, 'checking' | 'healthy' | 'issue'>>(() => readChecks().health);
  const [catalog, setCatalog] = useState<Record<string, ProviderModel[]>>(() => readChecks().catalog);

  const remember = (id: string, result: 'healthy' | 'issue', models?: ProviderModel[]) => {
    setHealth(current => ({ ...current, [id]: result }));
    if (models) setCatalog(current => ({ ...current, [id]: models }));
    try {
      const cached = readChecks();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({
        health: { ...cached.health, [id]: result },
        catalog: models ? { ...cached.catalog, [id]: models } : cached.catalog,
      }));
    } catch {
      // Keep the current-page status even when browser storage is unavailable.
    }
  };

  const check = async (entry: SavedProviderKey) => {
    setHealth(current => ({ ...current, [entry.id]: 'checking' }));
    try {
      const request = callBackend('listAiModels');
      const result = await request({ provider: entry.provider, keyId: entry.id });
      const models = (result.data as { models?: ProviderModel[] }).models || [];
      if (!models.length) throw new Error('No models were returned for this key.');
      remember(entry.id, 'healthy', models);
    } catch {
      remember(entry.id, 'issue');
    }
  };

  const toggle = (provider: Provider) => {
    const open = expanded.includes(provider);
    setExpanded(current => open ? current.filter(item => item !== provider) : [...current, provider]);
    if (!open) keys.filter(item => item.provider === provider && !health[item.id]).forEach(entry => void check(entry));
  };

  return <div className="ai-provider-list" aria-label="AI providers and saved keys">
    {!loaded ? <div className="ai-provider-load-state" role={loading ? 'status' : 'alert'}><b>{loading ? 'Loading provider keys…' : 'Provider keys could not be loaded'}</b><small>{loading ? 'Checking the AI settings service.' : loadError || 'The server did not return your saved key details. Try again after the Edge Function is available.'}</small></div> : providers.map(provider => {
      const entries = keys.filter(entry => entry.provider === provider.id);
      const isOpen = expanded.includes(provider.id);
      const states = entries.map(entry => health[entry.id]);
      const healthy = states.filter(state => state === 'healthy').length;
      const checking = states.includes('checking');
      const hasIssue = states.includes('issue');
      const status = checking ? 'Checking' : hasIssue ? 'Issue' : entries.length > 0 && healthy === entries.length ? 'Model access verified' : !entries.length && configured[provider.id] ? 'Server-managed' : entries.length ? 'Not checked' : 'Not connected';
      const modelCount = new Set(entries.flatMap(entry => catalog[entry.id] || []).map(model => model.id)).size;
      return <section className={`ai-provider-card ${isOpen ? 'expanded' : ''}`} key={provider.id}>
        <div className="ai-provider-row">
          <button type="button" className="ai-provider-toggle" aria-expanded={isOpen} onClick={() => toggle(provider.id)}>
            <span className={`ai-provider-logo ${provider.id}`}>{provider.short}</span>
            <span className="ai-provider-main"><b>{provider.name}</b><small>{entries.length ? `${entries.length} ${entries.length === 1 ? 'key' : 'keys'} · ${modelCount || '—'} models found` : configured[provider.id] ? 'Server-managed key' : 'No keys added'}</small></span>
            <span className={`ai-provider-health ${status === 'Model access verified' ? 'healthy' : status === 'Issue' ? 'issue' : status === 'Checking' ? 'checking' : 'unknown'}`}><i />{status}</span>
            <ChevronDown size={18} className={isOpen ? 'rotated' : ''} />
          </button>
          {entries.length > 0 && <button type="button" className="button secondary small ai-check-provider" disabled={busy || checking} onClick={() => entries.forEach(entry => void check(entry))}><RefreshCw size={13} />{checking ? 'Checking…' : 'Check all'}</button>}
        </div>
        {isOpen && <div className="ai-provider-keys">
          {entries.length > 0 ? entries.map(entry => {
            const models = catalog[entry.id] || [];
            const allowed = entry.models === null ? models.map(model => model.displayName || model.id) : entry.models.map(id => models.find(model => model.id === id)?.displayName || id);
            return <article className="ai-managed-key" key={entry.id}>
              <div className="ai-managed-key-head">
                <span className={`ai-key-logo ${provider.id}`}>{provider.short}</span>
                <span className="ai-managed-key-title"><b>{entry.label}</b><small>{health[entry.id] === 'healthy' ? 'Model access verified' : health[entry.id] === 'issue' ? 'Check failed' : health[entry.id] === 'checking' ? 'Checking…' : 'Key value hidden for security'}</small></span>
                <span className="ai-key-time">Added {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : 'time unavailable'}{entry.updatedAt ? ` · Updated ${new Date(entry.updatedAt).toLocaleString()}` : ''}</span>
              </div>
              <div className="ai-managed-models"><b>Models this key can serve</b><div>
                {models.length > 0 ? allowed.length > 0 ? allowed.slice(0, 12).map(name => <span className="ai-model-chip" key={name}>{name}</span>) : <small>No models are enabled for this key.</small> : entry.models === null ? <small>Checking provider to load available model names…</small> : <small>{entry.models.length} selected model{entry.models.length === 1 ? '' : 's'} · checking for names…</small>}
                {allowed.length > 12 && <small>+{allowed.length - 12} more</small>}
              </div></div>
              <div className="ai-key-actions">
                <button type="button" className="button secondary small" disabled={busy} onClick={() => onEditName(entry)}>Edit name</button>
                <button type="button" className="button secondary small" disabled={busy} onClick={() => onReplace(entry)}>Replace key</button>
                <button type="button" className="button secondary small" disabled={busy} onClick={() => onEditModels(entry)}>Edit models</button>
                <button type="button" className="button secondary small danger-text" disabled={busy} onClick={() => onDelete(entry)}>Delete</button>
              </div>
            </article>;
          }) : configured[provider.id] ? <div className="ai-server-key-note"><span className={`ai-key-logo ${provider.id}`}>{provider.short}</span><div><b>Server-managed key</b><small>Stored in Supabase secrets. Add a key here to manage its name, models, and updates.</small></div></div> : <p className="tiny-note">No {provider.name} keys yet. Use “Add API key” to connect one.</p>}
        </div>}
      </section>;
    })}
  </div>;
}
