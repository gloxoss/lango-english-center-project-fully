export type PriorityLevel = 'Haute' | 'Moyenne' | 'Basse';

export type SalaryAdvanceRecord = {
  id: string;
  employeeName: string;
  role: string;
  department: string;
  avatar: string;
  requestedAmountMAD: string;
  repaymentMonths: number;
  monthlyDeductionMAD: string;
  reason: string;
  status: 'Approuvé' | 'En attente' | 'Refusé';
  date: string;
};

export const SALARY_ADVANCE_RECORDS: SalaryAdvanceRecord[] = [
  { id: '1', employeeName: 'Youssef El Fassi', role: 'Enseignant Physique', department: 'Secondaire', avatar: 'YE', requestedAmountMAD: '5 000,00 MAD', repaymentMonths: 5, monthlyDeductionMAD: '1 000,00 MAD', reason: 'Frais médicaux imprévus', status: 'Approuvé', date: '18 mai 2025' },
  { id: '2', employeeName: 'Meriem Boussaid', role: 'Secrétaire de direction', department: 'Administration', avatar: 'MB', requestedAmountMAD: '3 500,00 MAD', repaymentMonths: 4, monthlyDeductionMAD: '875,00 MAD', reason: 'Réparation véhicule personnel', status: 'En attente', date: '20 mai 2025' },
  { id: '3', employeeName: 'Karim Alami', role: 'Professeur Mathématiques', department: 'Collège', avatar: 'KA', requestedAmountMAD: '8 000,00 MAD', repaymentMonths: 8, monthlyDeductionMAD: '1 000,00 MAD', reason: 'Travaux logement principal', status: 'Approuvé', date: '12 mai 2025' },
  { id: '4', employeeName: 'Sara Bennani', role: 'Assistante maternelle', department: 'Primaire', avatar: 'SB', requestedAmountMAD: '2 000,00 MAD', repaymentMonths: 2, monthlyDeductionMAD: '1 000,00 MAD', reason: 'Achats d\'urgence', status: 'Approuvé', date: '15 mai 2025' },
];
