export interface AlertBanner {
  id: number;
  type: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  sub: string;
  icon: string;
}

export interface MetricCard {
  id: string;
  label: string;
  value: string;
  delta: string;
  icon: string;
}

export interface AttendanceProgram {
  name: string;
  rate: string;
  delta: string;
}

export interface RecentPayment {
  student: string;
  grade: string;
  amount: string;
  time: string;
}

export interface VigilanceAlert {
  id: string;
  name: string;
  grade: string;
  issue: string;
  badge: 'danger' | 'warning' | 'info';
  time: string;
}

export interface TimetableClass {
  name: string;
  slots: string[];
}

export interface Transaction {
  id: string;
  student: string;
  amount: string;
  type: 'credit' | 'debit';
  time: string;
}

export interface AtRiskStudent {
  id: string;
  name: string;
  grade: string;
  riskLevel: string;
  indicators: number;
  badge: 'danger' | 'warning' | 'info';
}
