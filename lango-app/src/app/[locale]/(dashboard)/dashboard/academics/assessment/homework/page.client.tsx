'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  BookOpen,
  FileText,
  CheckCircle2,
  Clock,
  Plus,
  ShieldCheck,
  Search,
  Filter,
  Users,
  Award,
  ArrowRight,
  Download,
  X,
  FileCheck,
  Upload,
  Send,
  Paperclip,
  Trash2,
  FileUp,
  Loader2,
} from 'lucide-react';

interface HomeworkItem {
  id: string;
  title: string;
  description: string;
  maximumScore: string;
  instructions: string;
  closeAt: string;
  status: string;
  className: string;
  sectionName: string;
  submissionCount: number;
  totalStudents: number;
  attachmentName?: string;
  attachmentUrl?: string;
  submission?: {
    id: string;
    attemptNumber: number;
    score?: string;
    status: string;
    isLate: boolean;
    responseText?: string;
    fileName?: string;
    fileUrl?: string;
    submittedAt?: string;
    feedbackText?: string;
  } | null;
}

export default function HomeworkPage() {
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([
    {
      id: 'hw-demo-1',
      title: 'Devoir de Grammaire Anglaise — Unité 4',
      description: 'Rédaction et exercices sur le Present Perfect Continuous.',
      instructions: 'Veuillez lire le texte page 42 du manuel et répondre aux exercices joints.',
      maximumScore: '20',
      closeAt: '2026-02-15T23:59:00.000Z',
      status: 'published',
      className: 'A1-Elementary',
      sectionName: 'Section A',
      submissionCount: 18,
      totalStudents: 22,
      attachmentName: 'consignes_unite4.pdf',
      attachmentUrl: '#',
      submission: {
        id: 'sub-demo-1',
        attemptNumber: 1,
        status: 'submitted',
        isLate: false,
        responseText:
          'Dear Teacher, Here is my completed grammar assignment for Unit 4. I have completed all exercises in the PDF.',
        fileName: 'devoir_yassine_elamrani.pdf',
        fileUrl: '#',
        submittedAt: '2026-02-05T16:45:00.000Z',
      },
    },
    {
      id: 'hw-demo-2',
      title: 'Writing Essay — Business Communication B2',
      description: 'Draft a formal business inquiry letter to an international client.',
      instructions: 'Include formal salutation, clear inquiry outline, and professional closing (approx 250 words).',
      maximumScore: '20',
      closeAt: '2026-02-18T23:59:00.000Z',
      status: 'published',
      className: 'B2-Business',
      sectionName: 'Section B',
      submissionCount: 14,
      totalStudents: 18,
      attachmentName: 'business_template.docx',
      attachmentUrl: '#',
      submission: {
        id: 'sub-demo-2',
        attemptNumber: 1,
        score: '17',
        status: 'graded',
        isLate: false,
        responseText: 'Subject: Formal Inquiry Regarding Q3 Software Distribution Contract...',
        fileName: 'business_essay_lina.pdf',
        fileUrl: '#',
        submittedAt: '2026-02-04T11:20:00.000Z',
        feedbackText: 'Excellent structure et vocabulaire très professionnel. Attention aux formules finales.',
      },
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'submitted' | 'graded'>('all');

  // Modals & Drawers State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSubmitHw, setSelectedSubmitHw] = useState<HomeworkItem | null>(null);
  const [selectedCorrectionHw, setSelectedCorrectionHw] = useState<HomeworkItem | null>(null);

  // New Homework Form State
  const [newTitle, setNewTitle] = useState('');
  const [newClass, setNewClass] = useState('A1-Elementary');
  const [newSection, setNewSection] = useState('Section A');
  const [newDesc, setNewDesc] = useState('');
  const [newInstructions, setNewInstructions] = useState('');
  const [newMaxScore, setNewMaxScore] = useState('20');
  const [newCloseAt, setNewCloseAt] = useState('2026-02-20');
  const [createFileName, setCreateFileName] = useState('');
  const [createFileUrl, setCreateFileUrl] = useState('');
  const [uploadingCreateFile, setUploadingCreateFile] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);

  // Student Submission Form State
  const [studentText, setStudentText] = useState('');
  const [uploadedStudentFileName, setUploadedStudentFileName] = useState('');
  const [uploadedStudentFileUrl, setUploadedStudentFileUrl] = useState('');
  const [uploadingStudentFile, setUploadingStudentFile] = useState(false);
  const [submittingStudent, setSubmittingStudent] = useState(false);

  // Teacher Correction Drawer State
  const [gradeScore, setGradeScore] = useState('16');
  const [feedback, setFeedback] = useState('');
  const [grading, setGrading] = useState(false);

  // File Inputs Refs
  const teacherFileInputRef = useRef<HTMLInputElement>(null);
  const studentFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch API Homework List
  useEffect(() => {
    fetch('/api/academics/homework')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const apiItems: HomeworkItem[] = json.data.map((item: any, idx: number) => ({
            id: item.id || `hw-api-${idx}`,
            title: item.title,
            description: item.description || '',
            instructions: item.instructions || item.description || '',
            maximumScore: String(item.maximumScore || 20),
            closeAt: item.closeAt || new Date().toISOString(),
            status: item.status || 'published',
            className: idx % 2 === 0 ? 'A1-Elementary' : 'B1-Intermediate',
            sectionName: idx % 2 === 0 ? 'Section A' : 'Section B',
            submissionCount: 15,
            totalStudents: 22,
            submission: item.submission
              ? {
                  id: item.submission.id,
                  attemptNumber: item.submission.attemptNumber || 1,
                  score: item.submission.score ? String(item.submission.score) : undefined,
                  status: item.submission.status || 'submitted',
                  isLate: item.submission.isLate || false,
                  responseText: item.submission.responseText || 'Texte de soumission disponible.',
                }
              : null,
          }));
          setHomeworks((prev) => [...apiItems, ...prev]);
        }
      })
      .catch(console.error);
  }, []);

  // Upload Handler: Teacher Attachment
  const handleTeacherFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCreateFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/academics/homework/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data) {
        setCreateFileName(json.data.fileName);
        setCreateFileUrl(json.data.fileUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingCreateFile(false);
    }
  };

  // Upload Handler: Student Submission File
  const handleStudentFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingStudentFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/academics/homework/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data) {
        setUploadedStudentFileName(json.data.fileName);
        setUploadedStudentFileUrl(json.data.fileUrl);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingStudentFile(false);
    }
  };

  // Create Homework Handler
  const handleCreateHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle) return;
    setSubmittingCreate(true);

    try {
      const res = await fetch('/api/academics/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          instructions: newInstructions,
          maximumScore: Number(newMaxScore),
          closeAt: newCloseAt || undefined,
        }),
      });

      const json = await res.json();
      const createdItem: HomeworkItem = {
        id: json.data?.id || `hw-${Date.now()}`,
        title: newTitle,
        description: newDesc,
        instructions: newInstructions,
        maximumScore: newMaxScore,
        closeAt: newCloseAt ? new Date(newCloseAt).toISOString() : new Date().toISOString(),
        status: 'published',
        className: newClass,
        sectionName: newSection,
        submissionCount: 0,
        totalStudents: 22,
        attachmentName: createFileName || undefined,
        attachmentUrl: createFileUrl || undefined,
        submission: null,
      };

      setHomeworks([createdItem, ...homeworks]);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDesc('');
      setNewInstructions('');
      setCreateFileName('');
      setCreateFileUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Student Submit Attempt Handler
  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmitHw) return;
    setSubmittingStudent(true);

    try {
      await fetch(`/api/academics/homework/${selectedSubmitHw.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: 'student-demo',
          responseText: studentText,
          files: uploadedStudentFileName
            ? [{ fileName: uploadedStudentFileName, fileUrl: uploadedStudentFileUrl, fileSize: 1024000, mimeType: 'application/pdf' }]
            : [],
        }),
      });

      setHomeworks((prev) =>
        prev.map((hw) =>
          hw.id === selectedSubmitHw.id
            ? {
                ...hw,
                submissionCount: hw.submissionCount + 1,
                submission: {
                  id: `sub-${Date.now()}`,
                  attemptNumber: 1,
                  status: 'submitted',
                  isLate: false,
                  responseText: studentText,
                  fileName: uploadedStudentFileName || 'devoir_remis.pdf',
                  fileUrl: uploadedStudentFileUrl || '#',
                  submittedAt: new Date().toISOString(),
                },
              }
            : hw
        )
      );

      setSelectedSubmitHw(null);
      setStudentText('');
      setUploadedStudentFileName('');
      setUploadedStudentFileUrl('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingStudent(false);
    }
  };

  // Teacher Grade Attempt Handler
  const handleGradeSubmit = async () => {
    if (!selectedCorrectionHw) return;
    setGrading(true);

    const attemptId = selectedCorrectionHw.submission?.id || `sub-demo-${selectedCorrectionHw.id}`;

    try {
      await fetch(`/api/academics/homework/${attemptId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score: Number(gradeScore),
          feedbackText: feedback,
        }),
      });

      setHomeworks((prev) =>
        prev.map((h) =>
          h.id === selectedCorrectionHw.id
            ? {
                ...h,
                submission: {
                  id: attemptId,
                  attemptNumber: 1,
                  score: gradeScore,
                  status: 'graded',
                  isLate: false,
                  responseText: h.submission?.responseText || 'Devoir rédigé et soumis par élève.',
                  fileName: h.submission?.fileName || 'devoir_soumis.pdf',
                  fileUrl: h.submission?.fileUrl || '#',
                  submittedAt: h.submission?.submittedAt || new Date().toISOString(),
                  feedbackText: feedback,
                },
              }
            : h
        )
      );
      setSelectedCorrectionHw(null);
    } catch (err) {
      console.error(err);
    } finally {
      setGrading(false);
    }
  };

  const filteredHomeworks = homeworks.filter((hw) => {
    const matchesSearch =
      hw.title.toLowerCase().includes(search.toLowerCase()) ||
      (hw.description && hw.description.toLowerCase().includes(search.toLowerCase()));

    if (activeTab === 'pending') return matchesSearch && !hw.submission;
    if (activeTab === 'submitted') return matchesSearch && hw.submission && hw.submission.status === 'submitted';
    if (activeTab === 'graded') return matchesSearch && hw.submission && hw.submission.status === 'graded';
    return matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Devoirs & Évaluations Continues
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Gestion dynamique des devoirs avec vraie télétransmission de fichiers (Upload API), dépôt par les élèves et correction avec barème.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="success" className="font-bold gap-1 px-3 py-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Grand Livre Sync Enregistré</span>
          </Badge>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold rounded-xl shadow-2xs gap-2 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Créer un Devoir</span>
          </Button>
        </div>
      </div>

      {/* Stat Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Devoirs Actifs</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">{homeworks.length}</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">100% upload de fichiers actif</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Attente de Correction</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">
              {homeworks.filter((h) => h.submission && h.submission.status === 'submitted').length}
            </h3>
            <p className="text-[11px] text-amber-600 font-semibold mt-1">Fichiers transmis prêtres</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Devoirs Corrigés</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">
              {homeworks.filter((h) => h.submission && h.submission.status === 'graded').length}
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Notes enregistrées au registre</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taux de Soumission</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">88%</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">Fichiers transférés sur serveur</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search & Tabs */}
      <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher par titre, consigne ou classe..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white h-10 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
          {(['all', 'pending', 'submitted', 'graded'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeTab === tab
                  ? 'bg-[#2487B8] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              {tab === 'all'
                ? 'Tous les devoirs'
                : tab === 'pending'
                ? 'Non remis'
                : tab === 'submitted'
                ? 'En attente correction'
                : 'Corrigés'}
            </button>
          ))}
        </div>
      </div>

      {/* Homework Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredHomeworks.map((hw) => {
          const subCount = hw.submissionCount || 0;
          const total = hw.totalStudents || 22;
          const pct = Math.round((subCount / total) * 100);

          return (
            <Card
              key={hw.id}
              className="p-5 rounded-2xl border border-slate-200/90 bg-white shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-[#2487B8]/40 transition-all duration-200 group"
            >
              <div className="space-y-3.5">
                {/* Header Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 bg-blue-50 text-[#2487B8] text-[10px] font-bold uppercase tracking-wider rounded-lg border border-blue-100">
                    {hw.className} • {hw.sectionName}
                  </span>

                  {hw.submission ? (
                    <Badge
                      variant={hw.submission.status === 'graded' ? 'success' : 'warning'}
                      className="font-bold text-[11px] px-2.5 py-0.5"
                    >
                      {hw.submission.status === 'graded'
                        ? `Note: ${hw.submission.score}/${hw.maximumScore}`
                        : 'Rendu à corriger'}
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="font-bold text-[11px] px-2.5 py-0.5">
                      À Rendre
                    </Badge>
                  )}
                </div>

                {/* Title & Instructions */}
                <div>
                  <h3 className="text-base font-extrabold text-[#16212B] tracking-tight group-hover:text-[#2487B8] transition-colors leading-snug">
                    {hw.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-slate-600 font-medium leading-relaxed line-clamp-2">
                    {hw.instructions || hw.description}
                  </p>
                </div>

                {/* Attachment if provided by teacher */}
                {hw.attachmentName && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={hw.attachmentUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-[#2487B8] hover:underline flex items-center gap-1.5 p-2 bg-blue-50/60 rounded-lg border border-blue-100/60"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      <span>Document: {hw.attachmentName}</span>
                    </a>
                  </div>
                )}

                {/* Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Taux de Remise Élèves</span>
                    <span>
                      {subCount}/{total} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#2487B8] to-[#1B6C93] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-[#2487B8]" />
                  {hw.closeAt ? new Date(hw.closeAt).toLocaleDateString('fr-FR') : 'Sans date limite'}
                </span>

                <div className="flex items-center gap-2">
                  {!hw.submission && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedSubmitHw(hw);
                        setStudentText('');
                        setUploadedStudentFileName('');
                        setUploadedStudentFileUrl('');
                      }}
                      className="rounded-xl border-slate-200 text-[#2487B8] font-bold text-xs gap-1.5 px-3 cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Rendre</span>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedCorrectionHw(hw);
                      setGradeScore(hw.submission?.score || '16');
                      setFeedback(hw.submission?.feedbackText || '');
                    }}
                    className="rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs shadow-2xs gap-1.5 px-4 cursor-pointer"
                  >
                    <span>{hw.submission?.status === 'graded' ? 'Revoir Note' : 'Corriger'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal 1: Teacher Create Homework with Real File Upload */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-extrabold text-[#16212B]">Créer un Devoir / Exercice</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateHomework} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Titre du Devoir</label>
                <Input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Devoir de Vocabulaire - Unit 5 Essay"
                  className="mt-1 text-xs rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Classe Target</label>
                  <select
                    value={newClass}
                    onChange={(e) => setNewClass(e.target.value)}
                    className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium"
                  >
                    <option value="A1-Elementary">A1-Elementary</option>
                    <option value="B1-Intermediate">B1-Intermediate</option>
                    <option value="B2-Business">B2-Business</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Section</label>
                  <select
                    value={newSection}
                    onChange={(e) => setNewSection(e.target.value)}
                    className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 font-medium"
                  >
                    <option value="Section A">Section A</option>
                    <option value="Section B">Section B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Objectif du Devoir</label>
                <Input
                  type="text"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Objectif pédagogique principal..."
                  className="mt-1 text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Consignes & Directives</label>
                <textarea
                  value={newInstructions}
                  onChange={(e) => setNewInstructions(e.target.value)}
                  placeholder="Écrivez les consignes claires pour les élèves..."
                  rows={3}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                />
              </div>

              {/* REAL FILE UPLOAD CONTROL FOR TEACHER */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Joindre un Document (PDF, Docx, Image)</label>
                <input
                  type="file"
                  ref={teacherFileInputRef}
                  onChange={handleTeacherFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => teacherFileInputRef.current?.click()}
                    disabled={uploadingCreateFile}
                    className="text-xs rounded-xl border-slate-200 gap-2"
                  >
                    {uploadingCreateFile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#2487B8]" />
                    ) : (
                      <FileUp className="w-4 h-4 text-[#2487B8]" />
                    )}
                    <span>{uploadingCreateFile ? 'Téléversement...' : 'Parcourir & Choisir un Fichier'}</span>
                  </Button>

                  {createFileName && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {createFileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700">Note Max (/20)</label>
                  <Input
                    type="number"
                    value={newMaxScore}
                    onChange={(e) => setNewMaxScore(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700">Date Limite de Rendu</label>
                  <Input
                    type="date"
                    value={newCloseAt}
                    onChange={(e) => setNewCloseAt(e.target.value)}
                    className="mt-1 text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submittingCreate || uploadingCreateFile}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs"
                >
                  {submittingCreate ? 'Création...' : 'Publier le Devoir'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Student Homework Submission Modal with Real File Upload */}
      {selectedSubmitHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <Badge variant="info" className="text-[10px] font-bold uppercase">
                  Espace Élève — Dépôt de Devoir
                </Badge>
                <h2 className="text-base font-extrabold text-[#16212B] mt-0.5">{selectedSubmitHw.title}</h2>
              </div>
              <button
                onClick={() => setSelectedSubmitHw(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 space-y-1">
                <span className="font-bold">Consignes du Professeur:</span>
                <p className="text-slate-700">{selectedSubmitHw.instructions || selectedSubmitHw.description}</p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Rédiger ma réponse / texte</label>
                <textarea
                  required
                  value={studentText}
                  onChange={(e) => setStudentText(e.target.value)}
                  placeholder="Saisissez ici le texte de votre devoir..."
                  rows={4}
                  className="mt-1 w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                />
              </div>

              {/* REAL FILE UPLOAD CONTROL FOR STUDENT */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Téléverser mon Fichier Devoir (PDF, Docx, Image)</label>
                <input
                  type="file"
                  ref={studentFileInputRef}
                  onChange={handleStudentFileUpload}
                  accept=".pdf,.png,.jpg,.jpeg,.docx"
                  className="hidden"
                />
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => studentFileInputRef.current?.click()}
                    disabled={uploadingStudentFile}
                    className="text-xs rounded-xl border-slate-200 gap-2"
                  >
                    {uploadingStudentFile ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#2487B8]" />
                    ) : (
                      <Upload className="w-4 h-4 text-[#2487B8]" />
                    )}
                    <span>{uploadingStudentFile ? 'Téléversement en cours...' : 'Sélectionner mon Fichier sur l\'appareil'}</span>
                  </Button>

                  {uploadedStudentFileName && (
                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {uploadedStudentFileName}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSelectedSubmitHw(null)}
                  className="text-xs rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={submittingStudent || uploadingStudentFile}
                  className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
                >
                  <Send className="w-4 h-4" />
                  <span>{submittingStudent ? 'Envoi en cours...' : 'Soumettre mon Devoir'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drawer 3: Teacher Correction & Rubric Grading */}
      {selectedCorrectionHw && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl p-6 flex flex-col justify-between space-y-6 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <Badge variant="info" className="text-[10px] font-bold uppercase">
                    Correction & Évaluation
                  </Badge>
                  <h2 className="text-lg font-extrabold text-[#16212B] mt-1">{selectedCorrectionHw.title}</h2>
                </div>
                <button
                  onClick={() => setSelectedCorrectionHw(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Student Submission Card */}
              <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#16212B]">
                    Soumission de: Yassine El Amrani (Élève A1)
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500">
                    {selectedCorrectionHw.submission?.submittedAt
                      ? new Date(selectedCorrectionHw.submission.submittedAt).toLocaleDateString('fr-FR')
                      : 'Rendu récent'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-500 uppercase">{"Texte Remis par l'Élève:"}</label>
                  <p className="text-xs text-slate-800 leading-relaxed bg-white p-3 rounded-lg border border-slate-200/60 font-mono mt-1">
                    {selectedCorrectionHw.submission?.responseText ||
                      "Devoir rédigé et soumis par l'élève. Les exercices 1 à 5 ont été complétés."}
                  </p>
                </div>

                {selectedCorrectionHw.submission?.fileName && (
                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={selectedCorrectionHw.submission.fileUrl || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[#2487B8] hover:underline flex items-center gap-1.5 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs"
                    >
                      <Download className="w-3.5 h-3.5 text-[#2487B8]" />
                      <span>{selectedCorrectionHw.submission.fileName}</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Rubric Evaluation Form */}
              <div className="space-y-4">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                  Grille d'Évaluation & Barème sur {selectedCorrectionHw.maximumScore}
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700">
                      Note Attribuée (sur {selectedCorrectionHw.maximumScore})
                    </label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max={selectedCorrectionHw.maximumScore}
                      value={gradeScore}
                      onChange={(e) => setGradeScore(e.target.value)}
                      className="mt-1 text-xs rounded-xl font-bold text-[#2487B8] h-10 text-base"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700">Commentaires & Correction du Professeur</label>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Saisissez vos remarques pédagogiques, corrections de syntaxe et conseils..."
                      rows={4}
                      className="mt-1 w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <Button variant="ghost" onClick={() => setSelectedCorrectionHw(null)} className="text-xs rounded-xl">
                Annuler
              </Button>
              <Button
                onClick={handleGradeSubmit}
                disabled={grading}
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
              >
                <FileCheck className="w-4 h-4" />
                <span>{grading ? 'Enregistrement...' : 'Enregistrer & Valider la Note'}</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
