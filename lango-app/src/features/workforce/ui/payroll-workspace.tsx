'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

type Json = Record<string, unknown>;
type ApiResult<T> = { success: boolean; data: T; error?: { message?: string } };
const money = (value: unknown) => Number(value ?? 0).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD' });
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const payload = await response.json() as ApiResult<T>;
  if (!response.ok) throw new Error(payload.error?.message ?? `Erreur ${response.status}`);
  return payload.data;
}

export function PayrollHub() {
  const { locale } = useParams<{ locale: string }>();
  const cards: Array<[string, string, string]> = [
    ['Cycles de paie', 'Calcul, revue, approbation et comptabilisation', 'payroll/runs'],
    ['Réglementation', 'Versions effectives et provenance officielle', 'payroll/regulations'],
    ['Paramètres', 'Calendrier, devise et conventions', 'payroll/settings'],
    ['Composantes', 'Gains, retenues et contributions', 'payroll/components'],
    ['Structures', 'Modèles de salaire versionnés', 'payroll/structures'],
    ['Affectations', 'Structure effective par employé', 'payroll/assignments'],
    ['Ajustements', 'Primes, corrections et retenues', 'payroll/adjustments'],
    ['Bulletins', 'Administration des bulletins immuables', 'payroll/payslips'],
    ['Paiements', 'Lots, double validation et rapprochement', 'payroll/payments'],
    ['Congés', 'Demandes, soldes et approbations', 'leave'],
    ['Avances', 'Demandes et recouvrement', 'advances'],
    ['Récompenses', 'Reconnaissance et primes approuvées', 'awards'],
  ];
  return <main className="space-y-6" aria-labelledby="payroll-title">
    <header><p className="text-sm font-semibold text-sky-700">Workforce Operations</p><h1 id="payroll-title" className="text-3xl font-bold text-slate-900">Paie et opérations RH</h1><p className="mt-2 text-slate-600">Paie mensuelle MAD. Les règles livrées restent configurées et non juridiquement certifiées.</p></header>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([title, description, href]) => <Link key={href} href={`/${locale}/dashboard/workforce/${href}`} className="rounded-xl border bg-white p-5 shadow-sm transition hover:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500"><h2 className="font-bold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p></Link>)}</div>
  </main>;
}

type Run = Json & { id: string; year: number; month: number; status: string; totals: { employees: number; gross: number; net: number; employerCost: number } };
export function PayrollRuns() {
  const { locale } = useParams<{ locale: string }>();
  const [runs, setRuns] = useState<Run[]>([]); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const now = new Date(); const [year, setYear] = useState(now.getFullYear()); const [month, setMonth] = useState(now.getMonth() + 1);
  const load = useCallback(() => api<Run[]>('/api/workforce/payroll/runs').then(setRuns).catch(e => setError(e.message)), []);
  useEffect(() => { void load(); }, [load]);
  async function create() { setBusy(true); setError(''); try { await api('/api/workforce/payroll/runs', { method: 'POST', body: JSON.stringify({ year, month }) }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); } }
  return <Workspace title="Cycles de paie" description="Le calculateur, l’approbateur et le payeur restent séparés.">
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Ouvrir une période</h2><div className="mt-3 flex flex-wrap gap-3"><input aria-label="Année" className="rounded border px-3 py-2" type="number" value={year} onChange={e => setYear(Number(e.target.value))}/><select aria-label="Mois" className="rounded border px-3 py-2" value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select><button disabled={busy} onClick={create} className="rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Création…' : 'Créer'}</button></div></section>
    <Status error={error}/>{runs.length === 0 && !error ? <Empty label="Aucun cycle de paie."/> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><Th>Période</Th><Th>Statut</Th><Th>Employés</Th><Th>Brut</Th><Th>Net</Th><Th></Th></tr></thead><tbody>{runs.map(run=><tr key={run.id} className="border-t"><Td>{run.month.toString().padStart(2,'0')}/{run.year}</Td><Td><Badge value={run.status}/></Td><Td>{run.totals.employees}</Td><Td>{money(run.totals.gross)}</Td><Td>{money(run.totals.net)}</Td><Td><Link className="font-semibold text-sky-700 underline" href={`/${locale}/dashboard/workforce/payroll/runs/${run.id}`}>Examiner</Link></Td></tr>)}</tbody></table></div>}
  </Workspace>;
}

