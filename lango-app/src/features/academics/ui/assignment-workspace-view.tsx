'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertTriangle, UserCheck, BookOpen, Users, CheckCircle2, Plus, Edit } from 'lucide-react';

interface CoverageData {
  offeringsWithoutPrimaryTeacher: Array<{ offeringId: string; className: string; sectionName: string }>;
  subjectsWithoutTeacher: Array<{ classSubjectId: string; className: string; subjectName: string; type: string }>;
  overloadedTeachers: Array<{ teacherId: string; firstName: string; lastName: string; workloadHours: number }>;
}

interface ClassOffering {
  id: string;
  className: string;
  sectionName: string;
  classId: string;
  sectionId: string;
}

interface ClassSubjectItem {
  id: string;
  subjectId: string;
  subjectName?: string;
  type: string;
  weeklyMinutes: number | null;
  coefficient: string;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

export function AssignmentWorkspaceView({ locale }: { locale: string }) {
  const [coverage, setCoverage] = useState<CoverageData | null>(null);
  const [offerings, setOfferings] = useState<ClassOffering[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [classSubjectsList, setClassSubjectsList] = useState<ClassSubjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<ClassSubjectItem | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/academics/coverage').then((r) => r.json()),
      fetch('/api/academics/class-offerings').then((r) => r.json()),
      fetch('/api/teachers').then((r) => r.json()),
    ])
      .then(([covRes, offRes, teachRes]) => {
        if (covRes.success) setCoverage(covRes.data);
        if (offRes.success && Array.isArray(offRes.data)) {
          setOfferings(offRes.data);
          if (offRes.data.length > 0) setSelectedOfferingId(offRes.data[0].id);
        }
        if (teachRes.success && Array.isArray(teachRes.data)) {
          setTeachers(teachRes.data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOfferingId) return;
    fetch(`/api/academics/class-subjects?offeringId=${selectedOfferingId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setClassSubjectsList(res.data);
        }
      });
  }, [selectedOfferingId]);

  const handleAssignTeacher = async () => {
    if (!selectedSubject || !selectedTeacherId || !selectedOfferingId) return;
    setSaving(true);
    setMessage(null);

    try {
      const currentOffering = offerings.find((o) => o.id === selectedOfferingId);
      const res = await fetch('/api/academics/subject-teachers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classSectionId: currentOffering?.sectionId || selectedSubject.id,
          subjectId: selectedSubject.subjectId,
          classSubjectId: selectedSubject.id,
          teacherId: selectedTeacherId,
          offeringId: selectedOfferingId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessage('Enseignant assigné avec succès.');
        setAssignModalOpen(false);
        // Refresh coverage
        fetch('/api/academics/coverage').then((r) => r.json()).then((c) => setCoverage(c.data));
      } else {
        setMessage(data.error?.message || 'Erreur lors de l\'affectation de l\'enseignant.');
      }
    } catch {
      setMessage('Erreur réseau lors de l\'affectation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">
            Espace d'Affectation des Enseignants
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Gérez les titulaires de classes et l'attribution des matières par classe et session.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-[#2487B8] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#2487B8]" />
          {message}
        </div>
      )}

      {/* Coverage KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Classes sans Titulaire</p>
              <p className="text-2xl font-extrabold text-[#16212B] mt-1">
                {coverage?.offeringsWithoutPrimaryTeacher.length ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Matières non Assignées</p>
              <p className="text-2xl font-extrabold text-[#16212B] mt-1">
                {coverage?.subjectsWithoutTeacher.length ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Enseignants en Surcharge (&ge;30h)</p>
              <p className="text-2xl font-extrabold text-[#16212B] mt-1">
                {coverage?.overloadedTeachers.length ?? 0}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Assignment Workspace */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-xs bg-white">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-[#16212B]">Matrice d'Affectation</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Sélectionnez une offre de classe pour visualiser et modifier l'affectation des enseignants.
            </CardDescription>
          </div>
          <div className="w-64">
            <Select value={selectedOfferingId} onValueChange={setSelectedOfferingId}>
              <SelectTrigger className="rounded-xl h-9 text-xs border-slate-200">
                <SelectValue placeholder="Sélectionner une offre" />
              </SelectTrigger>
              <SelectContent>
                {offerings.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.className} - {o.sectionName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-slate-100">
                <TableHead className="text-xs font-bold text-slate-700">Type</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Matière</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Volume Horaire</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Coefficient</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classSubjectsList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-xs text-slate-400 py-8">
                    Aucune matière configurée pour cette classe.
                  </TableCell>
                </TableRow>
              ) : (
                classSubjectsList.map((cs) => (
                  <TableRow key={cs.id} className="border-slate-100">
                    <TableCell>
                      <Badge variant="neutral" className="text-[11px] capitalize">
                        {cs.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#16212B]">
                      {cs.subjectName || `Matière (${cs.subjectId.substring(0, 8)})`}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {cs.weeklyMinutes ? `${cs.weeklyMinutes} min/sem` : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{cs.coefficient}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedSubject(cs);
                          setAssignModalOpen(true);
                        }}
                        className="h-8 text-xs rounded-xl gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        Affecter
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Assignment Modal */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="rounded-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B]">
              Affecter un Enseignant
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Enseignant</label>
              <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
                <SelectTrigger className="rounded-xl h-10 border-slate-200">
                  <SelectValue placeholder="Choisir un enseignant" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignModalOpen(false)} className="rounded-xl h-9 text-xs">
              Annuler
            </Button>
            <Button
              onClick={handleAssignTeacher}
              disabled={!selectedTeacherId || saving}
              className="rounded-xl h-9 text-xs bg-[#2487B8] hover:bg-[#1B6C93]"
            >
              {saving ? 'Enregistrement...' : 'Confirmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
