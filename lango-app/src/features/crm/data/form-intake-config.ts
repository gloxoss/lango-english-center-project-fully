export type FormIntakeRecord = {
  id: string;
  formName: string;
  channel: 'Site web' | 'Facebook' | 'Landing Page' | 'WhatsApp';
  fieldCount: number;
  totalSubmissions: number;
  conversionRate: string;
  assignedAgent: string;
  status: 'Actif' | 'Brouillon';
};

export const FORM_INTAKE_RECORDS: FormIntakeRecord[] = [
  { id: '1', formName: 'Demande d\'inscription 2025-2026', channel: 'Site web', fieldCount: 8, totalSubmissions: 342, conversionRate: '24,5%', assignedAgent: 'Equipe Admin', status: 'Actif' },
  { id: '2', formName: 'Demande de visite Campus Oasis', channel: 'Landing Page', fieldCount: 5, totalSubmissions: 189, conversionRate: '38,2%', assignedAgent: 'Youssef E.', status: 'Actif' },
  { id: '3', formName: 'Formulaire Portes Ouvertes Maarif', channel: 'Facebook', fieldCount: 6, totalSubmissions: 95, conversionRate: '19,0%', assignedAgent: 'Meriem A.', status: 'Actif' },
  { id: '4', formName: 'Contact d\'urgence WhatsApp', channel: 'WhatsApp', fieldCount: 4, totalSubmissions: 512, conversionRate: '42,1%', assignedAgent: 'Bot + Support', status: 'Actif' },
];