type RunDetail = { run: Run; lines: Array<{ line: Json & { id:string; grossSalary:string; netPayable:string; totalEmployerCost:string; userId:string }; employeeName:string; employeeEmail:string }>; resultLines: Json[]; traces: Json[]; payslips: Json[]; batches: Json[]; payments: Json[] };
export function PayrollRunDetail({ id }: { id: string }) {
  const { locale } = useParams<{ locale: string }>();
  const [data,setData]=useState<RunDetail|null>(null); const [error,setError]=useState(''); const [busy,setBusy]=useState('');
  const load=useCallback(()=>api<RunDetail>(`/api/workforce/payroll/runs/${id}`).then(setData).catch(e=>setError(e.message)),[id]);
  useEffect(()=>{void load();},[load]);
  async function action(name:string){setBusy(name);setError('');try{await api(`/api/workforce/payroll/runs/${id}/action`,{method:'POST',body:JSON.stringify({action:name})});await load();}catch(e){setError(e instanceof Error?e.message:'Erreur');}finally{setBusy('');}}
  if (!data) return <Workspace title="Revue de paie"><Status error={error} loading={!error}/></Workspace>;
  const actions: Record<string,string[]>={draft:['calculate','cancel'],failed:['calculate','cancel'],calculated:['calculate','review'],under_review:['approve'],approved:['post'],posted:['reverse'],paid:['close','reverse']};
  const labels:Record<string,string>={calculate:'Calculer',review:'Soumettre en revue',approve:'Approuver',post:'Comptabiliser',cancel:'Annuler',reverse:'Contrepasser',close:'Clôturer'};
  return <Workspace title={`Paie ${String(data.run.month).padStart(2,'0')}/${data.run.year}`} description="Les résultats approuvés sont immuables; toute correction passe par une contrepassation.">
    <Status error={error}/><section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><Badge value={data.run.status}/><div className="flex flex-wrap gap-2">{(actions[data.run.status]??[]).map(name=><button key={name} disabled={!!busy} onClick={()=>action(name)} className="rounded border border-sky-700 px-3 py-2 text-sm font-semibold text-sky-800 focus:ring-2 focus:ring-sky-500 disabled:opacity-50">{busy===name?'Traitement…':labels[name]}</button>)}</div></div></section>
    {data.lines.length===0?<Empty label="Aucun résultat calculé."/>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><Th>Employé</Th><Th>Brut</Th><Th>Net payable</Th><Th>Coût employeur</Th></tr></thead><tbody>{data.lines.map(({line,employeeName,employeeEmail})=><tr key={line.id} className="border-t"><Td><b>{employeeName}</b><br/><span className="text-xs text-slate-500">{employeeEmail}</span></Td><Td>{money(line.grossSalary)}</Td><Td>{money(line.netPayable)}</Td><Td>{money(line.totalEmployerCost)}</Td></tr>)}</tbody></table></div>}
    <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Preuves de calcul ({data.traces.length})</summary><pre className="mt-3 max-h-96 overflow-auto rounded bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(data.traces,null,2)}</pre></details>
  </Workspace>;
}

type PayrollResourceName = 'regulations' | 'settings' | 'components' | 'structures' | 'assignments' | 'adjustments';
const resourceLabels: Record<PayrollResourceName,[string,string]> = { regulations:['Réglementation','Provenance, dates effectives et statut de validation.'], settings:['Paramètres de paie','Versions de configuration immuables après publication.'], components:['Composantes salariales','Gains, retenues, contributions et formules sécurisées.'], structures:['Structures salariales','Assemblages versionnés de composantes publiées.'], assignments:['Affectations salariales','Structure et salaire de base effectifs par employé.'], adjustments:['Ajustements','Primes, corrections et retenues soumises à approbation.'] };

