'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Send, Mail, MessageSquare, Smartphone, Eye, Calendar, Users, Paperclip, CheckCircle2, Clock, Sparkles, Check
} from 'lucide-react';
import { CAMPAIGN_PRESETS, CampaignChannel } from '../data/campaign-composer-config';

export function CampaignComposerClient({ locale: _locale }: { locale?: string }) {
  const [activeChannel, setActiveChannel] = useState<CampaignChannel>('Email');
  const [campaignName, setCampaignName] = useState('Rappel Réunion de Rentrée 2025');
  const [subject, setSubject] = useState('Convocation à la Réunion de Rentrée Parents-Enseignants');
  const [studentFirstName, setStudentFirstName] = useState('Yassine');
  const [eventDate, setEventDate] = useState('15 Septembre 2025 à 18h00');
  const [selectedSegment, setSelectedSegment] = useState('Parents d\'élèves du Primaire');

  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('parent.test@lango.ma');
  const [scheduledDate, setScheduledDate] = useState('2025-09-01T10:00');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const handleTestSend = () => {
    setFeedbackMsg(`Un message test (${activeChannel}) a été envoyé à ${testRecipient}`);
    setIsTestModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  const handleScheduleSend = () => {
    setFeedbackMsg(`La campagne "${campaignName}" est programmée pour le ${new Date(scheduledDate).toLocaleString('fr-FR')}`);
    setIsScheduleModalOpen(false);
    setTimeout(() => setFeedbackMsg(null), 5000);
  };

  return (
    <div className="space-y-6 max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Éditeur de campagne multimédia</h1>
          <p className="text-xs text-slate-500 mt-1">Concevez et planifiez vos envois d&apos;emails, SMS et messages WhatsApp ciblés.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={() => setIsTestModalOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 text-xs rounded-xl border-slate-200 bg-white gap-1.5 font-bold text-[#16212B]"
          >
            <Eye className="w-3.5 h-3.5 text-slate-400" /> Aperçu test
          </Button>
          <Button
            onClick={() => setIsScheduleModalOpen(true)}
            size="sm"
            className="h-9 text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white gap-1.5 font-bold shadow-sm"
          >
            <Send className="w-3.5 h-3.5" /> Programmer l&apos;envoi
          </Button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-[#DDF5EC] border border-[#17A673]/30 rounded-2xl text-xs font-bold text-[#17A673] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Grid: 7 cols Form + 5 cols Preview */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <h2 className="text-xs font-extrabold text-[#16212B]">1. Choisissez le canal d&apos;envoi</h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveChannel('Email')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                  activeChannel === 'Email' ? 'border-[#2487B8] bg-[#DCEBF4]/40 text-[#1B6C93]' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <Mail className="w-4 h-4" /> Emailing
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('SMS')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                  activeChannel === 'SMS' ? 'border-[#2487B8] bg-[#DCEBF4]/40 text-[#1B6C93]' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <MessageSquare className="w-4 h-4" /> SMS Flash
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('WhatsApp')}
                className={`p-3 rounded-xl border flex items-center justify-center gap-2 font-bold text-xs transition-all ${
                  activeChannel === 'WhatsApp' ? 'border-[#2487B8] bg-[#DCEBF4]/40 text-[#1B6C93]' : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                <Smartphone className="w-4 h-4" /> WhatsApp Business
              </button>
            </div>

            <div className="space-y-3 pt-2">
              <h2 className="text-xs font-extrabold text-[#16212B]">2. Informations de la campagne</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Nom interne de la campagne</label>
                  <Input
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Segment des destinataires</label>
                  <select
                    value={selectedSegment}
                    onChange={(e) => setSelectedSegment(e.target.value)}
                    className="w-full h-9 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 font-medium text-slate-700"
                  >
                    <option>Parents d&apos;élèves du Primaire</option>
                    <option>Tous les Tuteurs / Parents</option>
                    <option>Parents d&apos;élèves du Lycée</option>
                    <option>Élèves Inscrits 2025</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400">Objet du message</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#16212B]">3. Variables dynamiques</h2>
                <Badge className="bg-[#DCEBF4] text-[#1B6C93] border-none text-[9px] font-bold">Champs de test</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Prénom de l&apos;élève ({"{{student_first_name}}"})</label>
                  <Input
                    value={studentFirstName}
                    onChange={(e) => setStudentFirstName(e.target.value)}
                    className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400">Date de l&apos;événement ({"{{event_date}}"})</label>
                  <Input
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="h-9 text-xs bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Preview */}
        <div className="xl:col-span-5 space-y-4">
          <Card className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-xs font-extrabold text-[#16212B]">Aperçu en temps réel ({activeChannel})</h2>
              <Badge className="bg-[#DDF5EC] text-[#17A673] border-none text-[9px] font-bold">Rendu exact</Badge>
            </div>

            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 space-y-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-100 pb-1.5 text-[10px]">
                  <span className="text-slate-400">De : Direction Lango</span>
                  <span className="text-slate-400">À : parents@lango.ma</span>
                </div>
                <p className="font-extrabold text-[#16212B]">{subject || 'Sans objet'}</p>
                <p className="text-slate-700 text-[11px] leading-relaxed">
                  Chers parents de <strong>{studentFirstName || 'Yassine'}</strong>,
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Nous avons le plaisir de vous inviter à la réunion d&apos;information qui se tiendra le <strong>{eventDate}</strong> dans le grand amphithéâtre du campus.
                </p>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  L&apos;équipe pédagogique présentera le programme de l&apos;année ainsi que l&apos;emploi du temps.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1 text-[10px]">
              <div className="flex justify-between"><span className="text-slate-400">Segment cible :</span><span className="font-bold text-[#16212B]">{selectedSegment}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Destinataires estimés :</span><span className="font-bold text-[#2487B8]">420 contacts</span></div>
              <div className="flex justify-between"><span className="text-slate-400">Coût estimé :</span><span className="font-bold text-emerald-700">Inclus dans le forfait</span></div>
            </div>
          </Card>
        </div>
      </div>

      {/* Test Send Dialog */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Envoyer un aperçu test ({activeChannel})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <p className="text-slate-500">Saisissez l&apos;adresse ou le numéro de téléphone pour recevoir un test d&apos;envoi instantané :</p>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Destinataire test *</label>
              <Input
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="email@domaine.com ou +212..."
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsTestModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleTestSend} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Envoyer le test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-[#16212B]">Programmer la campagne</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-xs pt-2">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date et heure de l&apos;envoi *</label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
              <p>✓ <strong>420 destinataires</strong> recevront cette campagne via <strong>{activeChannel}</strong>.</p>
              <p>✓ Les rapports de délivrabilité seront générés automatiquement.</p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsScheduleModalOpen(false)} className="rounded-xl text-xs h-9">
              Annuler
            </Button>
            <Button onClick={handleScheduleSend} className="rounded-xl text-xs h-9 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold">
              Confirmer la programmation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

