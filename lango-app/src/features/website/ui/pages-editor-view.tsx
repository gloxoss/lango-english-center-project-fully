'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Loader2, Plus, Save, Trash2 } from 'lucide-react';

type PageType = 'home' | 'about' | 'gallery' | 'faq' | 'contact' | 'services';

const PAGE_TABS: { type: PageType; label: string }[] = [
  { type: 'home', label: 'Accueil' },
  { type: 'about', label: 'À propos' },
  { type: 'gallery', label: 'Galerie' },
  { type: 'faq', label: 'FAQ' },
  { type: 'contact', label: 'Contact' },
  { type: 'services', label: 'Services' },
];

type PageRow = { id: string | null; pageType: PageType; title: string; content: Record<string, unknown>; published: boolean };

// ---------------------------------------------------------------------------
// Small generic UI pieces
// ---------------------------------------------------------------------------

function Field({ label, value, onChange, textarea, placeholder }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-bold text-slate-700">{label}</Label>
      {textarea
        ? <Textarea value={value} onChange={e => onChange(e.target.value)} rows={4} className="text-sm" placeholder={placeholder} />
        : <Input value={value} onChange={e => onChange(e.target.value)} className="text-sm" placeholder={placeholder} />}
    </div>
  );
}

function Repeater<T extends Record<string, unknown>>({
  items,
  onChange,
  newItem,
  renderItem,
  addLabel,
  emptyLabel,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  newItem: () => T;
  renderItem: (item: T, update: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
  emptyLabel: string;
}) {
  return (
    <div className="space-y-3">
      {items.length === 0 && <p className="text-xs text-slate-400 italic">{emptyLabel}</p>}
      {items.map((item, i) => (
        <div key={i} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50 relative">
          <button
            type="button"
            onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            className="absolute top-3 right-3 text-slate-400 hover:text-red-600 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {renderItem(item, (patch) => {
            const next = [...items];
            next[i] = { ...item, ...patch };
            onChange(next);
          })}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => onChange([...items, newItem()])}
        className="text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" /> {addLabel}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-page-type content editors
// ---------------------------------------------------------------------------

function HomeEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const slides = (content.slides as Record<string, unknown>[] | undefined) ?? [];
  const features = (content.features as Record<string, unknown>[] | undefined) ?? [];
  const testimonials = (content.testimonials as Record<string, unknown>[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Titre du héros" value={(content.heroTitle as string) ?? ''} onChange={v => onChange({ ...content, heroTitle: v })} />
        <Field label="Image du héros (URL)" value={(content.heroImageUrl as string) ?? ''} onChange={v => onChange({ ...content, heroImageUrl: v })} />
      </div>
      <Field label="Sous-titre du héros" value={(content.heroSubtitle as string) ?? ''} onChange={v => onChange({ ...content, heroSubtitle: v })} textarea />

      <div>
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Diaporama (slides)</h4>
        <Repeater
          items={slides}
          onChange={v => onChange({ ...content, slides: v })}
          newItem={() => ({ imageUrl: '', headline: '', subtext: '' })}
          addLabel="Ajouter une slide"
          emptyLabel="Aucune slide."
          renderItem={(item, update) => (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Image (URL)" value={(item.imageUrl as string) ?? ''} onChange={v => update({ imageUrl: v })} />
              <Field label="Titre" value={(item.headline as string) ?? ''} onChange={v => update({ headline: v })} />
              <div className="md:col-span-2">
                <Field label="Sous-texte" value={(item.subtext as string) ?? ''} onChange={v => update({ subtext: v })} />
              </div>
            </div>
          )}
        />
      </div>

      <div>
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Blocs de fonctionnalités</h4>
        <Repeater
          items={features}
          onChange={v => onChange({ ...content, features: v })}
          newItem={() => ({ icon: '', title: '', description: '' })}
          addLabel="Ajouter une fonctionnalité"
          emptyLabel="Aucune fonctionnalité."
          renderItem={(item, update) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Icône (nom lucide)" value={(item.icon as string) ?? ''} onChange={v => update({ icon: v })} />
              <Field label="Titre" value={(item.title as string) ?? ''} onChange={v => update({ title: v })} />
              <Field label="Description" value={(item.description as string) ?? ''} onChange={v => update({ description: v })} />
            </div>
          )}
        />
      </div>

      <div>
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Témoignages</h4>
        <Repeater
          items={testimonials}
          onChange={v => onChange({ ...content, testimonials: v })}
          newItem={() => ({ quote: '', author: '', role: '' })}
          addLabel="Ajouter un témoignage"
          emptyLabel="Aucun témoignage."
          renderItem={(item, update) => (
            <div className="space-y-3">
              <Field label="Citation" value={(item.quote as string) ?? ''} onChange={v => update({ quote: v })} textarea />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Auteur" value={(item.author as string) ?? ''} onChange={v => update({ author: v })} />
                <Field label="Rôle" value={(item.role as string) ?? ''} onChange={v => update({ role: v })} />
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}

function AboutEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Contenu principal" value={(content.body as string) ?? ''} onChange={v => onChange({ ...content, body: v })} textarea />
      <Field label="Notre mission" value={(content.missionText as string) ?? ''} onChange={v => onChange({ ...content, missionText: v })} textarea />
      <Field label="Notre histoire" value={(content.historyText as string) ?? ''} onChange={v => onChange({ ...content, historyText: v })} textarea />
    </div>
  );
}

function GalleryEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const categories = (content.categories as Record<string, unknown>[] | undefined) ?? [];
  const items = (content.items as Record<string, unknown>[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Catégories</h4>
        <Repeater
          items={categories}
          onChange={v => onChange({ ...content, categories: v })}
          newItem={() => ({ name: '' })}
          addLabel="Ajouter une catégorie"
          emptyLabel="Aucune catégorie."
          renderItem={(item, update) => (
            <Field label="Nom" value={(item.name as string) ?? ''} onChange={v => update({ name: v })} />
          )}
        />
      </div>
      <div>
        <h4 className="text-xs font-extrabold text-slate-500 uppercase tracking-wider mb-2">Photos</h4>
        <Repeater
          items={items}
          onChange={v => onChange({ ...content, items: v })}
          newItem={() => ({ imageUrl: '', caption: '', category: '' })}
          addLabel="Ajouter une photo"
          emptyLabel="Aucune photo."
          renderItem={(item, update) => (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Image (URL)" value={(item.imageUrl as string) ?? ''} onChange={v => update({ imageUrl: v })} />
              <Field label="Légende" value={(item.caption as string) ?? ''} onChange={v => update({ caption: v })} />
              <Field label="Catégorie" value={(item.category as string) ?? ''} onChange={v => update({ category: v })} />
            </div>
          )}
        />
      </div>
    </div>
  );
}

function FaqEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const items = (content.items as Record<string, unknown>[] | undefined) ?? [];
  return (
    <Repeater
      items={items}
      onChange={v => onChange({ ...content, items: v })}
      newItem={() => ({ question: '', answer: '' })}
      addLabel="Ajouter une question"
      emptyLabel="Aucune question."
      renderItem={(item, update) => (
        <div className="space-y-3">
          <Field label="Question" value={(item.question as string) ?? ''} onChange={v => update({ question: v })} />
          <Field label="Réponse" value={(item.answer as string) ?? ''} onChange={v => update({ answer: v })} textarea />
        </div>
      )}
    />
  );
}

function ContactEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Introduction" value={(content.intro as string) ?? ''} onChange={v => onChange({ ...content, intro: v })} textarea />
      <Field label="URL de la carte (Google Maps embed)" value={(content.mapEmbedUrl as string) ?? ''} onChange={v => onChange({ ...content, mapEmbedUrl: v })} />
      <p className="text-xs text-slate-400">Adresse, téléphone et email affichés proviennent des paramètres du thème (Site Web → Thème & Identité).</p>
    </div>
  );
}

