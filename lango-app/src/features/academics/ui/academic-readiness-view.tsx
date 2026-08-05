'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Download, ShieldCheck, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

interface ReadinessCheck {
  id: string;
  title: string;
  score: number;
  status: 'conforme' | 'attention' | 'critique';
  detail: string;
}

interface ReadinessData {
  overallScore: number;
  checks: ReadinessCheck[];
}

export function AcademicReadinessView({ locale: _locale }: { locale?: string } = {}) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReadiness = () => {
    setLoading(true);
    fetch('/api/academics/readiness')
      .then((r) => r.json())
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Tableau de Bord - Bilan de Rentrée Académique
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Évaluation automatisée en temps réel de la conformité de la rentrée scolaire.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchReadiness}
            disabled={loading}
            className="h-9 text-xs rounded-xl gap-1.5 border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            size="sm"
            asChild
            className="h-9 text-xs rounded-xl gap-1.5 bg-[#2487B8] hover:bg-[#1B6C93]"
          >
            <a href="/api/academics/readiness/export" download>
              <Download className="w-3.5 h-3.5" />
              Exporter le Rapport (CSV)
            </a>
          </Button>
        </div>
      </div>

      {/* Main Score Gauge */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
        <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-slate-50 border-4 border-[#2487B8]/20 text-[#2487B8] font-black text-2xl shadow-inner">
              {data?.overallScore ?? 0}%
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#16212B]">Score Global de Préparation</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Un score supérieur à 90% indique que l'établissement est prêt pour ouvrir l'année scolaire en toute sérénité.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-64 space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-600">
              <span>Niveau de préparation</span>
              <span>{data?.overallScore ?? 0} / 100</span>
            </div>
            <Progress value={data?.overallScore ?? 0} className="h-3 rounded-full bg-slate-100" />
          </div>
        </CardContent>
      </Card>

      {/* Checklist Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.checks.map((check) => (
          <Card key={check.id} className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-bold text-[#16212B]">{check.title}</CardTitle>
              <Badge
                variant={check.status === 'conforme' ? 'success' : check.status === 'attention' ? 'warning' : 'danger'}
                className="text-[11px] capitalize"
              >
                {check.status}
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mt-2">
                <span>Conformité</span>
                <span>{check.score}%</span>
              </div>
              <Progress value={check.score} className="h-2 rounded-full bg-slate-100" />
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                {check.detail}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