type RegulationRow = { pack: Json; version: Json | null };
type SettingsRow = Json & { id: string; versionNo: number; status: string; settings: Json; publishedAt: string | null };
type ComponentRow = { component: Json & { id: string; name: string }; version: Json | null };
type StructureRow = { template: Json & { id: string; name: string }; version: Json | null };
type AssignmentRow = { assignment: Json & { id: string; baseSalary: string; effectiveDate: string }; employeeName: string | null };
type AdjustmentRow = Json & { id: string };
type EmployeeRow = Json & { employeeId: string; userId: string | null; employeeCode: string | null; name: string | null };

const inputCls = 'w-full rounded border px-3 py-2 text-sm';
const str = (v: unknown, fb = '—') => (v === null || v === undefined || v === '' ? fb : String(v));
const day = (v: unknown) => str(v).slice(0, 10);

function useList<T>(resource: string) {
  const [rows, setRows] = useState<T[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => { setLoading(true); return api<T[]>(`/api/workforce/payroll/config?resource=${resource}`).then(setRows).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [resource]);
  useEffect(() => { void load(); }, [load]);
  return { rows, error, loading, load };
}
function useMutation(reload: () => Promise<unknown>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true); setError('');
    try { await fn(); await reload(); } catch (e) { setError(e instanceof Error ? e.message : 'Erreur'); } finally { setBusy(false); }
  }, [reload]);
  return { busy, error, run };
}
function List({ head, children }: { head: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr>{head.map(h => <Th key={h}>{h}</Th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>{children}</label>;
}
function CreateForm({ title, busy, onSubmit, children }: { title: string; busy: boolean; onSubmit: () => void; children: React.ReactNode }) {
  return <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">{title}</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{children}</div><div className="mt-4 flex justify-end"><button disabled={busy} onClick={onSubmit} className="rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Créer'}</button></div></section>;
}
function Compliance() {
  return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Les taux et règles affichés sont configurés, pas juridiquement certifiés. Toute publication exige une revue professionnelle externe.</p>;
}
function componentValue(v: Json | null): string {
  if (!v) return '—';
  const type = str(v.valueType);
  if (type === 'fixed') return money(v.fixedValue);
  if (type === 'percent') return `${(Number(v.percentBp ?? 0) / 100).toLocaleString('fr-MA')}%${v.percentOf ? ` de ${str(v.percentOf)}` : ''}`;
  if (type === 'formula') return str(v.formula);
  return '—';
}

export function PayrollResource({ resource }: { resource: PayrollResourceName }) {
  switch (resource) {
    case 'regulations': return <RegulationsView />;
    case 'settings': return <SettingsView />;
    case 'components': return <ComponentsView />;
    case 'structures': return <StructuresView />;
    case 'assignments': return <AssignmentsView />;
    case 'adjustments': return <AdjustmentsView />;
  }
}

function RegulationsView() {
  const { rows, error, loading } = useList<RegulationRow>('regulations');
  return <Workspace title={resourceLabels.regulations[0]} description={resourceLabels.regulations[1]}>
    <Status error={error} loading={loading} />
    {rows.length === 0 && !loading ? <Empty label="Aucune réglementation." /> : <List head={['Code', 'Nom', 'Juridiction', 'Statut', 'Validation', 'Version', 'Effectif', 'Échéance']}>{rows.map((row, i) => <tr key={str(row.pack?.id, String(i))} className="border-t"><Td>{str(row.pack?.code)}</Td><Td>{str(row.pack?.name)}</Td><Td>{str(row.pack?.jurisdiction)}</Td><Td><Badge value={str(row.pack?.status)} /></Td><Td><Badge value={str(row.pack?.validationStatus)} /></Td><Td>{str(row.version?.versionLabel)}</Td><Td>{day(row.version?.effectiveFrom)}</Td><Td>{day(row.version?.effectiveTo)}</Td></tr>)}</List>}
    <Compliance />
  </Workspace>;
}

function SettingsView() {
  const { rows, error, loading, load } = useList<SettingsRow>('settings');
  const { busy, error: mutErr, run } = useMutation(load);
  const [currency, setCurrency] = useState('MAD');
  const [payFrequency, setPayFrequency] = useState('monthly');
  const [cutoffDay, setCutoffDay] = useState('25');
  const [paymentDay, setPaymentDay] = useState('1');
  const [rounding, setRounding] = useState('half_up');
  const [cnssId, setCnssId] = useState('');
  return <Workspace title={resourceLabels.settings[0]} description={resourceLabels.settings[1]}>
    <Status error={error || mutErr} loading={loading} />
    <CreateForm title="Nouvelle version de paramètres" busy={busy} onSubmit={() => run(() => api('/api/workforce/payroll/config', { method: 'POST', body: JSON.stringify({ resource: 'settings', settings: { currency, payFrequency, cutoffDay: Number(cutoffDay), paymentDay: Number(paymentDay), defaultRounding: rounding, employerCnssId: cnssId } }) }))}>
      <Field label="Devise"><input className={inputCls} value={currency} onChange={e => setCurrency(e.target.value)} /></Field>
      <Field label="Fréquence de paie"><select className={inputCls} value={payFrequency} onChange={e => setPayFrequency(e.target.value)}><option value="monthly">Mensuelle</option></select></Field>
      <Field label="Jour d'arrêté"><input className={inputCls} type="number" value={cutoffDay} onChange={e => setCutoffDay(e.target.value)} /></Field>
      <Field label="Jour de paiement"><input className={inputCls} type="number" value={paymentDay} onChange={e => setPaymentDay(e.target.value)} /></Field>
      <Field label="Arrondi"><select className={inputCls} value={rounding} onChange={e => setRounding(e.target.value)}><option value="half_up">Demi supérieur</option></select></Field>
      <Field label="Identifiant CNSS employeur"><input className={inputCls} value={cnssId} onChange={e => setCnssId(e.target.value)} /></Field>
    </CreateForm>
    {rows.length === 0 && !loading ? <Empty label="Aucune version de paramètres." /> : <List head={['Version', 'Statut', 'Paramètres', 'Publié le', '']}>{rows.map(row => <tr key={row.id} className="border-t"><Td>v{row.versionNo}</Td><Td><Badge value={row.status} /></Td><Td><pre className="max-w-md whitespace-pre-wrap text-xs text-slate-600">{JSON.stringify(row.settings, null, 2)}</pre></Td><Td>{day(row.publishedAt)}</Td><Td>{row.status === 'draft' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/settings/${row.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'publish' }) }))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Publier</button>}</Td></tr>)}</List>}
    <Compliance />
  </Workspace>;
}

