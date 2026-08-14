export type TemplateItem = {
  id: string;
  templateName: string;
  category: 'Absences' | 'Notes' | 'Facturation' | 'Événements';
  channel: 'Email' | 'SMS' | 'WhatsApp';
  variableCount: number;
  usageCount: number;
  lastModified: string;
  status: 'Actif' | 'Brouillon';
};

export const MESSAGE_TEMPLATES: TemplateItem[] = [
  { id: '1', templateName: 'Alerte Absence Non Justifiée', category: 'Absences', channel: 'SMS', variableCount: 3, usageCount: 1240, lastModified: '20 mai 2025', status: 'Actif' },
  { id: '2', templateName: 'Notification Bulletin de Notes', category: 'Notes', channel: 'Email', variableCount: 4, usageCount: 890, lastModified: '15 mai 2025', status: 'Actif' },
  { id: '3', templateName: 'Rappel Échéance Scolarité', category: 'Facturation', channel: 'WhatsApp', variableCount: 3, usageCount: 450, lastModified: '18 mai 2025', status: 'Actif' },
  { id: '4', templateName: 'Invitation Portes Ouvertes', category: 'Événements', channel: 'Email', variableCount: 2, usageCount: 620, lastModified: '10 mai 2025', status: 'Actif' },
];
