export type CampaignChannel = 'Email' | 'SMS' | 'WhatsApp';

export type CampaignPreset = {
  id: string;
  name: string;
  channel: CampaignChannel;
  subject: string;
  content: string;
  recipientSegment: string;
  estimatedRecipients: number;
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: '1',
    name: 'Rappel Réunion de Rentrée 2025',
    channel: 'Email',
    subject: 'Convocation à la Réunion de Rentrée Parents-Enseignants',
    content: 'Chers parents, nous vous invitons à assister à notre grande réunion de rentrée...',
    recipientSegment: 'Parents d\'élèves du Primaire',
    estimatedRecipients: 420,
  },
  {
    id: '2',
    name: 'Offre Portes Ouvertes Maarif',
    channel: 'WhatsApp',
    subject: 'Invitation Spéciale Journée Portes Ouvertes',
    content: 'Bonjour ! Découvrez nos installations d\'exception le samedi 15 juin...',
    recipientSegment: 'Prospects Visite Effectuée',
    estimatedRecipients: 156,
  },
];
