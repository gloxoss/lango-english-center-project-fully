'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';

type ApiClass = { id: string; name: string };
type ApiSubject = { id: string; name: string };
type ApiElectiveGroup = { id: string; classId: string; name: string; maxChoices: number; subjects: { id: string; name: string }[] };
type ApiStudent = { id: string; fullName: string };
type ApiChoice = { id: string; studentId: string; studentName: string; subjectId: string };

export function OptionalSubjectsView() {
  const t = useTranslations('Academics');
  const tc = useTranslations('Common');

  const [classes, setClasses] = useState<ApiClass[]>([]);
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [groups, setGroups] = useState<ApiElectiveGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [choices, setChoices] = useState<ApiChoice[]>([]);
  const [roster, setRoster] = useState<ApiStudent[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newGroup, setNewGroup] = useState<{ classId: string; name: string; maxChoices: string; subjectIds: string[] }>({ classId: '', name: '', maxChoices: '1', subjectIds: [] });
  const [saving, setSaving] = useState(false);

  const [assignStudentId, setAssignStudentId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');

  async function loadGroups() {
    try {
      const res = await fetch('/api/academics/elective-groups?pageSize=200');
      const json = await res.json();
      if (json.success) {
        setGroups(json.data);
      }
    } catch (err) {
      console.error('Failed loading elective groups', err);
    }
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/academics/classes?pageSize=200').then(r => r.json()),
      fetch('/api/academics/subjects?pageSize=200').then(r => r.json()),
    ]).then(([classesJson, subjJson]) => {
      if (classesJson.success) setClasses(classesJson.data);
      if (subjJson.success) setSubjects(subjJson.data);
    }).catch(err => console.error('Failed loading pickers', err));
    loadGroups();
  }, []);

  const selectedGroup = groups.find(g => g.id === selectedGroupId) ?? null;

  useEffect(() => {
    if (!selectedGroup) {
      setChoices([]);
      setRoster([]);
      return;
    }
    Promise.all([
      fetch(`/api/academics/elective-choices?electiveGroupId=${selectedGroup.id}`).then(r => r.json()),
      fetch(`/api/students?classId=${selectedGroup.classId}&pageSize=200`).then(r => r.json()),
    ]).then(([choicesJson, studentsJson]) => {
      if (choicesJson.success) setChoices(choicesJson.data);
      if (studentsJson.success) setRoster(studentsJson.data);
    }).catch(err => console.error('Failed loading group detail', err));
  }, [selectedGroup]);

  function toggleSubjectInNewGroup(id: string) {
    setNewGroup(prev => ({
      ...prev,
      subjectIds: prev.subjectIds.includes(id) ? prev.subjectIds.filter(s => s !== id) : [...prev.subjectIds, id],
    }));
  }

  async function handleCreateGroup() {
    if (!newGroup.classId || !newGroup.name || newGroup.subjectIds.length < 2) {
      setError(t('electiveGroupValidation'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/academics/elective-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: newGroup.classId,
          name: newGroup.name,
          subjectIds: newGroup.subjectIds,
          maxChoices: Number.parseInt(newGroup.maxChoices, 10) || 1,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t('electiveCreationFailed'));
        return;
      }
      setSuccess(json.message);
      setIsAddOpen(false);
      setNewGroup({ classId: '', name: '', maxChoices: '1', subjectIds: [] });
      await loadGroups();
    } catch (err) {
      console.error('Elective group create failed', err);
      setError(t('electiveGroupNetworkError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteGroup(id: string) {
    setError(null);
    await fetch(`/api/academics/elective-groups?id=${id}`, { method: 'DELETE' });
    if (selectedGroupId === id) {
      setSelectedGroupId(null);
    }
    await loadGroups();
  }

  async function handleAssignChoice() {
    if (!selectedGroup || !assignStudentId || !assignSubjectId) {
      return;
    }
    setError(null);
    try {
      const res = await fetch('/api/academics/elective-choices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: assignStudentId, electiveGroupId: selectedGroup.id, subjectId: assignSubjectId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.message || t('electiveAssignFailed'));
        return;
      }
      setAssignStudentId('');
      setAssignSubjectId('');
      const choicesRes = await fetch(`/api/academics/elective-choices?electiveGroupId=${selectedGroup.id}`);
      const choicesJson = await choicesRes.json();
      if (choicesJson.success) {
        setChoices(choicesJson.data);
      }
    } catch (err) {
      console.error('Choice assign failed', err);
      setError(t('electiveGroupNetworkError'));
    }
  }

  return (
    <div className="flex gap-6 max-w-[1600px] mx-auto">
      <div className="flex-1 space-y-6 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">{t('optionalSubjectsTitle')}</h1>
            <p className="text-xs text-slate-500 mt-1">{t('optionalSubjectsSubtitle')}</p>
          </div>
          <Button variant="primary" size="sm" className="gap-2 h-10 rounded-full px-4 text-xs" onClick={() => setIsAddOpen(true)}>
            <Plus className="w-4 h-4" /> {t('newElectiveGroup')}
          </Button>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {groups.length === 0 && <p className="text-xs text-slate-400">{t('noElectiveGroups')}</p>}
          {groups.map(group => (
            <Card
              key={group.id}
              onClick={() => setSelectedGroupId(group.id)}
              className={`p-4 bg-white rounded-2xl border shadow-2xs cursor-pointer transition-colors ${selectedGroupId === group.id ? 'border-[#2487B8]' : 'border-slate-200/80 hover:bg-slate-50/80'}`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-[#16212B] text-sm">{group.name}</p>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(group.id); }} className="p-1 rounded-lg hover:bg-rose-50 text-rose-500">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {t('maxChoicesDesc', {
                  className: classes.find(c => c.id === group.classId)?.name ?? '—',
                  maxChoices: group.maxChoices,
                })}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {group.subjects.map(s => <Badge key={s.id} variant="neutral" className="text-[10px]">{s.name}</Badge>)}
              </div>
            </Card>
          ))}
        </div>

        {selectedGroup && (
          <Card className="bg-white rounded-2xl shadow-2xs border border-slate-200/80 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2 justify-between">
              <h3 className="text-sm font-bold text-[#16212B]">
                {t('studentChoicesHeader', { groupName: selectedGroup.name })}
              </h3>
              <div className="flex items-center gap-2">
                <Select value={assignStudentId} onValueChange={setAssignStudentId}>
                  <SelectTrigger className="w-[160px] h-9 text-xs rounded-full"><SelectValue placeholder={t('selectStudentPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {roster.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={assignSubjectId} onValueChange={setAssignSubjectId}>
                  <SelectTrigger className="w-[140px] h-9 text-xs rounded-full"><SelectValue placeholder={t('selectSubjectPlaceholder')} /></SelectTrigger>
                  <SelectContent>
                    {selectedGroup.subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" className="h-9 rounded-full text-xs" onClick={handleAssignChoice}>{t('btnAssign')}</Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs">
                <thead className="bg-[#F6F9FC] text-slate-500 font-semibold border-b border-slate-200/80">
                  <tr>
                    <th className="py-3 px-4">{t('colStudent')}</th>
                    <th className="py-3 px-4">{t('colChosenSubject')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {choices.length === 0 && (
                    <tr><td colSpan={2} className="py-6 px-4 text-center text-slate-400">{t('noChoicesRecorded')}</td></tr>
                  )}
                  {choices.map(c => (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-bold text-[#16212B]">{c.studentName}</td>
                      <td className="py-3 px-4 text-slate-700">{selectedGroup.subjects.find(s => s.id === c.subjectId)?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#16212B]">{t('newElectiveGroupModalTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 my-2 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('groupNameLabel')} *</label>
              <Input value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })} placeholder={t('groupNamePlaceholder')} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('classSelectLabel')} *</label>
              <Select value={newGroup.classId} onValueChange={v => setNewGroup({ ...newGroup, classId: v })}>
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue placeholder={t('selectClassPlaceholder')} /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('maxChoicesLabel')}</label>
              <Input type="number" min="1" max="10" value={newGroup.maxChoices} onChange={e => setNewGroup({ ...newGroup, maxChoices: e.target.value })} className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">{t('minSubjectsLabel')} *</label>
              <div className="flex flex-wrap gap-1.5">
                {subjects.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubjectInNewGroup(s.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${newGroup.subjectIds.includes(s.id) ? 'bg-[#DCEBF4] border-[#2487B8] text-[#1B6C93]' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-full text-xs h-9">{tc('cancel')}</Button>
            <Button variant="primary" disabled={saving} onClick={handleCreateGroup} className="rounded-full text-xs h-9 bg-[#0066FF] text-white">
              {saving ? t('btnCreatingElective') : t('btnCreateElective')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

