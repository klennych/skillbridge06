import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Brain, GraduationCap, Lightbulb, Sparkles } from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export type BrandSymbolId = 'sparkles' | 'arrow' | 'brain' | 'lightbulb' | 'graduation';
const symbols: Record<BrandSymbolId, typeof Sparkles> = {
  sparkles: Sparkles, arrow: ArrowRight, brain: Brain, lightbulb: Lightbulb, graduation: GraduationCap,
};
const symbolNames: Record<BrandSymbolId, string> = {
  sparkles: 'Sparkles', arrow: 'Arrow', brain: 'Brain', lightbulb: 'Lightbulb', graduation: 'Graduation cap',
};
const BrandingContext = createContext<{ symbol: BrandSymbolId; setSymbol: (symbol: BrandSymbolId) => void }>({ symbol: 'arrow', setSymbol: () => {} });

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [symbol, setSymbol] = useState<BrandSymbolId>('arrow');
  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, 'publicSettings', 'branding'), snapshot => {
      const saved = snapshot.data()?.symbol;
      if (typeof saved === 'string' && saved in symbols) setSymbol(saved as BrandSymbolId);
    }, error => console.warn('Could not load shared branding settings:', error));
  }, []);
  return <BrandingContext.Provider value={{ symbol, setSymbol }}>{children}</BrandingContext.Provider>;
}

export function BrandSymbol({ size = 20, className, color }: { size?: number; className?: string; color?: string }) {
  const { symbol } = useContext(BrandingContext);
  const Icon = symbols[symbol];
  return <Icon size={size} className={`brand-symbol ${symbol === 'arrow' ? 'brand-symbol-arrow' : ''} ${className || ''}`.trim()} color={color} aria-hidden="true" />;
}

export function useBranding() { return useContext(BrandingContext); }

export async function saveBrandSymbol(symbol: BrandSymbolId) {
  if (!db || !auth?.currentUser) throw new Error('Sign in to your SkillBridge administrator account first.');
  await setDoc(doc(db, 'publicSettings', 'branding'), { symbol, updatedAt: serverTimestamp(), updatedBy: auth.currentUser.uid });
}

export function BrandingSettings({ flash }: { flash: (message: string) => void }) {
  const { symbol, setSymbol } = useBranding();
  const [selected, setSelected] = useState(symbol);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setSelected(symbol), [symbol]);
  const save = async () => {
    setSaving(true); setError('');
    try { await saveBrandSymbol(selected); setSymbol(selected); flash('Shared symbol saved to Firestore.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save the shared symbol.'); }
    finally { setSaving(false); }
  };
  return <section className="panel branding-settings">
    <div className="panel-head"><div><h3>Shared SkillBridge symbol</h3><p>Choose the symbol shown throughout the app. The selection is saved in Firestore for everyone.</p></div><BrandSymbol size={24}/></div>
    <div className="branding-symbol-options" role="group" aria-label="Choose the shared symbol">
      {(Object.keys(symbols) as BrandSymbolId[]).map(id => {
        const Icon = symbols[id];
        return <button type="button" key={id} className={`branding-symbol-option ${selected === id ? 'selected' : ''}`} aria-pressed={selected === id} onClick={() => setSelected(id)}>
          <Icon size={23}/><span>{symbolNames[id]}</span>
        </button>;
      })}
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button type="button" className="button" disabled={saving || selected === symbol} onClick={() => void save()}>{saving ? 'Saving…' : 'Save shared symbol'}</button>
  </section>;
}
