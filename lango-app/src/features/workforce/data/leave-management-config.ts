export type LeaveRequestItem = {
  id: string;
  employeeName: string;
  role: string;
  avatar: string;
  leaveType: 'Congé annuel' | 'Maladie' | 'Maternité' | 'Autorisation';
  startDate: string;
  endDate: string;
  durationDays: number;
  status: 'Approuvé' | 'En attente' | 'Refusé';
};

export const LEAVE_REQUESTS: LeaveRequestItem[] = [
  { id: '1', employeeName: 'Nadia El Alami', role: 'Enseignante Arabe', avatar: 'NA', leaveType: 'Congé annuel', startDate: '26 mai 2025', endDate: '30 mai 2025', durationDays: 5, status: 'Approuvé' },
  { id: '2', employeeName: 'Othmane Zahir', role: 'Surveillant général', avatar: 'OZ', leaveType: 'Maladie', startDate: '21 mai 2025', endDate: '23 mai 2025', durationDays: 3, status: 'En attente' },
  { id: '3', employeeName: 'Houda Chraibi', role: 'Professeur Français', avatar: 'HC', leaveType: 'Maternité', startDate: '01 juin 2025', endDate: '31 août 2025', durationDays: 90, status: 'Approuvé' },
  { id: '4', employeeName: 'Bilal Tazi', role: 'Technicien IT', avatar: 'BT', leaveType: 'Autorisation', startDate: '22 mai 2025', endDate: '22 mai 2025', durationDays: 1, status: 'Approuvé' },
];
