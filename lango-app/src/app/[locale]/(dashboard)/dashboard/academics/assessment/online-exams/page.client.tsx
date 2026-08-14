'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Laptop,
  HelpCircle,
  Clock,
  ShieldAlert,
  CheckCircle2,
  Play,
  Activity,
  Plus,
  Search,
  Filter,
  Award,
  Zap,
  BarChart2,
  FileQuestion,
  UserCheck,
  Radio,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

export default function OnlineExamsPage() {
  const [activeTab, setActiveTab] = useState<'bank' | 'runner' | 'monitor'>('bank');

  // Question Authoring state
  const [qPrompt, setQPrompt] = useState('');
  const [qCategory, setQCategory] = useState('Grammar');
  const [qDifficulty, setQDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [qSuccess, setQSuccess] = useState(false);

  // Candidate Runner State
  const [attemptStarted, setAttemptStarted] = useState(false);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answersMap, setAnswersMap] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const sampleQuestions = [
    {
      id: 1,
      prompt: "Choose the correct past participle of the verb 'write':",
      options: ['wrote', 'written', 'writing', 'writes'],
      correct: 'written',
    },
    {
      id: 2,
      prompt: "Which sentence uses the present perfect continuous correctly?",
      options: [
        'She has been working here for three years.',
        'She is working here since three years.',
        'She worked here for three years ago.',
        'She has worked here yesterday.',
      ],
      correct: 'She has been working here for three years.',
    },
    {
      id: 3,
      prompt: "Fill in the blank: If I _____ enough money, I would travel around the world.",
      options: ['have', 'had', 'will have', 'would have'],
      correct: 'had',
    },
  ];

  const handleSelectOption = (opt: string) => {
    setAnswersMap({ ...answersMap, [currentQIndex]: opt });
  };

  const answeredCount = Object.keys(answersMap).length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Top Banner Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2487B8] to-[#1B6C93] flex items-center justify-center text-white shadow-2xs shrink-0">
            <Laptop className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
              Examens en Ligne & Banque de Questions
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Module Add-on: Banque d'épreuves, chronométrage serveur sécurisé, correction automatique et moniteur temps réel.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="info" className="font-bold gap-1 px-3 py-1.5 text-xs">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Masquage Anti-Triche Actif</span>
          </Badge>
        </div>
      </div>

      {/* Stat Summary Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Banque de Questions</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">248 Questions</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">4 Catégories (A1-C1)</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2487B8] flex items-center justify-center shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Épreuves en Ligne</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">12 Session Actives</h3>
            <p className="text-[11px] text-purple-600 font-semibold mt-1">Correction automatique</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Candidats Connectés</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">18 En Épreuve</h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">Latence serveur &lt; 40ms</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5" />
          </div>
        </Card>

        <Card className="p-5 rounded-2xl border border-slate-200/80 bg-white shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Taux d'Auto-Correction</span>
            <h3 className="text-2xl font-extrabold text-[#16212B] mt-1">92% Instantané</h3>
            <p className="text-[11px] text-slate-500 font-semibold mt-1">QCM & Short Text</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'bank', label: 'Banque de Questions & Studio', icon: HelpCircle },
          { id: 'runner', label: 'Testeur de Passage Élève', icon: Play },
          { id: 'monitor', label: 'Moniteur Temps Réel des Candidats', icon: Activity },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#2487B8] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <t.icon className="w-4 h-4" />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Question Bank Studio */}
      {activeTab === 'bank' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-1 space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">Créer une Question</h2>
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700">Catégorie d'Épreuve</label>
                <select
                  value={qCategory}
                  onChange={(e) => setQCategory(e.target.value)}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                >
                  <option value="Grammar">Grammar & Syntax</option>
                  <option value="Vocabulary">Vocabulary & Idioms</option>
                  <option value="Reading">Reading Comprehension</option>
                  <option value="Listening">Listening Audio</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Énoncé de la Question</label>
                <textarea
                  value={qPrompt}
                  onChange={(e) => setQPrompt(e.target.value)}
                  placeholder="Ex: Choose the correct past participle of the verb 'write'..."
                  rows={3}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Niveau de Difficulté</label>
                <select
                  value={qDifficulty}
                  onChange={(e) => setQDifficulty(e.target.value as any)}
                  className="mt-1 w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2487B8]"
                >
                  <option value="easy">Facile (A1-A2)</option>
                  <option value="medium">Moyen (B1-B2)</option>
                  <option value="hard">Difficile (C1-C2)</option>
                </select>
              </div>

              <Button
                onClick={() => {
                  if (!qPrompt) return;
                  setQSuccess(true);
                  setQPrompt('');
                  setTimeout(() => setQSuccess(false), 2000);
                }}
                className="w-full bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter à la Banque</span>
              </Button>

              {qSuccess && (
                <p className="text-xs text-emerald-700 font-bold text-center animate-in fade-in">
                  Question ajoutée avec succès à la banque !
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs lg:col-span-2 space-y-4">
            <h2 className="text-base font-extrabold text-[#16212B]">
              Banque de Questions d'Anglais (Grammaire & Vocabulaire)
            </h2>

            <div className="space-y-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="text-[10px]">
                      QCM Unique
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500">Grammar • B2</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#16212B] mt-1.5">
                    Choose the correct past participle of the verb 'write':
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Options: wrote, written, writing, writes</p>
                </div>
                <Badge variant="success" className="font-bold">
                  Moyen
                </Badge>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant="info" className="text-[10px]">
                      Texte Court
                    </Badge>
                    <span className="text-xs font-semibold text-slate-500">Syntax • B1</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#16212B] mt-1.5">
                    Fill in the blank: She _____ (to be) reading a book yesterday.
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Scoring: Exact string match ('was')</p>
                </div>
                <Badge variant="warning" className="font-bold">
                  Facile
                </Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Candidate Test Runner */}
      {activeTab === 'runner' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs max-w-3xl mx-auto space-y-6">
          {!attemptStarted ? (
            <div className="text-center space-y-4 py-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#2487B8] flex items-center justify-center mx-auto shadow-2xs">
                <Laptop className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-extrabold text-[#16212B]">Examen Officiel: Placement Test B2</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Durée: 45 minutes • 3 Questions au total. Sauvegarde automatique des réponses active. Les clés de réponses sont masquées par le serveur.
              </p>
              <Button
                onClick={() => setAttemptStarted(true)}
                className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl px-8 py-3 shadow-2xs gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Démarrer l'Épreuve</span>
              </Button>
            </div>
          ) : !submitted ? (
            <div className="space-y-6">
              {/* Header Timer Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-[#16212B]">
                    Question {currentQIndex + 1} sur {sampleQuestions.length}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-500 font-medium">
                    {answeredCount} sur {sampleQuestions.length} répondeus
                  </span>
                </div>

                <Badge variant="warning" className="gap-1.5 font-bold px-3 py-1 text-xs animate-pulse">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Temps restant: 44:28</span>
                </Badge>
              </div>

              {/* Question Navigation Grid */}
              <div className="flex items-center gap-2">
                {sampleQuestions.map((q, idx) => (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-9 h-9 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                      currentQIndex === idx
                        ? 'bg-[#2487B8] text-white shadow-2xs'
                        : answersMap[idx]
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Q{idx + 1}
                  </button>
                ))}
              </div>

              {/* Current Question Block */}
              <div className="space-y-4 p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
                <h3 className="text-base font-extrabold text-[#16212B]">
                  {sampleQuestions[currentQIndex]?.prompt}
                </h3>

                <div className="space-y-2.5 pt-2">
                  {sampleQuestions[currentQIndex]?.options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption(opt)}
                      className={`w-full text-left p-3.5 text-xs font-semibold rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        answersMap[currentQIndex] === opt
                          ? 'border-[#2487B8] bg-blue-50/80 text-[#2487B8] shadow-2xs'
                          : 'border-slate-200 bg-white hover:bg-slate-100/70 text-slate-700'
                      }`}
                    >
                      <span>{opt}</span>
                      <Radio
                        className={`w-4 h-4 ${
                          answersMap[currentQIndex] === opt ? 'text-[#2487B8]' : 'text-slate-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2">
                <Button
                  disabled={currentQIndex === 0}
                  onClick={() => setCurrentQIndex((prev) => prev - 1)}
                  variant="outline"
                  className="text-xs rounded-xl border-slate-200"
                >
                  Précédent
                </Button>

                {currentQIndex < sampleQuestions.length - 1 ? (
                  <Button
                    onClick={() => setCurrentQIndex((prev) => prev + 1)}
                    className="bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
                  >
                    <span>Suivant</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => setSubmitted(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Soumettre l'Épreuve</span>
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-4 animate-in fade-in duration-300">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-[#16212B]">Épreuve Soumise & Corrigée Automatiquement !</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Votre note a été enregistrée avec succès dans le Grand Livre Central.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 max-w-sm mx-auto space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase">Score Obtenu</span>
                <div className="text-2xl font-extrabold text-[#2487B8]">18.0 / 20</div>
                <Badge variant="success" className="font-bold text-[10px]">
                  Mention Très Bien
                </Badge>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  setAttemptStarted(false);
                  setSubmitted(false);
                  setAnswersMap({});
                  setCurrentQIndex(0);
                }}
                className="text-xs font-bold text-[#2487B8] gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Refaire un Test Démo</span>
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Tab 3: Live Monitor */}
      {activeTab === 'monitor' && (
        <Card className="p-6 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-[#16212B]">
              Moniteur Temps Réel des Candidats en Ligne
            </h2>
            <Badge variant="success" className="font-bold gap-1">
              <Activity className="w-3.5 h-3.5 animate-spin" />
              <span>Direct Actif</span>
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                <div>
                  <h4 className="font-bold text-[#16212B]">Yassine El Amrani</h4>
                  <p className="text-[11px] text-slate-500">Démarré à 14:15 | Temps restant: 32 min</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="font-semibold text-slate-600">Progression: 7/10 questions</span>
                <Button size="sm" variant="outline" className="text-[11px] font-bold rounded-lg border-slate-200">
                  +5 min Rallonge
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
