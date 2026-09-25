'use client';

import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  Copy,
  Plus,
  Printer,
  RefreshCw,
  Trash2,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/hooks/use-permissions';
import { TIMETABLE_PERIODS } from '../data/timetable-periods';
import { SchedulePublishBar } from './schedule-publish-bar';
import { openDocumentPreview } from '@/features/documents/ui/pdf-preview';

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
  if (!name) {
    return { card: 'border-slate-200 bg-slate-50 text-slate-800', badge: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
  const lower = name.toLowerCase();
  if (lower.includes('math')) {
    return { card: 'border-blue-200 bg-blue-50/90 text-blue-900', badge: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (lower.includes('phys') || lower.includes('chim')) {
    return { card: 'border-indigo-200 bg-indigo-50/90 text-indigo-900', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
  }
  if (lower.includes('svt') || lower.includes('bio') || lower.includes('vie')) {
    return { card: 'border-emerald-200 bg-emerald-50/90 text-emerald-900', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
  }
  if (lower.includes('fran')) {
    return { card: 'border-amber-200 bg-amber-50/90 text-amber-900', badge: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (lower.includes('arab') || lower.includes('islam')) {
    return { card: 'border-teal-200 bg-teal-50/90 text-teal-900', badge: 'bg-teal-100 text-teal-800 border-teal-200' };
  }
  if (lower.includes('angl') || lower.includes('engl')) {
    return { card: 'border-purple-200 bg-purple-50/90 text-purple-900', badge: 'bg-purple-100 text-purple-800 border-purple-200' };
  }
  if (lower.includes('philo')) {
    return { card: 'border-rose-200 bg-rose-50/90 text-rose-900', badge: 'bg-rose-100 text-rose-800 border-rose-200' };
  }
  if (lower.includes('eps') || lower.includes('sport')) {
    return { card: 'border-cyan-200 bg-cyan-50/90 text-cyan-900', badge: 'bg-cyan-100 text-cyan-800 border-cyan-200' };
  }
  if (lower.includes('hist') || lower.includes('géo')) {
    return { card: 'border-orange-200 bg-orange-50/90 text-orange-900', badge: 'bg-orange-100 text-orange-800 border-orange-200' };
  }
  if (lower.includes('info') || lower.includes('tech')) {
    return { card: 'border-sky-200 bg-sky-50/90 text-sky-900', badge: 'bg-sky-100 text-sky-800 border-sky-200' };
  }
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
    startTime: TIMETABLE_PERIODS[0]!.start,
    endTime: TIMETABLE_PERIODS[0]!.end,
    roomLabel: '',
  });

  // Duplication Modal State
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateTargetSectionIds, setDuplicateTargetSectionIds] = useState<string[]>([]);
  const [duplicating, setDuplicating] = useState(false);

  // Auto-generation is owned by SchedulePublishBar (S-12: one canonical
  // generation entry point — no duplicate CTA lives in this client).

  // Moroccan Standard Days List
  const daysList = useMemo(() => [
    { value: 'monday', label: t('dayMonday') },
    { value: 'tuesday', label: t('dayTuesday') },
    { value: 'wednesday', label: t('dayWednesday') },
    { value: 'thursday', label: t('dayThursday') },
    { value: 'friday', label: t('dayFriday') },
    { value: 'saturday', label: t('daySaturday') },
  ], [t]);

  // The weekly grid renders from the shared canonical TIMETABLE_PERIODS
  // module (S-12) — the same source the generator places slots into.

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
      .then((j) => {
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
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setTeachers(j.data);
          if (j.data.length > 0) {
            setSelectedTeacherId(j.data[0].id);
          }
        }
      })
      .catch(() => {});

    fetch('/api/academics/rooms?pageSize=200')
      .then(r => r.json())
      .then((j) => {
        if (j?.success && Array.isArray(j.data)) {
          setRooms(j.data);
          if (j.data.length > 0) {
            setSelectedRoomLabel(j.data[0].name);
          }
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
      .then((j) => {
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
    if (versionId) {
      params.set('versionId', versionId);
    }
    fetch(`/api/academics/timetable-slots?${params}`)
      .then(r => r.json())
      .then((j) => {
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
    if (versionId) {
      params.set('versionId', versionId);
    }

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
      .then((j) => {
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
      if (other.id === slot.id) {
        continue;
      }
      if (other.dayOfWeek !== slot.dayOfWeek) {
        continue;
      }
      if (!overlaps(slot.startTime, slot.endTime, other.startTime, other.endTime)) {
        continue;
      }

      // 1. Teacher Conflict
      if (slot.teacherId && other.teacherId && slot.teacherId === other.teacherId) {
        return {
          hasConflict: true,
          details: `${t('teacher')}: ${slot.teacherName || other.teacherName || ''} a un double créneau avec ${other.className || ''} (${other.sectionName || ''})`,
        };
      }

      // 2. Room Conflict
      if (
        slot.roomLabel
        && other.roomLabel
        && slot.roomLabel.trim().toLowerCase() === other.roomLabel.trim().toLowerCase()
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
  const handleOpenAddModal = (day = 'monday', start = TIMETABLE_PERIODS[0]!.start, end = TIMETABLE_PERIODS[0]!.end) => {
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
        .map(s => s.roomLabel!.trim().toLowerCase()),
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

  const printTimetable = () => {
    const sourceId = viewMode === 'class' ? selectedSectionId : viewMode === 'teacher' ? selectedTeacherId : selectedRoomLabel;
    if (!sourceId) return;
    openDocumentPreview({ kind: 'timetable', sourceId, viewMode }, locale);
  };

  // Helper: Calculate weekly taught hours for each teacher
  const teacherWorkloads = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of allSlots) {
      if (!slot.teacherId) {
        continue;
      }
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const durationHours = ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
      map.set(slot.teacherId, (map.get(slot.teacherId) || 0) + Math.max(0, durationHours));
    }
    return map;
  }, [allSlots]);

  // Helper: Calculate weekly room usage hours
  const roomWorkloads = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of allSlots) {
      if (!slot.roomLabel) {
        continue;
      }
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const durationHours = ((eh ?? 0) * 60 + (em ?? 0) - ((sh ?? 0) * 60 + (sm ?? 0))) / 60;
      map.set(slot.roomLabel, (map.get(slot.roomLabel) || 0) + Math.max(0, durationHours));
    }
    return map;
  }, [allSlots]);

  // Global Conflict Summary across ALL slots
  const allConflicts = useMemo(() => {
    const conflicts: { slot: TimetableSlot; details: string }[] = [];
    for (const s of allSlots) {
      const c = checkConflict(s);
      if (c.hasConflict && c.details) {
        conflicts.push({ slot: s, details: c.details });
      }
    }
    return conflicts;
  }, [allSlots, checkConflict]);

  return (
    <div className="mx-auto max-w-[1600px] space-y-5 text-start">
      {/* Top Header & Context */}
      <div className="
        flex flex-col justify-between gap-4
        md:flex-row md:items-center
      "
      >
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="neutral"
              className="gap-1 bg-slate-100 text-xs font-bold text-slate-700"
            >
              <Calendar className="size-3.5 text-[#2487B8]" />
              <span>{t('scheduleModuleTag')}</span>
            </Badge>
            {allConflicts.length > 0 && (
              <Badge
                variant="danger"
                className="animate-pulse gap-1 text-xs font-bold"
              >
                <AlertTriangle className="size-3.5" />
                <span>
                  {allConflicts.length}
                  {' '}
                  {t('conflictsDetectedCount')}
                </span>
              </Badge>
            )}
          </div>
          <h1 className="
            mt-1.5 text-2xl font-extrabold tracking-tight text-[#16212B]
          "
          >
            {t('scheduleRealTitle')}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t('scheduleRealSubtitle')}
          </p>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadSlots()}
            className="
              h-9 gap-1.5 rounded-xl border-slate-200 px-3 text-xs font-semibold
              text-slate-600
              hover:bg-slate-50
            "
          >
            <RefreshCw className={`
              size-3.5
              ${loading ? 'animate-spin' : ''}
            `}
            />
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
              className="
                h-9 gap-1.5 rounded-xl border-slate-200 px-3 text-xs
                font-semibold text-slate-700
                hover:bg-slate-50
              "
            >
              <Copy className="size-3.5 text-[#2487B8]" />
              {t('btnDuplicateOtherGroups')}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={printTimetable}
            disabled={loading || slots.length === 0}
            className="h-9 px-3 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 gap-1.5 hover:bg-slate-50"
          >
            <Printer className="size-3.5 text-slate-500" />
            {t('btnPrintPdf')}
          </Button>

          {canManage && viewMode === 'class' && selectedSectionId && (
            <Button
              size="sm"
              onClick={() => handleOpenAddModal('monday', TIMETABLE_PERIODS[0]!.start, TIMETABLE_PERIODS[0]!.end)}
              className="
                h-9 gap-1.5 rounded-xl bg-[#2487B8] px-3.5 text-xs font-bold
                text-white shadow-xs
                hover:bg-[#1B6C93]
              "
            >
              <Plus className="size-4" />
              {t('btnAddSlot')}
            </Button>
          )}
        </div>
      </div>

      {/* Timetable Version & Publish Status Bar */}
      {sessionYearId && (
        <SchedulePublishBar sessionYearId={sessionYearId} onVersionChange={vId => setVersionId(vId)} />
      )}

      {/* Control & Mode Navigation Card */}
      <Card className="
        flex flex-wrap items-center justify-between gap-3 rounded-2xl border
        border-slate-200/90 bg-white p-3.5 shadow-2xs
      "
      >
        {/* View Mode Switcher */}
        <div className="
          flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5
          text-xs font-bold
        "
        >
          <button
            onClick={() => setViewMode('class')}
            className={`
              flex h-8 items-center gap-1.5 rounded-lg px-3.5 transition-all
              ${
    viewMode === 'class'
      ? 'bg-[#2487B8] text-white shadow-xs'
      : `
        text-slate-500
        hover:text-[#16212B]
      `
    }
            `}
          >
            <Calendar className="size-3.5" />
            {t('viewModeClass')}
          </button>
          <button
            onClick={() => setViewMode('teacher')}
            className={`
              flex h-8 items-center gap-1.5 rounded-lg px-3.5 transition-all
              ${
    viewMode === 'teacher'
      ? 'bg-[#2487B8] text-white shadow-xs'
      : `
        text-slate-500
        hover:text-[#16212B]
      `
    }
            `}
          >
            <User className="size-3.5" />
            {t('viewModeTeacher')}
          </button>
          <button
            onClick={() => setViewMode('room')}
            className={`
              flex h-8 items-center gap-1.5 rounded-lg px-3.5 transition-all
              ${
    viewMode === 'room'
      ? 'bg-[#2487B8] text-white shadow-xs'
      : `
        text-slate-500
        hover:text-[#16212B]
      `
    }
            `}
          >
            <Building2 className="size-3.5" />
            {t('viewModeRoom')}
          </button>
        </div>

        {/* View Specific Pickers */}
        <div className="flex flex-wrap items-center gap-3">
          {viewMode === 'class' && (
            <div className="flex items-center gap-2">
              <label className="
                text-xs font-bold whitespace-nowrap text-slate-500
              "
              >
                {t('selectedClassLabel') || 'Classe :'}
              </label>
              <select
                value={selectedSectionId}
                onChange={e => setSelectedSectionId(e.target.value)}
                className="
                  h-9 min-w-[200px] rounded-xl border border-slate-200 bg-white
                  px-3 text-xs font-bold text-[#16212B]
                "
              >
                {classSections.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.className}
                    {' '}
                    (
                    {cs.sectionName}
                    )
                  </option>
                ))}
              </select>
            </div>
          )}

          {viewMode === 'teacher' && (
            <div className="flex items-center gap-2">
              <label className="
                text-xs font-bold whitespace-nowrap text-slate-500
              "
              >
                {t('viewModeTeacher')}
                {' '}
                :
              </label>
              <select
                value={selectedTeacherId}
                onChange={e => setSelectedTeacherId(e.target.value)}
                className="
                  h-9 min-w-[220px] rounded-xl border border-slate-200 bg-white
                  px-3 text-xs font-bold text-[#16212B]
                "
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
              <label className="
                text-xs font-bold whitespace-nowrap text-slate-500
              "
              >
                {t('viewModeRoom')}
                {' '}
                :
              </label>
              <select
                value={selectedRoomLabel}
                onChange={e => setSelectedRoomLabel(e.target.value)}
                className="
                  h-9 min-w-[220px] rounded-xl border border-slate-200 bg-white
                  px-3 text-xs font-bold text-[#16212B]
                "
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                    {' '}
                    {r.capacity ? `(${r.capacity} pl.)` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </Card>

      {/* Conflict Alert Banner if collisions exist */}
      {activeConflicts.length > 0 && (
        <div className="
          flex flex-col items-start justify-between gap-3 rounded-2xl border
          border-rose-200 bg-rose-50 p-4 text-xs text-rose-800
          sm:flex-row sm:items-center
        "
        >
          <div className="flex items-start gap-3">
            <div className="
              mt-0.5 shrink-0 rounded-lg bg-rose-100 p-1.5 text-rose-600
            "
            >
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-rose-900">
                  {t('conflictsDetected', { count: activeConflicts.length })}
                </h4>
                <Badge className="
                  bg-rose-600 px-2 py-0.5 font-mono text-[10px] text-white
                "
                >
                  {activeConflicts.length}
                </Badge>
              </div>
              <p className="mt-0.5 text-rose-700">
                {activeConflicts[0]!.details}
              </p>
            </div>
          </div>
          {canManage && activeConflicts[0]!.details.includes(t('room')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAutoResolveRoom(activeConflicts[0]!.slot)}
              className="
                h-8 shrink-0 border-rose-300 bg-white text-xs font-bold
                text-rose-700
                hover:bg-rose-100
              "
            >
              {t('btnAutoResolveRoom')}
            </Button>
          )}
        </div>
      )}

      {/* VIEW 1: MOROCCAN WEEKLY CLASS GRID */}
      {viewMode === 'class' && (
        <div className="space-y-4">
          {!selectedSectionId && (
            <Card className="
              flex flex-col items-center justify-center gap-3 rounded-2xl border
              border-slate-200/80 bg-white p-12 text-center shadow-2xs
            "
            >
              <Clock className="size-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('classPromptEmpty')}</p>
            </Card>
          )}

          {selectedSectionId && (
            <div className="
              overflow-hidden rounded-2xl border border-slate-200/90 bg-white
              shadow-2xs
            "
            >
              {/* Printable Moroccan School Official Header */}
              <div className="
                hidden space-y-1 border-b border-slate-300 bg-slate-50 p-4
                text-center
                print:block
              "
              >
                <p className="
                  text-xs font-bold tracking-wider text-slate-700 uppercase
                "
                >
                  {t('moroccanOfficialHeader')}
                </p>
                <h2 className="text-base font-extrabold text-[#16212B]">
                  Emploi du Temps Officiel —
                  {' '}
                  {activeSection?.className}
                  {' '}
                  (
                  {activeSection?.sectionName}
                  )
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="
                      border-b border-slate-200 bg-slate-50/90 text-slate-700
                    "
                    >
                      <th className="
                        w-28 border-e border-slate-200 p-3 text-start font-bold
                      "
                      >
                        {t('colDay')}
                      </th>
                      {TIMETABLE_PERIODS.map(period => (
                        <th
                          key={period.start}
                          className="
                            min-w-[120px] border-e border-slate-200 p-3
                            text-center font-bold
                            last:border-e-0
                          "
                        >
                          {period.start}
                          {' - '}
                          {period.end}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {daysList.map((day) => {
                      const daySlots = slots.filter(s => s.dayOfWeek === day.value);

                      // CANONICAL PERIOD MATCHING (S-12): a slot belongs to the
                      // configured period whose window contains its start time;
                      // legacy/manual slots still render in the period that owns
                      // their start — nothing is hidden.
                      const slotsForPeriod = (period: { start: string; end: string }) =>
                        daySlots.filter(s => s.startTime >= period.start && s.startTime < period.end);

                      const renderBlockCell = (blockSlots: TimetableSlot[], presetStart: string, presetEnd: string) => {
                        if (blockSlots.length === 0) {
                          return (
                            <div
                              onClick={() => canManage && handleOpenAddModal(day.value, presetStart, presetEnd)}
                              className={`
                                flex h-24 items-center justify-center rounded-xl
                                border border-dashed border-slate-200
                                text-slate-300 transition-all
                                ${
                            canManage
                              ? `
                                cursor-pointer
                                hover:border-[#2487B8]/50 hover:bg-[#2487B8]/5
                                hover:text-[#2487B8]
                              `
                              : ''
                            }
                              `}
                            >
                              {canManage && <Plus className="size-4" />}
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
                                  className={`
                                    group relative flex min-h-[92px] flex-col
                                    justify-between rounded-xl border p-2.5
                                    transition-all
                                    ${
                                conflict.hasConflict
                                  ? `
                                    border-rose-500 bg-rose-50/90 text-rose-900
                                    ring-2 ring-rose-300
                                  `
                                  : style.card
                                }
                                  `}
                                >
                                  <div>
                                    <div className="
                                      flex items-start justify-between gap-1
                                    "
                                    >
                                      <span className="
                                        block truncate text-xs/tight font-bold
                                      "
                                      >
                                        {slot.subjectName || t('subject')}
                                      </span>
                                      {canManage && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteSlot(slot.id);
                                          }}
                                          className="
                                            shrink-0 rounded-md p-1
                                            text-slate-400 opacity-0
                                            transition-all
                                            group-hover:opacity-100
                                            hover:bg-rose-50 hover:text-rose-600
                                          "
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="
                                      mt-1 flex items-center gap-1 truncate
                                      text-[10px] font-medium opacity-80
                                    "
                                    >
                                      <User className="size-3 shrink-0" />
                                      {slot.teacherName || t('teacher')}
                                    </p>
                                  </div>

                                  <div className="
                                    mt-1 flex items-center justify-between
                                    border-t border-current/10 pt-1.5
                                    text-[10px]
                                  "
                                  >
                                    <span className="
                                      flex items-center gap-1 truncate font-mono
                                      font-semibold opacity-90
                                    "
                                    >
                                      <Building2 className="size-2.5 shrink-0" />
                                      {slot.roomLabel || t('slotUnassignedRoom')}
                                    </span>
                                    {conflict.hasConflict
                                      ? (
                                          <span className="
                                            shrink-0 rounded-sm border
                                            border-rose-300 bg-white px-1.5
                                            py-0.5 text-[9px] font-bold
                                            text-rose-700
                                          "
                                          >
                                            {t('slotConflictTag')}
                                          </span>
                                        )
                                      : (
                                          <span className="
                                            font-mono text-[9px] opacity-70
                                          "
                                          >
                                            {slot.startTime.slice(0, 5)}
                                            {' '}
                                            -
                                            {slot.endTime.slice(0, 5)}
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
                          <td className="
                            border-e border-slate-200 bg-slate-50/50 p-3.5
                            font-bold text-slate-700
                          "
                          >
                            {day.label}
                          </td>
                          {TIMETABLE_PERIODS.map(period => (
                            <td
                              key={period.start}
                              className="
                                border-e border-slate-200 p-2 align-top
                                last:border-e-0
                              "
                            >
                              {renderBlockCell(slotsForPeriod(period), period.start, period.end)}
                            </td>
                          ))}
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
        <div className="
          grid grid-cols-1 gap-6
          lg:grid-cols-12
        "
        >
          {/* Left Column: Teacher Roster & Workload Meter */}
          <div className="
            space-y-4
            lg:col-span-4
          "
          >
            <Card className="
              space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4
              shadow-2xs
            "
            >
              <div className="
                flex items-center justify-between border-b border-slate-100
                pb-2.5
              "
              >
                <h3 className="
                  flex items-center gap-1.5 text-xs font-bold tracking-wider
                  text-[#16212B] uppercase
                "
                >
                  <User className="size-4 text-[#2487B8]" />
                  {t('teacherWorkloadTitle')}
                </h3>
                <Badge
                  variant="neutral"
                  className="font-mono text-[10px] font-bold"
                >
                  {teachers.length}
                </Badge>
              </div>

              <div className="max-h-[580px] space-y-2 overflow-y-auto pe-1">
                {teachers.map((teach) => {
                  const isSelected = selectedTeacherId === teach.id;
                  const assignedHours = teacherWorkloads.get(teach.id) || 0;
                  const maxHours = 21; // Moroccan standard lycée/collège quota
                  const percent = Math.min(100, Math.round((assignedHours / maxHours) * 100));

                  return (
                    <div
                      key={teach.id}
                      onClick={() => setSelectedTeacherId(teach.id)}
                      className={`
                        cursor-pointer rounded-xl border p-3 transition-all
                        ${
                    isSelected
                      ? `border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]`
                      : `
                        border-slate-200 bg-white
                        hover:border-slate-300
                      `
                    }
                      `}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#16212B]">{teach.name}</p>
                          <p className="truncate text-[10px] text-slate-400">{teach.email || t('teacher')}</p>
                        </div>
                        <span className="
                          ms-2 shrink-0 font-mono font-bold text-slate-700
                        "
                        >
                          {assignedHours}
                          {' '}
                          h /
                          {maxHours}
                          {' '}
                          h
                        </span>
                      </div>

                      <div className="
                        mt-2.5 h-1.5 w-full overflow-hidden rounded-full
                        bg-slate-100
                      "
                      >
                        <div
                          className={`
                            h-full rounded-full transition-all
                            ${
                    percent > 100
                      ? 'bg-rose-500'
                      : percent >= 85
                        ? 'bg-amber-500'
                        : 'bg-[#2487B8]'
                    }
                          `}
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
          <div className="
            space-y-4
            lg:col-span-8
          "
          >
            <Card className="
              space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5
              shadow-2xs
            "
            >
              <div className="
                flex items-center justify-between border-b border-slate-100 pb-3
              "
              >
                <div>
                  <h3 className="text-sm font-bold text-[#16212B]">
                    {teachers.find(tOption => tOption.id === selectedTeacherId)?.name || t('teacher')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('weeklyWorkload')}
                    {' '}
                    :
                    <span className="font-bold text-[#2487B8]">
                      {teacherWorkloads.get(selectedTeacherId) || 0}
                      {' '}
                      heures
                    </span>
                  </p>
                </div>
                <Badge className="
                  border-emerald-500/30 bg-emerald-500/15 text-xs font-bold
                  text-emerald-700
                "
                >
                  {t('availabilityOk')}
                </Badge>
              </div>

              <div className="space-y-3">
                {daysList.map((d) => {
                  const teacherSlots = slots
                    .filter(s => s.teacherId === selectedTeacherId && s.dayOfWeek === d.value)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div
                      key={d.value}
                      className="
                        flex flex-col justify-between gap-3 rounded-xl border
                        border-slate-200/70 bg-slate-50 p-3
                        sm:flex-row sm:items-center
                      "
                    >
                      <span className="
                        w-28 shrink-0 text-xs font-bold text-slate-700
                      "
                      >
                        {d.label}
                      </span>

                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {teacherSlots.length > 0
                          ? (
                              teacherSlots.map((s) => {
                                const conflict = checkConflict(s);
                                return (
                                  <div
                                    key={s.id}
                                    className={`
                                      flex items-center gap-2 rounded-lg border
                                      px-3 py-1.5 text-xs shadow-2xs
                                      ${
                                  conflict.hasConflict
                                    ? `border-rose-300 bg-rose-50 text-rose-800`
                                    : `border-slate-200 bg-white text-slate-800`
                                  }
                                    `}
                                  >
                                    <span className="
                                      font-mono font-bold text-[#2487B8]
                                    "
                                    >
                                      {s.startTime.slice(0, 5)}
                                      {' '}
                                      -
                                      {s.endTime.slice(0, 5)}
                                    </span>
                                    <span className="
                                      font-semibold text-slate-700
                                    "
                                    >
                                      {s.subjectName}
                                    </span>
                                    <span className="
                                      rounded-sm bg-slate-100 px-1.5 py-0.5
                                      text-[10px] font-medium text-slate-600
                                    "
                                    >
                                      {s.className}
                                      {' '}
                                      (
                                      {s.sectionName}
                                      )
                                    </span>
                                    {s.roomLabel && (
                                      <span className="
                                        rounded-sm bg-slate-100 px-1.5 py-0.5
                                        font-mono text-[10px] text-slate-500
                                      "
                                      >
                                        {s.roomLabel}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            )
                          : (
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
        <div className="
          grid grid-cols-1 gap-6
          lg:grid-cols-12
        "
        >
          {/* Left Column: Rooms Registry */}
          <div className="
            space-y-4
            lg:col-span-4
          "
          >
            <Card className="
              space-y-3 rounded-2xl border border-slate-200/90 bg-white p-4
              shadow-2xs
            "
            >
              <div className="
                flex items-center justify-between border-b border-slate-100
                pb-2.5
              "
              >
                <h3 className="
                  flex items-center gap-1.5 text-xs font-bold tracking-wider
                  text-[#16212B] uppercase
                "
                >
                  <Building2 className="size-4 text-[#2487B8]" />
                  {t('roomUtilizationTitle')}
                </h3>
                <Badge
                  variant="neutral"
                  className="font-mono text-[10px] font-bold"
                >
                  {rooms.length}
                </Badge>
              </div>

              <div className="max-h-[580px] space-y-2 overflow-y-auto pe-1">
                {rooms.map((rm) => {
                  const isSelected = selectedRoomLabel === rm.name;
                  const bookedHours = roomWorkloads.get(rm.name.trim().toLowerCase()) || 0;

                  return (
                    <div
                      key={rm.id}
                      onClick={() => setSelectedRoomLabel(rm.name)}
                      className={`
                        cursor-pointer rounded-xl border p-3 transition-all
                        ${
                    isSelected
                      ? `border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]`
                      : `
                        border-slate-200 bg-white
                        hover:border-slate-300
                      `
                    }
                      `}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-[#16212B]">{rm.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {rm.capacity ? t('roomCapacityLabel', { capacity: rm.capacity }) : ''}
                            {rm.roomType ? ` · ${rm.roomType}` : ''}
                          </p>
                        </div>
                        <span className="
                          font-mono text-xs font-bold text-[#2487B8]
                        "
                        >
                          {bookedHours}
                          {' '}
                          h / sem.
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Right Column: Room Occupancy Timeline */}
          <div className="
            space-y-4
            lg:col-span-8
          "
          >
            <Card className="
              space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5
              shadow-2xs
            "
            >
              <div className="
                flex items-center justify-between border-b border-slate-100 pb-3
              "
              >
                <div>
                  <h3 className="text-sm font-bold text-[#16212B]">
                    {selectedRoomLabel || t('room')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('roomUtilizationTitle')}
                    {' '}
                    :
                    <span className="font-bold text-[#2487B8]">
                      {roomWorkloads.get(selectedRoomLabel.trim().toLowerCase()) || 0}
                      {' '}
                      heures réservées
                    </span>
                  </p>
                </div>
                <Badge className="
                  border-blue-500/30 bg-blue-500/15 text-xs font-bold
                  text-blue-700
                "
                >
                  {rooms.find(r => r.name === selectedRoomLabel)?.capacity
                    ? `${rooms.find(r => r.name === selectedRoomLabel)?.capacity} places`
                    : 'Standard'}
                </Badge>
              </div>

              <div className="space-y-3">
                {daysList.map((d) => {
                  const roomSlots = slots
                    .filter(s => s.roomLabel?.trim().toLowerCase() === selectedRoomLabel.trim().toLowerCase() && s.dayOfWeek === d.value)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));

                  return (
                    <div
                      key={d.value}
                      className="
                        flex flex-col justify-between gap-3 rounded-xl border
                        border-slate-200/70 bg-slate-50 p-3
                        sm:flex-row sm:items-center
                      "
                    >
                      <span className="
                        w-28 shrink-0 text-xs font-bold text-slate-700
                      "
                      >
                        {d.label}
                      </span>

                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {roomSlots.length > 0
                          ? (
                              roomSlots.map((s) => {
                                const conflict = checkConflict(s);
                                return (
                                  <div
                                    key={s.id}
                                    className={`
                                      flex items-center gap-2 rounded-lg border
                                      px-3 py-1.5 text-xs shadow-2xs
                                      ${
                                  conflict.hasConflict
                                    ? `border-rose-300 bg-rose-50 text-rose-800`
                                    : `border-slate-200 bg-white text-slate-800`
                                  }
                                    `}
                                  >
                                    <span className="
                                      font-mono font-bold text-[#2487B8]
                                    "
                                    >
                                      {s.startTime.slice(0, 5)}
                                      {' '}
                                      -
                                      {s.endTime.slice(0, 5)}
                                    </span>
                                    <span className="
                                      font-semibold text-slate-700
                                    "
                                    >
                                      {s.className}
                                      {' '}
                                      (
                                      {s.sectionName}
                                      )
                                    </span>
                                    <span className="
                                      rounded-sm bg-slate-100 px-1.5 py-0.5
                                      text-[10px] font-medium text-slate-600
                                    "
                                    >
                                      {s.subjectName}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {s.teacherName}
                                    </span>
                                  </div>
                                );
                              })
                            )
                          : (
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
              {activeSection?.className}
              {' '}
              (
              {activeSection?.sectionName}
              )
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-xs">
            {/* Subject Select */}
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                {t('subject')}
                {' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotForm.classSubjectId}
                onChange={e => setSlotForm(prev => ({ ...prev, classSubjectId: e.target.value }))}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                  text-xs text-[#16212B]
                "
              >
                <option value="">{tCommon('select')}</option>
                {classSubjects.map(cs => (
                  <option key={cs.id} value={cs.id}>
                    {cs.subjectName || subjects.find(s => s.id === cs.subjectId)?.name || cs.id}
                    {' '}
                    {cs.coefficient ? `(Coef. ${cs.coefficient})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Teacher Select */}
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                {t('teacher')}
                {' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={slotForm.teacherId}
                onChange={e => setSlotForm(prev => ({ ...prev, teacherId: e.target.value }))}
                className="
                  h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                  text-xs text-[#16212B]
                "
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
                <label className="mb-1 block font-bold text-slate-700">{t('colDay')}</label>
                <select
                  value={slotForm.dayOfWeek}
                  onChange={e => setSlotForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                  className="
                    h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                    text-xs text-[#16212B]
                  "
                >
                  {daysList.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('room')}</label>
                <select
                  value={slotForm.roomLabel}
                  onChange={e => setSlotForm(prev => ({ ...prev, roomLabel: e.target.value }))}
                  className="
                    h-9 w-full rounded-xl border border-slate-200 bg-white px-3
                    text-xs text-[#16212B]
                  "
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
              <label className="mb-1.5 block font-bold text-slate-700">Créneaux Standards</label>
              <div className="grid grid-cols-2 gap-2">
                {TIMETABLE_PERIODS.map((preset) => {
                  const isActive = slotForm.startTime === preset.start && slotForm.endTime === preset.end;
                  return (
                    <button
                      key={preset.start}
                      type="button"
                      onClick={() => setSlotForm(prev => ({ ...prev, startTime: preset.start, endTime: preset.end }))}
                      className={`
                        h-8 rounded-lg border font-mono text-xs font-semibold
                        transition-all
                        ${
                    isActive
                      ? 'border-[#2487B8] bg-[#2487B8]/10 text-[#2487B8]'
                      : `
                        border-slate-200 bg-slate-50/50 text-slate-700
                        hover:border-slate-300
                      `
                    }
                      `}
                    >
                      {preset.start}
                      {' '}
                      -
                      {preset.end}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Times Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('slotStartTime')}</label>
                <Input
                  type="time"
                  value={slotForm.startTime}
                  onChange={e => setSlotForm(prev => ({ ...prev, startTime: e.target.value }))}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-slate-700">{t('slotEndTime')}</label>
                <Input
                  type="time"
                  value={slotForm.endTime}
                  onChange={e => setSlotForm(prev => ({ ...prev, endTime: e.target.value }))}
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="
            gap-2
            sm:gap-0
          "
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSlotModal(false)}
              className="rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={savingSlot}
              onClick={handleSaveSlot}
              className="
                rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
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

          <div className="max-h-[340px] space-y-3 overflow-y-auto py-2 text-xs">
            <p className="font-bold text-slate-700">{t('targetSectionLabel')}</p>
            {classSections
              .filter(cs => cs.id !== selectedSectionId)
              .map((targetSection) => {
                const isSelected = duplicateTargetSectionIds.includes(targetSection.id);
                return (
                  <label
                    key={targetSection.id}
                    className={`
                      flex cursor-pointer items-center gap-3 rounded-xl border
                      p-3 transition-all
                      ${
                  isSelected
                    ? `border-[#2487B8] bg-[#2487B8]/5 ring-1 ring-[#2487B8]`
                    : `
                      border-slate-200 bg-white
                      hover:border-slate-300
                    `
                  }
                    `}
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
                      className="
                        size-4 rounded-sm border-slate-300 text-[#2487B8]
                      "
                    />
                    <div>
                      <span className="block font-bold text-[#16212B]">
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

          <DialogFooter className="
            gap-2
            sm:gap-0
          "
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDuplicateModal(false)}
              className="rounded-xl text-xs"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              size="sm"
              disabled={duplicating || duplicateTargetSectionIds.length === 0}
              onClick={handleDuplicateToSections}
              className="
                rounded-xl bg-[#2487B8] text-xs font-bold text-white
                hover:bg-[#1B6C93]
              "
            >
              {duplicating ? t('duplicationInProgress') : t('btnConfirmDuplicate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
