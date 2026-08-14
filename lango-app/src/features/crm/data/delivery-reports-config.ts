export type CampaignReportItem = {
  id: string;
  campaignName: string;
  channel: 'Email' | 'SMS' | 'WhatsApp';
  sentCount: number;
  deliveredPct: string;
  openPct: string;
  clickPct: string;
  date: string;
  status: 'Terminée' | 'En cours';
};

export const CAMPAIGN_REPORTS: CampaignReportItem[] = [
  { id: '1', campaignName: 'Rappel Réunion de Rentrée 2025', channel: 'Email', sentCount: 420, deliveredPct: '99,5%', openPct: '68,2%', clickPct: '41,0%', date: '28 mai 2025', status: 'Terminée' },
  { id: '2', campaignName: 'Offre Portes Ouvertes Maarif', channel: 'WhatsApp', sentCount: 156, deliveredPct: '98,0%', openPct: '89,4%', clickPct: '62,5%', date: '25 mai 2025', status: 'Terminée' },
  { id: '3', campaignName: 'Alerte Impayés Mai 2025', channel: 'SMS', sentCount: 42, deliveredPct: '100%', openPct: '95,2%', clickPct: '78,0%', date: '20 mai 2025', status: 'Terminée' },
  { id: '4', campaignName: 'Bulletin Trimestre 2 Dispo', channel: 'Email', sentCount: 1250, deliveredPct: '99,8%', openPct: '82,1%', clickPct: '74,3%', date: '15 mai 2025', status: 'Terminée' },
];
