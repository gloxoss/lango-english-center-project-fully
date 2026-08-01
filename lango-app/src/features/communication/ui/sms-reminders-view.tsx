'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Send, AlertTriangle, Info, AlertCircle, CheckCircle2,
} from 'lucide-react';

type ApiAtRiskStudent = { id: string; name: string; className: string; riskLevel: string };
type ApiStudent = { id: string; fullName: string; phone: string | null; guardianName: string | null };
type ApiTemplate = { id: string; name: string; body: string };

type Recipient = { studentId: string; studentName: string; className: string; phone: string; guardianName: string };

export function SmsRemindersView() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/summary').then(r => r.json()),
      fetch('/api/students?pageSize=200').then(r => r.json()),
      fetch('/api/communication/templates').then(r => r.json()),
    ]).then(([summaryJson, studentsJson, templatesJson]) => {
      if (templatesJson.success) {
        setTemplates(templatesJson.data);
      }
      if (summaryJson.success && studentsJson.success) {
        const students: ApiStudent[] = studentsJson.data;
        const atRisk: ApiAtRiskStudent[] = summaryJson.data.atRiskStudents ?? [];
        const built = atRisk
          .map((r) => {
            const student = students.find(s => s.id === r.id);
            const phone = student?.phone;
            if (!phone) {
              return null;
            }
            return { studentId: r.id, studentName: r.name, className: r.className, phone, guardianName: student?.guardianName ?? '—' };
          })
          .filter((r): r is Recipient => r !== null);
        setRecipients(built);
        setSelectedIds(new Set(built.map(r => r.studentId)));
      }
    }).catch(err => console.error('Failed loading reminder data', err));
  }, []);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId) ?? null;

  async function handleSend() {
    if (!selectedTemplate) {
      setError('Sélectionnez un modèle de message.');
      return;
    }
    const targets = recipients.filter(r => selectedIds.has(r.studentId));
    if (targets.length === 0) {
      setError('Sélectionnez au moins un destinataire.');
      return;
    }
    setSending(true);
    setError(null);
    setSuccess(null);
    setSentCount(0);
    let sent = 0;
    for (const r of targets) {
      const body = selectedTemplate.body
        .replace(/\{nom_parent\}/g, r.guardianName)
        .replace(/\{nom_eleve\}/g, r.studentName)
        .replace(/\{ecole\}/g, '');
      try {
        const res = await fetch('/api/communication/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipientPhone: r.phone, studentId: r.studentId, body }),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          sent += 1;
          setSentCount(sent);
        }
      } catch (err) {
        console.error('Reminder send failed', err);
      }
    }
    setSuccess(`${sent} / ${targets.length} message(s) simulé(s) enregistré(s).`);
    setSending(false);
  }

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Envoyer des rappels</h1>
        <p className="text-xs text-slate-500 mt-1">Sélectionnez les destinataires à risque, un modèle, et envoyez.</p>
      </div>

      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5 text-amber-700 text-xs font-semibold">
        <Info className="w-4 h-4 shrink-0" />
        <span>Mode simulation : aucun SMS n&apos;est réellement envoyé. Les messages sont enregistrés dans le journal uniquement.</span>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-emerald-700 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-bold text-[#16212B]">{recipients.length} destinataire(s) à risque</span>
              <label className="flex items-center gap-2 text-xs font-bold text-[#2487B8] cursor-pointer">
                <span>Tout sélectionner</span>
                <input
                  type="checkbox"
                  checked={selectedIds.size === recipients.length && recipients.length > 0}
                  onChange={() => setSelectedIds(selectedIds.size === recipients.length ? new Set() : new Set(recipients.map(r => r.studentId)))}
                  className="w-4 h-4 accent-[#2487B8] rounded"
                />
              </label>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4 w-10 text-center"></th>
                    <th className="py-3 px-4">Élève</th>
                    <th className="py-3 px-4">Tuteur</th>
                    <th className="py-3 px-4">Téléphone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.length === 0 && (
                    <tr><td colSpan={4} className="py-8 px-4 text-center text-slate-400">Aucun élève à risque nécessitant un rappel.</td></tr>
                  )}
                  {recipients.map(r => (
                    <tr key={r.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <input type="checkbox" checked={selectedIds.has(r.studentId)} onChange={() => toggle(r.studentId)} className="w-4 h-4 accent-[#2487B8] rounded" />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-[#16212B]">{r.studentName}</p>
                        <p className="text-[10px] text-slate-400">{r.className}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.guardianName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-[#16212B]">Modèle & envoi</h3>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-full h-10 text-xs"><SelectValue placeholder="Sélectionnez un modèle" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedTemplate && (
              <div className="p-3 bg-[#DFF5F9] rounded-xl border border-[#0EA5C4]/20 text-xs text-[#16212B] whitespace-pre-wrap">
                {selectedTemplate.body}
              </div>
            )}

            <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Destinataires sélectionnés</span>
                <span className="font-extrabold text-[#16212B]">{selectedIds.size}</span>
              </div>
              {sending && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Envoyés</span>
                  <span className="font-extrabold text-[#16212B]">{sentCount} / {selectedIds.size}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={sending || !selectedTemplate || selectedIds.size === 0}
              className="w-full py-3 bg-[#0EA5C4] hover:bg-[#0B7A93] disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-md shadow-[#0EA5C4]/20 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Envoi en cours...' : 'Envoyer (simulation)'}</span>
            </button>
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h4 className="text-xs font-bold text-[#16212B]">D&apos;où viennent ces destinataires ?</h4>
            </div>
            <p className="text-[11px] text-slate-500">
              Élèves signalés à risque (absences répétées et/ou factures en retard), calculés à partir des données réelles de présence et de facturation.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
