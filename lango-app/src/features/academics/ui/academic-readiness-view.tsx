'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Download,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Camera,
  ArrowRight,
} from 'lucide-react';

interface ReadinessCheck {
  id: string;
  title: string;
  score: number;
  status: 'conforme' | 'attention' | 'critique';
  detail: string;
  deepLink?: string;
  deepLinkLabel?: string;
}

interface TrendPoint {
  score: number;
  capturedAt: string;
}

interface ReadinessData {
  overallScore: number;
  weeklyTrendDelta?: number | null;
  trend: TrendPoint[];
  checks: ReadinessCheck[];
}

function Sparkline({ points }: { points: number[] }) {
  const w = 272;
  const h = 40;
  const min = Math.min(...points, 0);
  const max = Math.max(...points, 100);
  const range = max - min || 1;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * step;
    const y = h - ((p - min) / range) * h;
    return { x, y };
  });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-10 w-full">
      <polyline
        points={coords.map(c => `${c.x},${c.y}`).join(' ')}
        fill="none"
        stroke="#0066FF"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="#0066FF" />
      ))}
    </svg>
  );
}

const CHECK_DEEP_LINKS: Record<string, { href: string; label: string }> = {
  class_offerings: { href: '/dashboard/academics/classes', label: 'Gérer les offres de classes & sections' },
  primary_teachers: { href: '/dashboard/academics/class-section-teachers', label: 'Affecter les titulaires manquants' },
  subject_teachers: { href: '/dashboard/academics/assignments', label: 'Affecter les enseignants aux matières' },
  timetable_published: { href: '/dashboard/academics/schedule', label: 'Générer & publier l\'emploi du temps' },
  rooms_allocated: { href: '/dashboard/academics/rooms', label: 'Affecter les salles de cours' },
  student_placements: { href: '/dashboard/students', label: 'Affecter les élèves aux sections' },
};

export function AcademicReadinessView({ locale = 'fr' }: { locale?: string } = {}) {
  const { role } = usePermissions();
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const fetchReadiness = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/academics/readiness');
      const json = await res.json();
      if (json.success && json.data) {
        const checksWithLinks = (json.data.checks || []).map((c: ReadinessCheck) => {
          const dl = CHECK_DEEP_LINKS[c.id];
          const href = dl?.href ?? '/dashboard/academics/classes';
          const label = dl?.label ?? 'Examiner les éléments';
          return {
            ...c,
            deepLink: `/${locale}${href}`,
            deepLinkLabel: label,
          };
        });
        setData({
          overallScore: json.data.overallScore ?? 0,
          weeklyTrendDelta: json.data.weeklyTrendDelta ?? null,
          trend: json.data.trend ?? [],
          checks: checksWithLinks,
        });
      } else {
        setData(null);
        setError('Impossible de charger le bilan de préparation académique.');
      }
    } catch {
      setData(null);
      setError('Impossible de charger le bilan de préparation académique.');
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureSnapshot = async () => {
    setCapturing(true);
    try {
      const res = await fetch('/api/academics/readiness/snapshots', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchReadiness();
      }
    } catch {
      // Ignore — refresh is best-effort.
    } finally {
      setCapturing(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-[#0066FF]" />
            Bilan de Rentrée &amp; Préparation Académique
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Supervision temps réel de la conformité de rentrée avec exploration directe des blocages (§6.16).
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {role === 'school_admin' && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCaptureSnapshot}
              disabled={capturing || loading}
              className="h-9 text-xs rounded-xl gap-1.5 border-slate-200 bg-white font-bold"
            >
              <Camera className="w-3.5 h-3.5 text-[#2487B8]" />
              {capturing ? 'Capture...' : 'Capturer un instantané'}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchReadiness}
            disabled={loading}
            className="h-9 text-xs rounded-xl gap-1.5 border-slate-200 bg-white font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            size="sm"
            asChild
            className="h-9 text-xs rounded-xl gap-1.5 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold shadow-xs"
          >
            <a href="/api/academics/readiness/export" download>
              <Download className="w-3.5 h-3.5" />
              Exporter le Rapport (CSV)
            </a>
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Main Score Gauge with Weekly Trend (§6.16) */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-blue-50 border-4 border-[#0066FF]/20 text-[#0066FF] font-black text-2xl shadow-inner">
              {data?.overallScore ?? 0}%
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-extrabold text-[#16212B]">Score Global de Préparation Académique</h2>
                {typeof data?.weeklyTrendDelta === 'number' && (
                  <Badge
                    className={`border-none font-bold text-[10px] gap-1 ${
                      data.weeklyTrendDelta > 0
                        ? 'bg-[#DDF5EC] text-[#17A673]'
                        : data.weeklyTrendDelta < 0
                          ? 'bg-red-50 text-red-600'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {data.weeklyTrendDelta > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : data.weeklyTrendDelta < 0 ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    {data.weeklyTrendDelta > 0 ? '+' : ''}{data.weeklyTrendDelta}% cette semaine
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-lg">
                Progression mesurée semaine après semaine. Cliquez sur chaque carte ci-dessous pour corriger directement les points non conformes.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-72 space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Indice de complétude</span>
              <span className="text-[#0066FF] font-mono">{data?.overallScore ?? 0} / 100</span>
            </div>
            <Progress value={data?.overallScore ?? 0} className="h-3 rounded-full bg-slate-100" />
            {data?.trend && data.trend.length >= 2 && (
              <div className="pt-1">
                <Sparkline points={data.trend.map(t => t.score)} />
                <p className="text-[10px] text-slate-400 mt-1">Historique des instantanés (les plus récents à droite)</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Checklist Breakdown with Drill-Down Deep Links (§6.16) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.checks.map((check) => (
          <Card key={check.id} className="rounded-2xl border border-slate-200/80 shadow-xs bg-white flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-extrabold text-[#16212B]">{check.title}</CardTitle>
                <Badge
                  variant={check.status === 'conforme' ? 'success' : check.status === 'attention' ? 'warning' : 'danger'}
                  className="text-[10px] font-bold capitalize"
                >
                  {check.status}
                </Badge>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 mt-2">
                  <span>Conformité</span>
                  <span className="font-mono text-slate-700">{check.score}%</span>
                </div>
                <Progress value={check.score} className="h-2 rounded-full bg-slate-100" />
                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  {check.detail}
                </p>
              </CardContent>
            </div>

            {/* Drill-down action link (§6.16) */}
            {check.deepLink && (
              <div className="p-4 pt-0">
                <Link href={check.deepLink} className="w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs rounded-xl border-slate-200 text-[#0066FF] hover:bg-blue-50 font-bold justify-between group"
                  >
                    <span>{check.deepLinkLabel || 'Résoudre'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
