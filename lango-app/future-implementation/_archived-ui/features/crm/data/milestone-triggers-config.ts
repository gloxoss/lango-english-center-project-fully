export type MilestoneWorkflowItem = {
  id: string;
  workflowName: string;
  eventType: 'Anniversaire Élève' | 'Ancienneté Collaborateur' | 'Félicitations Examen';
  channel: 'WhatsApp' | 'SMS' | 'Email';
  executionsThisMonth: number;
  status: 'Actif' | 'En pause';
};

export const MILESTONE_WORKFLOWS: MilestoneWorkflowItem[] = [
  { id: '1', workflowName: 'Souhaits Anniversaire Élèves', eventType: 'Anniversaire Élève', channel: 'WhatsApp', executionsThisMonth: 142, status: 'Actif' },
  { id: '2', workflowName: 'Félicitations Réussite Bac', eventType: 'Félicitations Examen', channel: 'SMS', executionsThisMonth: 88, status: 'Actif' },
  { id: '3', workflowName: 'Jubilé Ancienneté Professeurs', eventType: 'Ancienneté Collaborateur', channel: 'Email', executionsThisMonth: 12, status: 'Actif' },
];