function ServicesEditor({ content, onChange }: { content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }) {
  const items = (content.items as Record<string, unknown>[] | undefined) ?? [];
  return (
    <Repeater
      items={items}
      onChange={v => onChange({ ...content, items: v })}
      newItem={() => ({ title: '', description: '', imageUrl: '', priceLabel: '' })}
      addLabel="Ajouter un service"
      emptyLabel="Aucun service."
      renderItem={(item, update) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Titre" value={(item.title as string) ?? ''} onChange={v => update({ title: v })} />
          <Field label="Image (URL)" value={(item.imageUrl as string) ?? ''} onChange={v => update({ imageUrl: v })} />
          <div className="md:col-span-2">
            <Field label="Description" value={(item.description as string) ?? ''} onChange={v => update({ description: v })} textarea />
          </div>
          <Field label="Prix affiché (texte libre)" value={(item.priceLabel as string) ?? ''} onChange={v => update({ priceLabel: v })} placeholder="À partir de 800 MAD/mois" />
        </div>
      )}
    />
  );
}

const EDITORS: Record<PageType, React.ComponentType<{ content: Record<string, unknown>; onChange: (c: Record<string, unknown>) => void }>> = {
  home: HomeEditor,
  about: AboutEditor,
  gallery: GalleryEditor,
  faq: FaqEditor,
  contact: ContactEditor,
  services: ServicesEditor,
};