function ComponentsView() {
  const { rows, error, loading, load } = useList<ComponentRow>('components');
  const { busy, error: mutErr, run } = useMutation(load);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [componentType, setComponentType] = useState('earning');
  const [valueType, setValueType] = useState('fixed');
  const [fixedValue, setFixedValue] = useState('');
  const [percentOf, setPercentOf] = useState('base_salary');
  const [percentBp, setPercentBp] = useState('');
  const [formula, setFormula] = useState('');
  const [taxable, setTaxable] = useState(true);
  const [contributable, setContributable] = useState(true);
  const [proratable, setProratable] = useState(true);
  function create() {
    const body: Json = { resource: 'components', code, name, componentType, valueType, taxable, contributable, proratable };
    if (valueType === 'fixed') body.fixedValue = fixedValue || null;
    else if (valueType === 'percent') { body.percentOf = percentOf || null; body.percentBp = percentBp ? Number(percentBp) : null; }
    else { body.formula = formula || null; }
    return run(() => api('/api/workforce/payroll/config', { method: 'POST', body: JSON.stringify(body) }));
  }
  return <Workspace title={resourceLabels.components[0]} description={resourceLabels.components[1]}>
    <Status error={error || mutErr} loading={loading} />
    <CreateForm title="Nouvelle composante salariale" busy={busy} onSubmit={create}>
      <Field label="Code (majuscules/underscore)"><input className={inputCls} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="EX: CNSS_EMPLOYER" /></Field>
      <Field label="Nom"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field>
      <Field label="Type"><select className={inputCls} value={componentType} onChange={e => setComponentType(e.target.value)}><option value="earning">Gain</option><option value="deduction">Retenue</option><option value="employer">Employeur</option><option value="info">Info</option></select></Field>
      <Field label="Mode de calcul"><select className={inputCls} value={valueType} onChange={e => setValueType(e.target.value)}><option value="fixed">Fixe</option><option value="percent">Pourcentage</option><option value="formula">Formule</option></select></Field>
      {valueType === 'fixed' && <Field label="Montant fixe (MAD)"><input className={inputCls} value={fixedValue} onChange={e => setFixedValue(e.target.value)} placeholder="0.00" /></Field>}
      {valueType === 'percent' && <><Field label="Base (clé)"><input className={inputCls} value={percentOf} onChange={e => setPercentOf(e.target.value)} /></Field><Field label="Points de base (1% = 100)"><input className={inputCls} type="number" value={percentBp} onChange={e => setPercentBp(e.target.value)} /></Field></>}
      {valueType === 'formula' && <Field label="Formule"><input className={inputCls} value={formula} onChange={e => setFormula(e.target.value)} placeholder="base_salary * 0.05" /></Field>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={taxable} onChange={e => setTaxable(e.target.checked)} />Imposable</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={contributable} onChange={e => setContributable(e.target.checked)} />Soumis à cotisation</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={proratable} onChange={e => setProratable(e.target.checked)} />Proratisable</label>
    </CreateForm>
    {rows.length === 0 && !loading ? <Empty label="Aucune composante." /> : <List head={['Code', 'Nom', 'Type', 'Valeur', 'Statut', '']}>{rows.map(row => { const v = row.version; const vid = v ? String(v.id) : String(row.component.id); const status = v ? String(v.status) : ''; return <tr key={vid} className="border-t"><Td>{str(v?.code)}</Td><Td>{str(v?.name)}</Td><Td>{str(v?.componentType)}</Td><Td>{componentValue(v)}</Td><Td>{v && <Badge value={status} />}</Td><Td>{v && <div className="flex gap-2">{status !== 'published' && status !== 'retired' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/components/${vid}/action`, { method: 'POST', body: JSON.stringify({ action: 'publish' }) }))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Publier</button>}{status !== 'retired' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/components/${vid}/action`, { method: 'POST', body: JSON.stringify({ action: 'retire' }) }))} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Retirer</button>}</div>}</Td></tr>; })}</List>}
    <Compliance />
  </Workspace>;
}

