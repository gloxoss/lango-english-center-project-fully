'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import {
  Send,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle2,
  Bell,
  UserCheck,
} from 'lucide-react';

type ApiAtRiskStudent = { id: string; name: string; className: string; riskLevel: string };
type ApiStudent = { id: string; fullName: string; phone: string | null; guardianName: string | null };
type ApiTemplate = { id: string; name: string; body: string };
type ApiClassSection = { id: string; className: string; sectionName: string };

type Recipient = { studentId: string; studentName: string; className: string; phone: string; guardianName: string };

export function SmsRemindersView() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<ApiTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [classSections, setClassSections] = useState<ApiClassSection[]>([]);
  const [selectedClassSectionId, setSelectedClassSectionId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentCount, setSentCount] = useState(0);

  useEffect(() => {
    fetch('/api/academics/class-sections?pageSize=200')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data)) {
          setClassSections(json.data);
        }
      })
      .catch((err) => console.error('Failed loading class sections', err));
  }, []);

  useEffect(() => {
    const summaryUrl = selectedClassSectionId
      ? `/api/dashboard/summary?classSectionId=${encodeURIComponent(selectedClassSectionId)}`
      : '/api/dashboard/summary';
    Promise.all([
      fetch(summaryUrl).then((r) => r.json()),
      fetch('/api/students?pageSize=200').then((r) => r.json()),
      fetch('/api/communication/templates').then((r) => r.json()),
    ])
      .then(([summaryJson, studentsJson, templatesJson]) => {
        if (templatesJson.success) {
          setTemplates(templatesJson.data);
        }
        if (summaryJson.success && studentsJson.success) {
          const students: ApiStudent[] = studentsJson.data;
          const atRisk: ApiAtRiskStudent[] = summaryJson.data.atRiskStudents ?? [];
          const built = atRisk
            .map((r) => {
              const student = students.find((s) => s.id === r.id);
              const phone = student?.phone;
              if (!phone) {
                return null;
              }
              return {
                studentId: r.id,
                studentName: r.name,
                className: r.className,
                phone,
                guardianName: student?.guardianName ?? '—',
              };
            })
            .filter((r): r is Recipient => r !== null);
          setRecipients(built);
          setSelectedIds(new Set(built.map((r) => r.studentId)));
        }
      })
      .catch((err) => console.error('Failed loading reminder data', err));
  }, [selectedClassSectionId]);

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

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  async function handleSend() {
    if (!selectedTemplate) {
      setError('Sélectionnez un modèle de message.');
      return;
    }
    const targets = recipients.filter((r) => selectedIds.has(r.studentId));
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
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Envoyer des Rappels & Notifications
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Transmission automatique des rappels d'absences, d'impayés et de convocations aux examens.
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-semibold shadow-2xs">
        <Info className="w-4 h-4 shrink-0 text-amber-600" />
        <span>
          Mode simulation : aucun SMS n'est réellement envoyé. Les messages sont enregistrés dans le journal de l'établissement.
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-rose-800 text-xs font-bold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-emerald-800 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-xs font-extrabold text-[#16212B]">
                  {recipients.length} destinataire(s) nécessitant un rappel
                </span>
                <Select value={selectedClassSectionId || 'all'} onValueChange={(v) => setSelectedClassSectionId(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-56 h-9 text-xs rounded-lg border-slate-200">
                    <SelectValue placeholder="Toutes les classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les classes</SelectItem>
                    {classSections.map((cs) => (
                      <SelectItem key={cs.id} value={cs.id}>
                        {cs.className} {cs.sectionName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#2487B8] cursor-pointer">
                <span>Tout sélectionner</span>
                <input
                  type="checkbox"
                  checked={selectedIds.size === recipients.length && recipients.length > 0}
                  onChange={() =>
                    setSelectedIds(
                      selectedIds.size === recipients.length ? new Set() : new Set(recipients.map((r) => r.studentId))
                    )
                  }
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
                    <th className="py-3 px-4">Tuteur / Parent</th>
                    <th className="py-3 px-4">Téléphone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipients.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 px-4 text-center text-slate-400 font-medium">
                        Aucun élève à risque nécessitant un rappel immédiat.
                      </td>
                    </tr>
                  )}
                  {recipients.map((r) => (
                    <tr key={r.studentId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(r.studentId)}
                          onChange={() => toggle(r.studentId)}
                          className="w-4 h-4 accent-[#2487B8] rounded"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-extrabold text-[#16212B]">{r.studentName}</p>
                        <p className="text-[10px] text-slate-400 font-semibold">{r.className}</p>
                      </td>
                      <td className="py-3 px-4 text-slate-700 font-medium">{r.guardianName}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-600">{r.phone}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-4">
            <h3 className="text-sm font-extrabold text-[#16212B]">Sélection du Modèle & Envoi</h3>
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger className="w-full h-10 text-xs rounded-xl border-slate-200">
                <SelectValue placeholder="Sélectionnez un modèle de rappel" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedTemplate && (
              <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-100 text-xs text-[#16212B] whitespace-pre-wrap leading-relaxed">
                {selectedTemplate.body}
              </div>
            )}

            <div className="space-y-2 text-xs pt-2 border-t border-slate-100 font-medium">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Destinataires cochés</span>
                <span className="font-extrabold text-[#2487B8]">{selectedIds.size}</span>
              </div>
              {sending && (
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Envoyés</span>
                  <span className="font-extrabold text-[#16212B]">
                    {sentCount} / {selectedIds.size}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || !selectedTemplate || selectedIds.size === 0}
              className="w-full h-10 bg-[#2487B8] hover:bg-[#1B6C93] disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{sending ? 'Envoi en cours...' : 'Envoyer les Rappels (simulation)'}</span>
            </Button>
          </Card>

          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <h4 className="text-xs font-bold text-[#16212B]">Origine des Destinataires à Risque</h4>
            </div>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Élèves automatiquement identifiés par le grand livre académique (taux d'absence élevé ou factures en souffrance).
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