// ---------------------------------------------------------------------------

export function PagesEditorView() {
  const [pages, setPages] = useState<Record<PageType, PageRow> | null>(null);
  const [activeTab, setActiveTab] = useState<PageType>('home');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/website/pages')
      .then(r => r.json())
      .then((j) => {
        if (j.success) {
          const map: Record<string, PageRow> = {};
          for (const row of j.data as PageRow[]) {
            map[row.pageType] = { ...row, content: row.content ?? {} };
          }
          setPages(map as Record<PageType, PageRow>);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!pages) return;
    const page = pages[activeTab];
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/website/pages/${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: page.title, content: page.content, published: page.published }),
      });
      const j = await res.json();
      if (!j.success) {
        throw new Error(j.error?.message ?? 'Échec de l\'enregistrement');
      }
      setPages(prev => (prev ? { ...prev, [activeTab]: { ...j.data, content: j.data.content ?? {} } } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !pages) {
    return <div className="flex items-center justify-center h-64 text-slate-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  const current = pages[activeTab];
  const Editor = EDITORS[activeTab];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Site Web — Pages</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Contenu des pages fixes du site public de l&apos;école.</p>
          </div>
        </div>
        <Button onClick={save} disabled={saving} className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5 px-4 cursor-pointer">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          <span>Enregistrer la page</span>
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl p-3">{error}</div>}

      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as PageType)}>
        <TabsList>
          {PAGE_TABS.map(t => (
            <TabsTrigger key={t.type} value={t.type} className="text-xs font-bold cursor-pointer">{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1">
            <Field label="Titre de la page" value={current.title} onChange={v => setPages(p => (p ? { ...p, [activeTab]: { ...p[activeTab], title: v } } : p))} />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 h-fit">
            <Switch checked={current.published} onCheckedChange={v => setPages(p => (p ? { ...p, [activeTab]: { ...p[activeTab], published: v } } : p))} />
            <span className="text-xs font-bold text-slate-700">{current.published ? 'Publiée' : 'Brouillon'}</span>
            <Badge variant={current.published ? 'success' : 'neutral'}>{current.published ? 'Publiée' : 'Brouillon'}</Badge>
          </div>
        </div>

        <Editor
          content={current.content}
          onChange={c => setPages(p => (p ? { ...p, [activeTab]: { ...p[activeTab], content: c } } : p))}
        />
      </Card>
    </div>
  );
}
