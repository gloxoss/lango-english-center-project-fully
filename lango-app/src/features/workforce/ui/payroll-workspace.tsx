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

const resourceLabels: Record<string,[string,string]> = { regulations:['Réglementation','Provenance, dates effectives et statut de validation.'], settings:['Paramètres de paie','Versions de configuration immuables après publication.'], components:['Composantes salariales','Gains, retenues, contributions et formules sécurisées.'], structures:['Structures salariales','Assemblages versionnés de composantes publiées.'], assignments:['Affectations salariales','Structure et salaire de base effectifs par employé.'], adjustments:['Ajustements','Primes, corrections et retenues soumises à approbation.'] };
export function PayrollResource({ resource }: { resource: keyof typeof resourceLabels }) {
  const [rows,setRows]=useState<unknown[]>([]);const[error,setError]=useState('');const[loading,setLoading]=useState(true);
  const load=useCallback(()=>{setLoading(true);return api<unknown[]>(`/api/workforce/payroll/config?resource=${resource}`).then(setRows).catch(e=>setError(e.message)).finally(()=>setLoading(false));},[resource]);
  useEffect(()=>{void load();},[load]);
  const [title,description]=resourceLabels[resource]!;
  return <Workspace title={title} description={description}><Status error={error} loading={loading}/>{rows.length===0&&!loading?<Empty label="Aucune donnée configurée."/>:<div className="space-y-3">{rows.map((row,i)=><article key={i} className="rounded-xl border bg-white p-4"><pre className="overflow-auto whitespace-pre-wrap text-xs text-slate-700">{JSON.stringify(row,null,2)}</pre></article>)}</div>}<p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Les taux et règles affichés sont configurés, pas juridiquement certifiés. Toute publication exige une revue professionnelle externe.</p></Workspace>;
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
