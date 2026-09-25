export type ActionCenterItemStatus = 'no_school' | 'all_clear' | 'warning' | 'incomplete';

export type ActionCenterAttendance = {
  status: ActionCenterItemStatus;
  title: string;
  sub: string;
  expectedClasses: number;
  completedAttendanceClasses: number;
  missingAttendanceClasses: number;
  route: string;
};

export type ActionCenterOverdueInvoices = {
  status: 'all_clear' | 'warning';
  title: string;
  sub: string;
  overdueCount: number;
  overdueAmount: number;
  affectedFamilies: number;
  oldestOverdueDays: number;
  route: string;
};

export type ActionCenterUnjustifiedAbsences = {
  // 'incomplete' means attendance marking is not finished for the day: the
  // absence picture is not yet known and must never read as a green success.
  status: 'all_clear' | 'warning' | 'incomplete';
  title: string;
  sub: string;
  unjustifiedCount: number;
  affectedStudentCount: number;
  route: string;
};

export type ActionCenterData = {
  attendance: ActionCenterAttendance;
  overdueInvoices: ActionCenterOverdueInvoices;
  unjustifiedAbsences: ActionCenterUnjustifiedAbsences;
};

export type DailyPulseData = {
  activeStudents: {
    count: number;
    newRegistrationsThisMonth: number;
  };
  attendanceToday: {
    rate: number | null;
    presentCount: number;
    markedCount: number;
    status: ActionCenterItemStatus;
    expectedClasses: number;
    missingClasses: number;
  };
  periodCollected: {
    // Posted cash receipts during the current calendar month. Deliberately
    // carries no recovery percentage: mixing a cash month total with invoice
    // cohorts produced misleading "153%" rates (ENH-ADMIN-DASH-01).
    amount: number;
    previousMonthCollected: number | null;
  };
  periodOverdue: {
    amount: number;
    invoiceCount: number;
    familiesCount: number;
  };
};

export type FinanceMonthlyBreakdown = {
  month: string;
  monthNum: number;
  yearNum: number;
  invoiced: number;
  collected: number;
  remaining: number;
};

export type FinanceOverviewData = {
  periodLabel: string;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  monthlyBreakdown: FinanceMonthlyBreakdown[];
};

export type AttendanceDayCompletion = 'complete' | 'incomplete' | 'no_class' | 'no_data';

export type AttendanceDayPoint = {
  dayLabel: string;
  date: string;
  studentRate: number | null;
  isToday: boolean;
  isNonInstructional?: boolean;
  completionState: AttendanceDayCompletion;
  sectionsMarked?: number;
  sectionsExpected?: number;
};

export type AttendanceTrendData = {
  weeklyAverageRate: number | null;
  days: AttendanceDayPoint[];
  classesBelowThresholdCount: number;
  daysBelowThresholdCount: number;
  thresholdPercent: number;
  weekUnjustifiedCount: number;
  weekLateCount: number;
  todayMissingClasses: number;
};

export type UpcomingEventItem = {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  timingGroup: 'today' | 'tomorrow' | 'this_week';
};

export type RecentPaymentItem = {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reason: string;
  invoiceId: string | null;
};

export type WatchlistStudent = {
  id: string;
  studentId: string;
  name: string;
  className: string;
  reason: string;
  category: 'attendance' | 'finance' | 'academic';
  severity: 'critical' | 'warning';
  relevantMetric?: string;
  destinationRoute: string;
  unjustifiedWeek?: number;
  unjustifiedMonth?: number;
};

export type AdmissionsQueueItem = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  programName: string | null;
  applicationDate: string;
};

export type AdmissionsOverview = {
  toReview: number;
  interviewsToday: number;
  convertedThisMonth: number;
  recent: AdmissionsQueueItem[];
};

export type StudentDistributionItem = {
  name: string;
  count: number;
};

export type FullDashboardSummary = {
  // Institutional metadata
  institution: {
    name: string;
    activeBranchName: string;
    activeBranchId: string | null;
    availableBranches: { id: string; name: string; code: string; isDefault: boolean }[];
    currentDateFormatted: string;
    // 'pinned' = the principal is confined to activeBranchId by their account.
    branchScope: 'all' | 'pinned';
  };
  // Decision-first Action Center
  actionCenter: ActionCenterData;
  // Four Daily Pulse KPIs
  dailyPulse: DailyPulseData;
  // Unified Finance card
  financeOverview: FinanceOverviewData;
  // Attendance trend
  attendanceTrend: AttendanceTrendData;
  // Upcoming events
  upcomingEvents: {
    events: UpcomingEventItem[];
    todayBirthdaysCount: number;
    birthdaysPreview: string[];
  };
  // Recent payments
  recentPayments: RecentPaymentItem[];
  // Student Watchlist (bounded top 5)
  watchlist: {
    students: WatchlistStudent[];
    totalWatchlistCount: number;
  };
  // Admissions queue overview (actionable widget replacing student distribution)
  admissions: AdmissionsOverview;
  // Student Distribution (reconciled with "Sans niveau") - kept for analytics surfaces
  studentDistribution: {
    items: StudentDistributionItem[];
    totalActiveStudents: number;
  };
};
