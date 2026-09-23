export type ActionCenterItemStatus = 'no_school' | 'all_clear' | 'warning';

export interface ActionCenterAttendance {
  status: ActionCenterItemStatus;
  title: string;
  sub: string;
  expectedClasses: number;
  completedAttendanceClasses: number;
  missingAttendanceClasses: number;
  route: string;
}

export interface ActionCenterOverdueInvoices {
  status: 'all_clear' | 'warning';
  title: string;
  sub: string;
  overdueCount: number;
  overdueAmount: number;
  affectedFamilies: number;
  oldestOverdueDays: number;
  route: string;
}

export interface ActionCenterUnjustifiedAbsences {
  status: 'all_clear' | 'warning';
  title: string;
  sub: string;
  unjustifiedCount: number;
  affectedStudentCount: number;
  route: string;
}

export interface ActionCenterData {
  attendance: ActionCenterAttendance;
  overdueInvoices: ActionCenterOverdueInvoices;
  unjustifiedAbsences: ActionCenterUnjustifiedAbsences;
}

export interface DailyPulseData {
  activeStudents: {
    count: number;
    newRegistrationsThisMonth: number;
  };
  attendanceToday: {
    rate: number | null;
    presentCount: number;
    markedCount: number;
    status: ActionCenterItemStatus;
  };
  periodCollected: {
    amount: number;
    rate: number | null;
    periodInvoiced: number;
  };
  periodOverdue: {
    amount: number;
    invoiceCount: number;
    familiesCount: number;
  };
}

export interface FinanceMonthlyBreakdown {
  month: string;
  monthNum: number;
  yearNum: number;
  invoiced: number;
  collected: number;
  remaining: number;
}

export interface FinanceOverviewData {
  periodLabel: string;
  invoiced: number;
  collected: number;
  outstanding: number;
  collectionRate: number;
  monthlyBreakdown: FinanceMonthlyBreakdown[];
}

export interface AttendanceDayPoint {
  dayLabel: string;
  date: string;
  studentRate: number | null;
  isToday: boolean;
  isNonInstructional?: boolean;
}

export interface AttendanceTrendData {
  weeklyAverageRate: number | null;
  days: AttendanceDayPoint[];
  classesBelowThresholdCount: number;
  daysBelowThresholdCount: number;
  thresholdPercent: number;
}

export interface UpcomingEventItem {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  timingGroup: 'today' | 'tomorrow' | 'this_week';
}

export interface RecentPaymentItem {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  reason: string;
  invoiceId: string | null;
}

export interface WatchlistStudent {
  id: string;
  studentId: string;
  name: string;
  className: string;
  reason: string;
  category: 'attendance' | 'finance' | 'academic';
  severity: 'critical' | 'warning';
  relevantMetric?: string;
  destinationRoute: string;
}

export interface StudentDistributionItem {
  name: string;
  count: number;
}

export interface FullDashboardSummary {
  // Institutional metadata
  institution: {
    name: string;
    activeBranchName: string;
    activeBranchId: string | null;
    availableBranches: { id: string; name: string; code: string; isDefault: boolean }[];
    currentDateFormatted: string;
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
  // Student Distribution (reconciled with "Sans niveau")
  studentDistribution: {
    items: StudentDistributionItem[];
    totalActiveStudents: number;
  };
}