function StructuresView() {
  const { rows, error, loading, load } = useList<StructureRow>('structures');
  const { busy, error: mutErr, run } = useMutation(load);
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  useEffect(() => { void api<ComponentRow[]>('/api/workforce/payroll/config?resource=components').then(setComponents).catch(() => {}); }, []);
  const published = components.filter(c => c.version && c.version.status === 'published');
  function toggle(id: string) { setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]); }
  function create() {
    const body: Json = { resource: 'structures', name, componentVersionIds: selected };
    if (effectiveFrom) body.effectiveFrom = effectiveFrom;
    return run(() => api('/api/workforce/payroll/config', { method: 'POST', body: JSON.stringify(body) }));
  }
  return <Workspace title={resourceLabels.structures[0]} description={resourceLabels.structures[1]}>
    <Status error={error || mutErr} loading={loading} />
    <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Nouvelle structure salariale</h2><div className="mt-3 grid gap-3 sm:grid-cols-2"><Field label="Nom"><input className={inputCls} value={name} onChange={e => setName(e.target.value)} /></Field><Field label="Date d'effet (optionnel)"><input className={inputCls} type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} /></Field></div><div className="mt-3"><p className="text-xs font-semibold text-slate-600">Composantes publiées</p>{published.length === 0 ? <p className="text-sm text-slate-500">Aucune composante publiée.</p> : <div className="mt-2 grid gap-1 sm:grid-cols-2">{published.map(c => <label key={String(c.version!.id)} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(String(c.version!.id))} onChange={() => toggle(String(c.version!.id))} />{str(c.version!.code)} — {str(c.version!.name)}</label>)}</div>}</div><div className="mt-4 flex justify-end"><button disabled={busy || selected.length === 0} onClick={create} className="rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Enregistrement…' : 'Créer'}</button></div></section>
    {rows.length === 0 && !loading ? <Empty label="Aucune structure." /> : <List head={['Modèle', 'Version', 'Statut', 'Effectif', 'Échéance', '']}>{rows.map(row => { const v = row.version; const vid = v ? String(v.id) : String(row.template.id); const status = v ? String(v.status) : ''; return <tr key={vid} className="border-t"><Td>{str(row.template?.name)}</Td><Td>{str(v?.name)}</Td><Td>{v && <Badge value={status} />}</Td><Td>{day(v?.effectiveFrom)}</Td><Td>{day(v?.effectiveTo)}</Td><Td>{v && <div className="flex flex-wrap gap-2">{status !== 'published' && status !== 'retired' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/structures/${vid}/action`, { method: 'POST', body: JSON.stringify({ action: 'review' }) }))} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Réviser</button>}{status !== 'published' && status !== 'retired' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/structures/${vid}/action`, { method: 'POST', body: JSON.stringify({ action: 'publish' }) }))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Publier</button>}{status !== 'retired' && <button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/structures/${vid}/action`, { method: 'POST', body: JSON.stringify({ action: 'retire' }) }))} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Retirer</button>}</div>}</Td></tr>; })}</List>}
    <Compliance />
  </Workspace>;
}

function AssignmentsView() {
  const { rows, error, loading, load } = useList<AssignmentRow>('assignments');
  const { busy, error: mutErr, run } = useMutation(load);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [structures, setStructures] = useState<StructureRow[]>([]);
  const [userId, setUserId] = useState('');
  const [structureVersionId, setStructureVersionId] = useState('');
  const [baseSalary, setBaseSalary] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  useEffect(() => {
    void api<EmployeeRow[]>('/api/workforce/payroll/config?resource=employees').then(setEmployees).catch(() => {});
    void api<StructureRow[]>('/api/workforce/payroll/config?resource=structures').then(setStructures).catch(() => {});
  }, []);
  const staff = employees.filter(e => e.userId);
  const publishedStructures = structures.filter(s => s.version && s.version.status === 'published');
  function create() {
    return run(() => api('/api/workforce/payroll/config', { method: 'POST', body: JSON.stringify({ resource: 'assignments', userId, structureVersionId, baseSalary, effectiveDate }) }));
  }
  return <Workspace title={resourceLabels.assignments[0]} description={resourceLabels.assignments[1]}>
    <Status error={error || mutErr} loading={loading} />
    <CreateForm title="Nouvelle affectation" busy={busy} onSubmit={create}>
      <Field label="Employé"><select className={inputCls} value={userId} onChange={e => setUserId(e.target.value)}><option value="">Sélectionner</option>{staff.map(e => <option key={String(e.userId)} value={String(e.userId)}>{str(e.name, str(e.userId))}</option>)}</select></Field>
      <Field label="Structure publiée"><select className={inputCls} value={structureVersionId} onChange={e => setStructureVersionId(e.target.value)}><option value="">Sélectionner</option>{publishedStructures.map(s => <option key={String(s.version!.id)} value={String(s.version!.id)}>{str(s.version!.name)}</option>)}</select></Field>
      <Field label="Salaire de base (MAD)"><input className={inputCls} value={baseSalary} onChange={e => setBaseSalary(e.target.value)} placeholder="0.00" /></Field>
      <Field label="Date d'effet"><input className={inputCls} type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} /></Field>
    </CreateForm>
    {rows.length === 0 && !loading ? <Empty label="Aucune affectation." /> : <List head={['Employé', 'Salaire de base', 'Date d\'effet']}>{rows.map(row => <tr key={String(row.assignment.id)} className="border-t"><Td>{str(row.employeeName, 'Sans compte')}</Td><Td>{money(row.assignment.baseSalary)}</Td><Td>{day(row.assignment.effectiveDate)}</Td></tr>)}</List>}
    <Compliance />
  </Workspace>;
}

function AdjustmentsView() {
  const { rows, error, loading, load } = useList<AdjustmentRow>('adjustments');
  const { busy, error: mutErr, run } = useMutation(load);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('bonus');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  useEffect(() => { void api<EmployeeRow[]>('/api/workforce/payroll/config?resource=employees').then(setEmployees).catch(() => {}); }, []);
  const staff = employees.filter(e => e.userId);
  const nameByUser = useMemo(() => new Map(employees.map(e => [String(e.userId), e.name ?? '—'])), [employees]);
  function create() {
    const emp = staff.find(e => e.employeeId === employeeId);
    if (!emp) return;
    return run(() => api('/api/workforce/payroll/config', { method: 'POST', body: JSON.stringify({ resource: 'adjustments', employeeId: emp.employeeId, userId: String(emp.userId), adjustmentType, amount, reason, year, month }) }));
  }
  return <Workspace title={resourceLabels.adjustments[0]} description={resourceLabels.adjustments[1]}>
    <Status error={error || mutErr} loading={loading} />
    <CreateForm title="Nouvel ajustement" busy={busy} onSubmit={create}>
      <Field label="Employé"><select className={inputCls} value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">Sélectionner</option>{staff.map(e => <option key={String(e.employeeId)} value={String(e.employeeId)}>{str(e.name, str(e.userId))}</option>)}</select></Field>
      <Field label="Type"><select className={inputCls} value={adjustmentType} onChange={e => setAdjustmentType(e.target.value)}><option value="bonus">Prime</option><option value="overtime">Heures sup.</option><option value="award">Récompense</option><option value="correction">Correction</option><option value="reimbursement">Remboursement</option><option value="deduction">Retenue</option><option value="recovery">Recouvrement</option></select></Field>
      <Field label="Montant (MAD)"><input className={inputCls} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" /></Field>
      <Field label="Motif"><input className={inputCls} value={reason} onChange={e => setReason(e.target.value)} /></Field>
      <Field label="Année"><input className={inputCls} type="number" value={year} onChange={e => setYear(Number(e.target.value))} /></Field>
      <Field label="Mois"><select className={inputCls} value={month} onChange={e => setMonth(Number(e.target.value))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></Field>
    </CreateForm>
    {rows.length === 0 && !loading ? <Empty label="Aucun ajustement." /> : <List head={['Employé', 'Type', 'Montant', 'Période', 'Motif', 'Statut', '']}>{rows.map(row => <tr key={row.id} className="border-t"><Td>{nameByUser.get(str(row.userId)) ?? '—'}</Td><Td>{str(row.adjustmentType)}</Td><Td>{money(row.amount)}</Td><Td>{str(row.effectivePeriodMonth, '').padStart(2, '0')}/{str(row.effectivePeriodYear)}</Td><Td>{str(row.reason)}</Td><Td><Badge value={str(row.status)} /></Td><Td>{row.status === 'submitted' && <div className="flex gap-2"><button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/adjustments/${row.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'approve' }) }))} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">Approuver</button><button disabled={busy} onClick={() => run(() => api(`/api/workforce/payroll/config/adjustments/${row.id}/action`, { method: 'POST', body: JSON.stringify({ action: 'reject' }) }))} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Refuser</button></div>}</Td></tr>)}</List>}
    <Compliance />
  </Workspace>;
}

export function PayrollPayments() {
  const [rows,setRows]=useState<Json[]>([]);const[runs,setRuns]=useState<Run[]>([]);const[error,setError]=useState('');const[busy,setBusy]=useState('');const[runId,setRunId]=useState('');
  const load=useCallback(()=>Promise.all([api<Json[]>('/api/workforce/payroll/payments'),api<Run[]>('/api/workforce/payroll/runs')]).then(([b,r])=>{setRows(b);setRuns(r.filter(x=>x.status==='posted'));}).catch(e=>setError(e.message)),[]);useEffect(()=>{void load();},[load]);
  async function create(){if(!runId)return;setBusy('create');setError('');try{await api('/api/workforce/payroll/payments',{method:'POST',body:JSON.stringify({runId,method:'bank'})});setRunId('');await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setBusy('')}}
  async function action(id:string,name:string){setBusy(id);setError('');try{await api(`/api/workforce/payroll/payments/${id}/action`,{method:'POST',body:JSON.stringify({action:name,reference:name==='reconcile'?`MANUAL-${Date.now()}`:undefined})});await load()}catch(e){setError(e instanceof Error?e.message:'Erreur')}finally{setBusy('')}}
  return <Workspace title="Lots de paiement" description="Aucun export bancaire ou DAMANCOM n’est certifié dans cette version."><Status error={error}/><section className="flex flex-wrap gap-3 rounded-xl border bg-white p-4"><select aria-label="Paie comptabilisée" className="min-w-64 rounded border px-3 py-2" value={runId} onChange={e=>setRunId(e.target.value)}><option value="">Sélectionner une paie comptabilisée</option>{runs.map(r=><option key={r.id} value={r.id}>{String(r.month).padStart(2,'0')}/{r.year} · {money(r.totals.net)}</option>)}</select><button disabled={!runId||!!busy} onClick={create} className="rounded bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Préparer le lot</button></section>{rows.length===0?<Empty label="Aucun lot de paiement."/>:<div className="grid gap-3 md:grid-cols-2">{rows.map(row=><article key={String(row.id)} className="rounded-xl border bg-white p-4"><div className="flex justify-between"><b>{String(row.method).toUpperCase()}</b><Badge value={String(row.status)}/></div><p className="mt-2 text-2xl font-bold">{money(row.totalAmount)}</p><p className="text-sm text-slate-500">Rapprochement: {String(row.reconciliationStatus)}</p><div className="mt-4 flex gap-2">{row.status==='prepared'&&<button disabled={busy===row.id} onClick={()=>action(String(row.id),'approve')} className="rounded border px-3 py-2 text-sm font-semibold">Approuver</button>}{(row.status==='approved'||row.status==='submitted')&&<button disabled={busy===row.id} onClick={()=>action(String(row.id),'reconcile')} className="rounded bg-sky-700 px-3 py-2 text-sm font-semibold text-white">Rapprocher</button>}{row.status==='paid'&&<button disabled={busy===row.id} onClick={()=>action(String(row.id),'reverse')} className="rounded border px-3 py-2 text-sm font-semibold text-red-700">Contrepasser</button>}</div></article>)}</div>}</Workspace>;
}

export function PayrollPayslips() {
  const [rows,setRows]=useState<Json[]>([]);const[error,setError]=useState('');
  useEffect(()=>{void api<Json[]>('/api/workforce/payroll/payslips').then(setRows).catch(e=>setError(e.message));},[]);
  return <Workspace title="Bulletins de paie" description="Bulletins numérotés et immuables; les corrections lient le remplacement à l’original."><Status error={error}/>{rows.length===0?<Empty label="Aucun bulletin émis."/>:<div className="overflow-x-auto rounded-xl border bg-white"><table className="min-w-full text-sm"><thead className="bg-slate-50 text-left"><tr><Th>Numéro</Th><Th>Employé</Th><Th>Période</Th><Th>Brut</Th><Th>Net</Th><Th>Statut</Th></tr></thead><tbody>{rows.map(row=><tr className="border-t" key={String(row.id)}><Td>{String(row.number??'—')}</Td><Td><b>{String(row.employeeName)}</b><br/><span className="text-xs text-slate-500">{String(row.employeeEmail)}</span></Td><Td>{String(row.month).padStart(2,'0')}/{String(row.year)}</Td><Td>{money(row.gross)}</Td><Td>{money(row.net)}</Td><Td><Badge value={String(row.status)}/></Td></tr>)}</tbody></table></div>}</Workspace>;
}
function Workspace({title,description,children}:{title:string;description?:string;children?:React.ReactNode}){const { locale } = useParams<{ locale: string }>();return <main className="space-y-5"><header><Link href={`/${locale}/dashboard/workforce`} className="text-sm font-semibold text-sky-700 underline">Workforce</Link><h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>{description&&<p className="mt-2 text-slate-600">{description}</p>}</header>{children}</main>}
function Status({error,loading}:{error?:string;loading?:boolean}){if(loading)return <p role="status" className="rounded bg-slate-100 p-3">Chargement…</p>;if(error)return <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>;return null}
function Empty({label}:{label:string}){return <div className="rounded-xl border border-dashed bg-white p-10 text-center text-slate-500">{label}</div>}
function Badge({value}:{value:string}){return <span className="inline-flex rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-800">{value.replaceAll('_',' ')}</span>}
function Th({children}:{children?:React.ReactNode}){return <th className="px-4 py-3 font-semibold">{children}</th>}function Td({children}:{children:React.ReactNode}){return <td className="px-4 py-3">{children}</td>}
