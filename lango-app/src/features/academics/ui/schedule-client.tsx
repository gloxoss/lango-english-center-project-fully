'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, AlertTriangle, User, Building2,
  Copy, Printer, Plus, Trash2, Clock, CheckCircle2,
  RefreshCw, BookOpen, Layers, Check
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/use-permissions';
import { SchedulePublishBar } from './schedule-publish-bar';

type ClassSectionOption = {
  id: string;
  classId: string;
  className: string;
  sectionName: string;
  periodType?: 'semester' | 'trimester' | 'month';
};

type SubjectOption = {
  id: string;
  name: string;
  code?: string;
};

type ClassSubjectOption = {
  id: string;
  classId: string;
  subjectId: string;
  subjectName?: string;
  coefficient?: number;
  weeklyMinutes?: number;
};

type TeacherOption = {
  id: string;
  name: string;
  email?: string;
};

type RoomOption = {
  id: string;
  name: string;
  code?: string | null;
  capacity?: number | null;
  roomType?: string | null;
};

export type TimetableSlot = {
  id: string;
  classSectionId: string;
  classSubjectId: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  roomLabel: string | null;
  offeringId?: string | null;
  versionId?: string | null;
  className?: string;
  sectionName?: string;
  subjectName?: string;
  teacherName?: string;
};

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function getSubjectStyle(name?: string) {
  if (!name) return { card: 'border-slate-200 bg-slate-50 text-slate-800', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
  const lower = name.toLowerCase();
  if (lower.includes('math')) return { card: 'border-blue-200 bg-blue-50/90 text-blue-900', badge: 'bg-blue-100 text-blue-800 border-blue-200' };
  if (lower.includes('phys') || lower.includes('chim')) return { card: 'border-indigo-200 bg-indigo-50/90 text-indigo-900', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  if (lower.includes('svt') || lower.includes('bio') || lower.includes('vie')) return { card: 'border-emerald-200 bg-emerald-50/90 text-emerald-900', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  if (lower.includes('fran')) return { card: 'border-amber-200 bg-amber-50/90 text-amber-900', badge: 'bg-amber-100 text-amber-800 border-amber-200' };
  if (lower.includes('arab') || lower.includes('islam')) return { card: 'border-teal-200 bg-teal-50/90 text-teal-900', badge: 'bg-teal-100 text-teal-800 border-teal-200' };
  if (lower.includes('angl') || lower.includes('engl')) return { card: 'border-purple-200 bg-purple-50/90 text-purple-900', badge: 'bg-purple-100 text-purple-800 border-purple-200' };
  if (lower.includes('philo')) return { card: 'border-rose-200 bg-rose-50/90 text-rose-900', badge: 'bg-rose-100 text-rose-800 border-rose-200' };
  if (lower.includes('eps') || lower.includes('sport')) return { card: 'border-cyan-200 bg-cyan-50/90 text-cyan-900', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
  if (lower.includes('hist') || lower.includes('géo')) return { card: 'border-orange-200 bg-orange-50/90 text-orange-900', badge: 'bg-orange-100 text-orange-800 border-orange-200' };
  if (lower.includes('info') || lower.includes('tech')) return { card: 'border-sky-200 bg-sky-50/90 text-sky-900', badge: 'bg-sky-100 text-sky-800 border-sky-200' };
  return { card: 'border-slate-200 bg-slate-50 text-slate-800', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
}

export function ScheduleClient({ locale = 'fr' }: { locale?: string } = {}) {
  const t = useTranslations('Academics');
  const tCommon = useTranslations('Common');
  const { can } = usePermissions();
  const canManage = can('academics.manage');

  // Master State
  const [sessionYearId, setSessionYearId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string>('');
  const [classSections, setClassSections] = useState<ClassSectionOption[]>([]);
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);

  // Slots & View
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [allSlots, setAllSlots] = useState<TimetableSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher' | 'room'>('class');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [selectedRoomLabel, setSelectedRoomLabel] = useState<string>('');

  // Quick Add Slot Modal State
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotForm, setSlotForm] = useState({
    classSectionId: '',
    classSubjectId: '',
    teacherId: '',
    dayOfWeek: 'monday',
    startTime: '08:30',
    endTime: '10:30',
    roomLabel: '',
  });

  // Duplication Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetSectionIds, setDuplicateTargetSectionIds] = useState<string[]>([]);
  const [duplicating, setDuplicating] = useState(false);

  // Moroccan Standard Days List
  const daysList = useMemo(() => [
    { value: 'monday', label: t('dayMonday') },
    { value: 'tuesday', label: t('dayTuesday') },
    { value: 'wednesday', label: t('dayWednesday') },
    { value: 'thursday', label: t('dayThursday') },
    { value: 'friday', label: t('dayFriday') },
    { value: 'saturday', label: t('daySaturday') },
  ], [t]);

  // Moroccan Standard 2-Hour Blocks
  const standardBlocks = useMemo(() => [
    { key: 'm1', label: '08:30 - 10:30', start: '08:30', end: '10:30' },
    { key: 'm2', label: '10:30 - 12:30', start: '10:30', end: '12:30' },
    { key: 'break', label: t('lunchBreak'), isBreak: true },
    { key: 'a1', label: '14:30 - 16:30', start: '14:30', end: '16:30' },
    { key: 'a2', label: '16:30 - 18:30', start: '16:30', end: '18:30' },
  ], [t]);

  // Initial Load: Years, Sections, Subjects, Teachers, Rooms
  useEffect(() => {
    fetch('/api/academics/session-years?pageSize=50')
      .then(r => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          const def = j.data.find((s: any) => s.isDefault) ?? j.data[0];
          setSessionYearId(def?.id ?? null);
        }
      })
      .catch(() => {});

    fetch('/api/academics/class-sections?pageSize=200')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data) && j.data.length > 0) {
          setClassSections(j.data);
          setSelectedSectionId(j.data[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/academics/subjects?pageSize=200')
      .then(r => r.json())
      .then(j => j?.success && Array.isArray(j.data) && setSubjects(j.data))
      .catch(() => {});

    fetch('/api/teachers?pageSize=200')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setTeachers(j.data);
          if (j.data.length > 0) setSelectedTeacherId(j.data[0].id);
        }
      })
      .catch(() => {});

    fetch('/api/academics/rooms?pageSize=200')
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setRooms(j.data);
          if (j.data.length > 0) setSelectedRoomLabel(j.data[0].name);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch Class Subjects when selectedSectionId changes
  useEffect(() => {
    const section = classSections.find(s => s.id === selectedSectionId);
    if (!section?.classId) {
      setClassSubjects([]);
      return;
    }
    fetch(`/api/academics/class-subjects?classId=${section.classId}&pageSize=200`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setClassSubjects(j.data);
          if (j.data.length > 0 && !slotForm.classSubjectId) {
            setSlotForm(prev => ({ ...prev, classSubjectId: j.data[0].id }));
          }
        }
      })
      .catch(() => {});
  }, [selectedSectionId, classSections]);

  // Load All Slots for Version (Used for Global Conflict Detection)
  const loadAllSlots = useCallback(() => {
    const params = new URLSearchParams();
    if (versionId) params.set('versionId', versionId);
    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setAllSlots(j.data);
        }
      })
      .catch(() => {});
  }, [versionId]);

  useEffect(() => {
    loadAllSlots();
  }, [loadAllSlots]);

  // Load Focused Slots (for Active Class, Teacher, or Room)
  const loadSlots = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (versionId) params.set('versionId', versionId);

    if (viewMode === 'class') {
      if (!selectedSectionId) {
        setSlots([]);
        setLoading(false);
        return;
      }
      params.set('classSectionId', selectedSectionId);
    } else if (viewMode === 'teacher') {
      if (!selectedTeacherId) {
        setSlots([]);
        setLoading(false);
        return;
      }
      params.set('teacherId', selectedTeacherId);
    } else if (viewMode === 'room') {
      if (!selectedRoomLabel) {
        setSlots([]);
        setLoading(false);
        return;
      }
      params.set('roomLabel', selectedRoomLabel);
    }

    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then(j => {
        if (j?.success && Array.isArray(j.data)) {
          setSlots(j.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [viewMode, selectedSectionId, selectedTeacherId, selectedRoomLabel, versionId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // Live Conflict Detection Engine
  const checkConflict = useCallback((slot: TimetableSlot): { hasConflict: boolean; details?: string } => {
    for (const other of allSlots) {
      if (other.id === slot.id) continue;
      if (other.dayOfWeek !== slot.dayOfWeek) continue;
      if (!overlaps(slot.startTime, slot.endTime, other.startTime, other.endTime)) continue;

      // 1. Teacher Conflict
      if (slot.teacherId && other.teacherId && slot.teacherId === other.teacherId) {
        return {
          hasConflict: true,
          details: `${t('teacher')}: ${slot.teacherName || other.teacherName || ''} a un double créneau avec ${other.className || ''} (${other.sectionName || ''})`,
        };
      }

      // 2. Room Conflict
      if (
        slot.roomLabel &&
        other.roomLabel &&
        slot.roomLabel.trim().toLowerCase() === other.roomLabel.trim().toLowerCase()
      ) {
        return {
          hasConflict: true,
          details: `${t('room')}: "${slot.roomLabel}" est déjà occupée par ${other.className || ''} (${other.sectionName || ''})`,
        };
      }

      // 3. Class Section Double-booking
      if (slot.classSectionId && other.classSectionId && slot.classSectionId === other.classSectionId) {
        return {
          hasConflict: true,
          details: `Deux cours programmés simultanément pour cette classe`,
        };
      }
    }
    return { hasConflict: false };
  }, [allSlots, t]);

  // Identify Active Conflicts for Current View
  const activeConflicts = useMemo(() => {
    const list: { slot: TimetableSlot; details: string }[] = [];
    for (const slot of slots) {
      const res = checkConflict(slot);
      if (res.hasConflict && res.details) {
        list.push({ slot, details: res.details });
      }
    }
    return list;
  }, [slots, checkConflict]);

  // Open Quick Add Modal
  const handleOpenAddModal = (day = 'monday', start = '08:30', end = '10:30') => {
    const defaultSubject = classSubjects[0]?.id || '';
    const defaultTeacher = teachers[0]?.id || '';
    const defaultRoom = rooms[0]?.name || '';

    setSlotForm({
      classSectionId: selectedSectionId,
      classSubjectId: defaultSubject,
      teacherId: defaultTeacher,
      dayOfWeek: day,
      startTime: start,
      endTime: end,
      roomLabel: defaultRoom,
    });
    setShowSlotModal(true);
  };

  // Create Slot with SubjectTeacher Auto-linking
  const handleSaveSlot = async () => {
    if (!slotForm.classSectionId || !slotForm.classSubjectId || !slotForm.teacherId) {
      toast.error(tCommon('error'));
      return;
    }

    if (slotForm.startTime >= slotForm.endTime) {
      toast.error(t('endTimeAfterStartTime') || 'L\'heure de fin doit être après l\'heure de début');
      return;
    }

    setSavingSlot(true);
    try {
      // Auto-link teacher to subject for section if not already present
      const classSub = classSubjects.find(cs => cs.id === slotForm.classSubjectId);
      if (classSub?.subjectId) {
        try {
          await fetch('/api/academics/subject-teachers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              classSectionId: slotForm.classSectionId,
              classSubjectId: slotForm.classSubjectId,
              subjectId: classSub.subjectId,
              teacherId: slotForm.teacherId,
            }),
          });
        } catch {
          // If already linked, backend will ignore or return error; we proceed to slot creation
        }
      }

      const res = await fetch('/api/academics/timetable-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...slotForm,
          versionId: versionId || undefined,
        }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error?.message || json.message || t('slotCreateFailed'));
        return;
      }

      toast.success(t('slotCreatedSuccess'));
      setShowSlotModal(false);
      loadSlots();
      loadAllSlots();
    } catch {
      toast.error(tCommon('networkError'));
    } finally {
      setSavingSlot(false);
    }
  };

  // Delete Slot
  const handleDeleteSlot = async (slotId: string) => {
    try {
      const res = await fetch(`/api/academics/timetable-slots?id=${slotId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success(t('slotDeletedSuccess'));
        loadSlots();
        loadAllSlots();
      } else {
        toast.error(json.message || tCommon('error'));
      }
    } catch {
      toast.error(tCommon('networkError'));
    }
  };

  // Auto-resolve Room Conflict
  const handleAutoResolveRoom = async (conflictSlot: TimetableSlot) => {
    // Find an unoccupied room for this slot's time
    const busyRoomNames = new Set(
      allSlots
        .filter(s => s.id !== conflictSlot.id && s.dayOfWeek === conflictSlot.dayOfWeek && overlaps(conflictSlot.startTime, conflictSlot.endTime, s.startTime, s.endTime) && s.roomLabel)
        .map(s => s.roomLabel!.trim().toLowerCase())
    );

    const availableRoom = rooms.find(r => !busyRoomNames.has(r.name.trim().toLowerCase()));
    if (!availableRoom) {
      toast.error('Aucune salle libre trouvée pour ce créneau');
      return;
    }

    try {
      const res = await fetch('/api/academics/timetable-slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: conflictSlot.id,
          roomLabel: availableRoom.name,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`Salle réaffectée vers : ${availableRoom.name}`);
        loadSlots();
        loadAllSlots();
      } else {
        toast.error(json.message || tCommon('error'));
      }
    } catch {
      toast.error(tCommon('networkError'));
    }
  };

  // Batch Duplication to other sections
  const handleDuplicateToSections = async () => {
    if (!selectedSectionId || duplicateTargetSectionIds.length === 0) {
      toast.error('Veuillez sélectionner au moins une section cible.');
      return;
    }

    setDuplicating(true);
    let successCount = 0;

    try {
      for (const targetId of duplicateTargetSectionIds) {
        const res = await fetch('/api/academics/timetable-slots/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromClassSectionId: selectedSectionId,
            toClassSectionId: targetId,
          }),
        });
        const json = await res.json();
        if (json.success) {
          successCount++;
        }
      }

      if (successCount > 0) {
        toast.success(t('duplicateSuccess'));
        setShowDuplicateModal(false);
        setDuplicateTargetSectionIds([]);
        loadAllSlots();
      } else {
        toast.error('Impossible de dupliquer vers les sections sélectionnées.');
      }
    } catch {
      toast.error(tCommon('networkError'));
    } finally {
      setDuplicating(false);
    }
  };

  // Helper: Find active section object
  const activeSection = classSections.find(cs => cs.id === selectedSectionId);

  // Helper: Calculate weekly taught hours for each teacher
  const teacherWorkloads = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of allSlots) {
      if (!slot.teacherId) continue;
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const durationHours = ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
      map.set(slot.teacherId, (map.get(slot.teacherId) || 0) + Math.max(0, durationHours));
    }
    return map;
  }, [allSlots]);

  // Helper: Calculate weekly booked hours for each room
  const roomWorkloads = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of allSlots) {
      if (!slot.roomLabel) continue;
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const durationHours = ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
      const key = slot.roomLabel.trim().toLowerCase();
      map.set(key, (map.get(key) || 0) + Math.max(0, durationHours));
    }
    return map;
  }, [allSlots]);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-16 text-start">
      {/* Official Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#2487B8]/10 text-[#2487B8] border border-[#2487B8]/20">
              <Calendar className="w-3.5 h-3.5" /> {t('timetableTitle') || 'Emploi du Temps'}
            </span>
            <Badge variant="neutral" className="text-[10px] font-bold">
              {t('realtimeBadge')}
            </Badge>
          </div>
          <h1 className="text-2xl font-extrabold text-[#16212B] mt-1.5 tracking-tight">
            {t('scheduleRealTitle')}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('scheduleRealSubtitle')}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSlots()}
            className="h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 text-slate-600 gap-1.5 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {tCommon('refresh')}
          </Button>

          {canManage && viewMode === 'class' && selectedSectionId && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDuplicateTargetSectionIds([]);
                setShowDuplicateModal(true);
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 gap-1.5 hover:bg-slate-50"
            >
              <Copy className="w-3.5 h-3.5 text-[#2487B8]" />
              {t('btnDuplicateOtherGroups')}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 gap-1.5 hover:bg-slate-50"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            {t('btnPrintPdf')}
          </Button>

          {canManage && viewMode === 'class' && selectedSectionId && (
            <Button
              size="sm"
              onClick={() => handleOpenAddModal('monday', '08:30', '10:30')}
              className="h-9 px-3.5 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white text-xs font-bold gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              {t('btnAddSlot')}
            </Button>
          )}
        </div>
      </div>

      {/* Timetable Version & Publish Status Bar */}
      {sessionYearId && (
        <SchedulePublishBar sessionYearId={sessionYearId} onVersionChange={(vId) => setVersionId(vId)} />
      )}

      {/* Control & Mode Navigation Card */}
      <Card className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        {/* View Mode Switcher */}
        <div className="flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setViewMode('class')}
            className={`h-8 px-3.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'class' ? 'bg-[#2487B8] text-white shadow-xs' : 'text-slate-500 hover:text-[#16212B]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            {t('viewModeClass')}
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`h-8 px-3.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'teacher' ? 'bg-[#2487B8] text-white shadow-xs' : 'text-slate-500 hover:text-[#16212B]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {t('viewModeTeacher')}
          </button>
          <button
            onClick={() => setViewMode('room')}
            className={`h-8 px-3.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === 'room' ? 'bg-[#2487B8] text-white shadow-xs' : 'text-slate-500 hover:text-[#16212B]'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {t('viewModeRoom')}
          </button>
        </div>

        {/* View Specific Pickers */}
        <div className="flex items-center gap-3 flex-wrap">
          {viewMode === 'class' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">
                {t('selectedClassLabel') || 'Classe :'}
              </label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B] min-w-[200px]"
              >
                {classSections.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.className} ({cs.sectionName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'teacher' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">
                {t('viewModeTeacher')} :
              </label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B] min-w-[220px]"
              >
                {teachers.map(tOption => (
                  <option key={tOption.id} value={tOption.id}>
                    {tOption.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'room' && (
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 whitespace-nowrap">
                {t('viewModeRoom')} :
              </label>
              <select
                value={selectedRoomLabel}
                onChange={e => setSelectedRoomLabel(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white text-[#16212B] min-w-[220px]"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.name}>
                    {r.name} {r.capacity ? `(${r.capacity} pl.)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Conflict Alert Banner if collisions exist */}
      {activeConflicts.length > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-rose-800">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-rose-900">
                  {t('conflictsDetected', { count: activeConflicts.length })}
                </h4>
                <Badge className="bg-rose-600 text-white text-[10px] font-mono px-2 py-0.5">
                  {activeConflicts.length}
                </Badge>
              </div>
              <p className="text-rose-700 mt-0.5">
                {activeConflicts[0]!.details}
              </p>
            </div>
          </div>
          {canManage && activeConflicts[0]!.details.includes(t('room')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAutoResolveRoom(activeConflicts[0]!.slot)}
              className="h-8 text-xs font-bold border-rose-300 text-rose-700 bg-white hover:bg-rose-100 shrink-0"
            >
              {t('btnAutoResolveRoom')}
            </Button>
          )}
        </div>
      )}

      {/* VIEW 1: MOROCCAN WEEKLY CLASS GRID */}
      {viewMode === 'class' && (
        <div className="space-y-4">
          {!selectedSectionId ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Clock className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('classPromptEmpty')}</p>
            </Card>
          ) : (
            <div className="bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden">
              {/* Printable Moroccan School Official Header */}
              <div className="hidden print:block p-4 border-b border-slate-300 bg-slate-50 text-center space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {t('moroccanOfficialHeader')}
                </p>
                <h2 className="text-base font-extrabold text-[#16212B]">
                  Emploi du Temps Officiel — {activeSection?.className} ({activeSection?.sectionName})
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700">
                      <th className="p-3 text-start font-bold border-e border-slate-200 w-28">
                        {t('colDay')}
                      </th>
                      <th className="p-3 text-center font-bold border-e border-slate-200 min-w-[170px]">
                        08:30 - 10:30
                      </th>
                      <th className="p-3 text-center font-bold border-e border-slate-200 min-w-[170px]">
                        10:30 - 12:30
                      </th>
                      <th className="p-2 text-center font-bold text-slate-400 bg-slate-100/50 w-24 border-e border-slate-200">
                        {t('lunchBreak')}
                      </th>
                      <th className="p-3 text-center font-bold border-e border-slate-200 min-w-[170px]">
                        14:30 - 16:30
                      </th>
                      <th className="p-3 text-center font-bold min-w-[170px]">
                        16:30 - 18:30
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {daysList.map((day) => {
                      const daySlots = slots.filter(s => s.dayOfWeek === day.value);

                      // Match slot to Moroccan standard 2-hour blocks
                      const m1Slots = daySlots.filter(s => s.startTime <= '09:30');
                      const m2Slots = daySlots.filter(s => s.startTime > '09:30' && s.startTime < '13:00');
                      const a1Slots = daySlots.filter(s => s.startTime >= '13:00' && s.startTime < '15:30');
                      const a2Slots = daySlots.filter(s => s.startTime >= '15:30');

                      const renderBlockCell = (blockSlots: TimetableSlot[], presetStart: string, presetEnd: string) => {
                        if (blockSlots.length === 0) {
                          return (
                            <div
                              onClick={() => canManage && handleOpenAddModal(day.value, presetStart, presetEnd)}
                              className={`h-24 rounded-xl border border-dashed border-slate-200 flex items-center justify-center text-slate-300 transition-all ${
                                canManage ? 'hover:border-[#2487B8]/50 hover:text-[#2487B8] hover:bg-[#2487B8]/5 cursor-pointer' : ''
                              }`}
                            >
                              {canManage && <Plus className="w-4 h-4" />}
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-1.5">
                            {blockSlots.map((slot) => {
                              const conflict = checkConflict(slot);
                              const style = getSubjectStyle(slot.subjectName);

                              return (
                                <div
                                  key={slot.id}
                                  className={`p-2.5 rounded-xl border relative flex flex-col justify-between transition-all group min-h-[92px] ${
                                    conflict.hasConflict
                                      ? 'border-rose-500 bg-rose-50/90 text-rose-900 ring-2 ring-rose-300'
                                      : style.card
                                  }`}
                                >
                                  <div>
                                    <div className="flex items-start justify-between gap-1">
                                      <span className="font-bold text-xs truncate block leading-tight">
                                        {slot.subjectName || t('subject')}
                                      </span>
                                      {canManage && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSlot(slot.id);
                                          }}
                                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all shrink-0"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-[10px] opacity-80 flex items-center gap-1 mt-1 font-medium truncate">
                                      <User className="w-3 h-3 shrink-0" />
                                      {slot.teacherName || t('teacher')}
                                    </p>
                                  </div>

                                  <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-current/10 mt-1">
                                    <span className="flex items-center gap-1 font-mono font-semibold opacity-90 truncate">
                                      <Building2 className="w-2.5 h-2.5 shrink-0" />
                                      {slot.roomLabel || t('slotUnassignedRoom')}
                                    </span>
                                    {conflict.hasConflict ? (
                                      <span className="text-[9px] font-bold text-rose-700 bg-white px-1.5 py-0.5 rounded border border-rose-300 shrink-0">
                                        {t('slotConflictTag')}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-mono opacity-70">
                                        {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      };

                      return (
                        <tr key={day.value} className="hover:bg-slate-50/40">
                          <td className="p-3.5 font-bold text-slate-700 border-e border-slate-200 bg-slate-50/50">
                            {day.label}
                          </td>
                          <td className="p-2 border-e border-slate-200 align-top">
                            {renderBlockCell(m1Slots, '08:30', '10:30')}
                          </td>
                          <td className="p-2 border-e border-slate-200 align-top">
                            {renderBlockCell(m2Slots, '10:30', '12:30')}
                          </td>
                          <td className="p-2 text-center text-[10px] font-semibold text-slate-400 bg-slate-100/40 border-e border-slate-200 align-middle">
                            <span className="writing-mode-vertical">{t('lunchBreak')}</span>
                          </td>
                          <td className="p-2 border-e border-slate-200 align-top">
                            {renderBlockCell(a1Slots, '14:30', '16:30')}
                          </td>
                          <td className="p-2 align-top">
                            {renderBlockCell(a2Slots, '16:30', '18:30')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: TEACHER WORKLOAD & WEEKLY SCHEDULE INSPECTOR */}
      {viewMode === 'teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Teacher Roster & Workload Meter */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold text-[#16212B] uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#2487B8]" />
                  {t('teacherWorkloadTitle')}
                </h3>
                <Badge variant="neutral" className="text-[10px] font-bold font-mono">
                  {teachers.length}
                </Badge>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pe-1">
                {teachers.map(teach => {
                  const isSelected = selectedTeacherId === teach.id;
                  const assignedHours = teacherWorkloads.get(teach.id) || 0;
                  const maxHours = 21; // Moroccan standard lycée/collège quota
                  const percent = Math.min(100, Math.round((assignedHours / maxHours) * 100));

                  return (
                    <div
                      key={teach.id}
                      onClick={() => setSelectedTeacherId(teach.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <div className="min-w-0">
                          <p className="font-bold text-[#16212B] truncate">{teach.name}</p>
                          <p className="text-[10px] text-slate-400 truncate">{teach.email || t('teacher')}</p>
                        </div>
                        <span className="font-bold font-mono text-slate-700 shrink-0 ms-2">
                          {assignedHours} h / {maxHours} h
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent > 100
                              ? 'bg-rose-500'
                              : percent >= 85
                              ? 'bg-amber-500'
                              : 'bg-[#2487B8]'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Teacher's Weekly Timeline */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-[#16212B]">
                    {teachers.find(tOption => tOption.id === selectedTeacherId)?.name || t('teacher')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('weeklyWorkload')} : <span className="font-bold text-[#2487B8]">{teacherWorkloads.get(selectedTeacherId) || 0} heures</span>
                  </p>
                </div>
                <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-xs font-bold">
                  {t('availabilityOk')}
                </Badge>
              </div>

              <div className="space-y-3">
                {daysList.map(d => {
                  const teacherSlots = slots
                    .filter(s => s.teacherId === selectedTeacherId && s.dayOfWeek === d.value)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div key={d.value} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="font-bold text-xs text-slate-700 w-28 shrink-0">
                        {d.label}
                      </span>

                      <div className="flex-1 flex gap-2 flex-wrap items-center">
                        {teacherSlots.length > 0 ? (
                          teacherSlots.map(s => {
                            const conflict = checkConflict(s);
                            return (
                              <div
                                key={s.id}
                                className={`px-3 py-1.5 rounded-lg border text-xs shadow-2xs flex items-center gap-2 ${
                                  conflict.hasConflict
                                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <span className="font-bold text-[#2487B8] font-mono">
                                  {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                                </span>
                                <span className="font-semibold text-slate-700">{s.subjectName}</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {s.className} ({s.sectionName})
                                </span>
                                {s.roomLabel && (
                                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                                    {s.roomLabel}
                                  </span>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {t('noCourseAssigned')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* VIEW 3: ROOM OCCUPANCY & UTILIZATION INSPECTOR */}
      {viewMode === 'room' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Rooms Registry */}
          <div className="lg:col-span-4 space-y-4">
            <Card className="p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <h3 className="text-xs font-bold text-[#16212B] uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#2487B8]" />
                  {t('roomUtilizationTitle')}
                </h3>
                <Badge variant="neutral" className="text-[10px] font-bold font-mono">
                  {rooms.length}
                </Badge>
              </div>

              <div className="space-y-2 max-h-[580px] overflow-y-auto pe-1">
                {rooms.map(rm => {
                  const isSelected = selectedRoomLabel === rm.name;
                  const bookedHours = roomWorkloads.get(rm.name.trim().toLowerCase()) || 0;

                  return (
                    <div
                      key={rm.id}
                      onClick={() => setSelectedRoomLabel(rm.name)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-[#16212B]">{rm.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {rm.capacity ? t('roomCapacityLabel', { capacity: rm.capacity }) : ''}
                            {rm.roomType ? ` · ${rm.roomType}` : ''}
                          </p>
                        </div>
                        <span className="font-bold font-mono text-[#2487B8] text-xs">
                          {bookedHours} h / sem.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Room Occupancy Timeline */}
          <div className="lg:col-span-8 space-y-4">
            <Card className="p-5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-[#16212B]">
                    {selectedRoomLabel || t('room')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('roomUtilizationTitle')} : <span className="font-bold text-[#2487B8]">{roomWorkloads.get(selectedRoomLabel.trim().toLowerCase()) || 0} heures réservées</span>
                  </p>
                </div>
                <Badge className="bg-blue-500/15 text-blue-700 border-blue-500/30 text-xs font-bold">
                  {rooms.find(r => r.name === selectedRoomLabel)?.capacity
                    ? `${rooms.find(r => r.name === selectedRoomLabel)?.capacity} places`
                    : 'Standard'}
                </Badge>
              </div>

              <div className="space-y-3">
                {daysList.map(d => {
                  const roomSlots = slots
                    .filter(s => s.roomLabel?.trim().toLowerCase() === selectedRoomLabel.trim().toLowerCase() && s.dayOfWeek === d.value)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div key={d.value} className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <span className="font-bold text-xs text-slate-700 w-28 shrink-0">
                        {d.label}
                      </span>

                      <div className="flex-1 flex gap-2 flex-wrap items-center">
                        {roomSlots.length > 0 ? (
                          roomSlots.map(s => {
                            const conflict = checkConflict(s);
                            return (
                              <div
                                key={s.id}
                                className={`px-3 py-1.5 rounded-lg border text-xs shadow-2xs flex items-center gap-2 ${
                                  conflict.hasConflict
                                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <span className="font-bold text-[#2487B8] font-mono">
                                  {s.startTime.slice(0, 5)} - {s.endTime.slice(0, 5)}
                                </span>
                                <span className="font-semibold text-slate-700">{s.className} ({s.sectionName})</span>
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                                  {s.subjectName}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {s.teacherName}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-xs text-slate-400 italic">
                            {t('free')}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* QUICK ADD SLOT MODAL */}
      <Dialog open={showSlotModal} onOpenChange={setShowSlotModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B]">
              {t('quickAddSlotTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {activeSection?.className} ({activeSection?.sectionName})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-2">
            {/* Subject Select */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {t('subject')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotForm.classSubjectId}
                onChange={e => setSlotForm(prev => ({ ...prev, classSubjectId: e.target.value }))}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-[#16212B]"
              >
                <option value="">{tCommon('select')}</option>
                {classSubjects.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.subjectName || subjects.find(s => s.id === cs.subjectId)?.name || cs.id} {cs.coefficient ? `(Coef. ${cs.coefficient})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher Select */}
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {t('teacher')} <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotForm.teacherId}
                onChange={e => setSlotForm(prev => ({ ...prev, teacherId: e.target.value }))}
                className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-[#16212B]"
              >
                <option value="">{t('teacherSelectPrompt')}</option>
                {teachers.map(teach => (
                  <option key={teach.id} value={teach.id}>
                    {teach.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Day & Room Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('colDay')}</label>
                <select
                  value={slotForm.dayOfWeek}
                  onChange={e => setSlotForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                  className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-[#16212B]"
                >
                  {daysList.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('room')}</label>
                <select
                  value={slotForm.roomLabel}
                  onChange={e => setSlotForm(prev => ({ ...prev, roomLabel: e.target.value }))}
                  className="w-full h-9 rounded-xl border border-slate-200 px-3 text-xs bg-white text-[#16212B]"
                >
                  <option value="">{t('slotUnassignedRoom')}</option>
                  {rooms.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Time Presets */}
            <div>
              <label className="font-bold text-slate-700 block mb-1.5">Créneaux Standards</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { start: '08:30', end: '10:30' },
                  { start: '10:30', end: '12:30' },
                  { start: '14:30', end: '16:30' },
                  { start: '16:30', end: '18:30' },
                ].map(preset => {
                  const isActive = slotForm.startTime === preset.start && slotForm.endTime === preset.end;
                  return (
                    <button
                      key={preset.start}
                      type="button"
                      onClick={() => setSlotForm(prev => ({ ...prev, startTime: preset.start, endTime: preset.end }))}
                      className={`h-8 rounded-lg text-xs font-mono font-semibold border transition-all ${
                        isActive
                          ? 'border-[#2487B8] bg-[#2487B8]/10 text-[#2487B8]'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                      }`}
                    >
                      {preset.start} - {preset.end}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Times Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('slotStartTime')}</label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={e => setSlotForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="font-bold text-slate-700 block mb-1">{t('slotEndTime')}</label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={e => setSlotForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="h-9 text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSlotModal(false)}
              className="text-xs rounded-xl"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={savingSlot}
              onClick={handleSaveSlot}
              className="text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              {savingSlot ? t('saving') : t('btnSaveSlot')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BATCH DUPLICATION MODAL */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#16212B]">
              {t('duplicateModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t('duplicateModalDesc', { source: `${activeSection?.className} (${activeSection?.sectionName})` })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2 max-h-[340px] overflow-y-auto">
            <p className="font-bold text-slate-700">{t('targetSectionLabel')}</p>
            {classSections
              .filter(cs => cs.id !== selectedSectionId)
              .map(targetSection => {
                const isSelected = duplicateTargetSectionIds.includes(targetSection.id);
                return (
                  <label
                    key={targetSection.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setDuplicateTargetSectionIds(prev => [...prev, targetSection.id]);
                        } else {
                          setDuplicateTargetSectionIds(prev => prev.filter(id => id !== targetSection.id));
                        }
                      }}
                      className="w-4 h-4 text-[#2487B8] rounded border-slate-300"
                    />
                    <div>
                      <span className="font-bold text-[#16212B] block">
                        {targetSection.className}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {targetSection.sectionName}
                      </span>
                    </div>
                  </label>
                );
              })}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDuplicateModal(false)}
              className="text-xs rounded-xl"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={duplicating || duplicateTargetSectionIds.length === 0}
              onClick={handleDuplicateToSections}
              className="text-xs rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold"
            >
              {duplicating ? t('duplicationInProgress') : t('btnConfirmDuplicate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
