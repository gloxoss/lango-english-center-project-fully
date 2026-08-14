// accounting-defaults-config.ts
// Static configuration for Moroccan General Chart of Accounts (PCG 2026) Mappings & Accounting Rules
// Decoupled from JSX per Next.js App Router Rule 3 (Content Separation).

export const PCG_MAPPINGS = [
  {
    id: 'frais_scolarite',
    label: 'Frais de scolarité mensuels',
    pcgCode: '710100',
    pcgLabel: 'Ventes de produits / Frais de scolarité',
    category: 'Produits',
    status: 'mapped' as const,
    description: 'Imputation automatique des factures de scolarité récurrentes',
  },
  {
    id: 'inscription',
    label: "Droits d'inscription & de dossier",
    pcgCode: '710300',
    pcgLabel: "Droits et frais d'inscription",
    category: 'Produits',
    status: 'mapped' as const,
    description: "Frais fixes perçus lors de l'admission de l'élève",
  },
  {
    id: 'periscolaire',
    label: 'Activités périscolaires & cantine',
    pcgCode: '710200',
    pcgLabel: 'Prestations périscolaires & activités',
    category: 'Produits',
    status: 'mapped' as const,
    description: 'Transports, cantine, garderie et clubs de langue',
  },
  {
    id: 'client_collectif',
    label: 'Compte client collectif Élèves',
    pcgCode: '342100',
    pcgLabel: 'Clients Élèves et Familles',
    category: 'Tiers',
    status: 'mapped' as const,
    description: 'Compte auxiliaire rattaché aux responsables légaux',
  },
  {
    id: 'banque',
    label: 'Banque principale (Société Générale)',
    pcgCode: '514100',
    pcgLabel: 'Banque Société Générale Maroc (SGMB)',
    category: 'Trésorerie',
    status: 'mapped' as const,
    description: 'Virements bancaires, chèques et versements TPE',
  },
  {
    id: 'caisse',
    label: 'Caisse établissement (Espèces)',
    pcgCode: '516100',
    pcgLabel: 'Caisse Centrale Établissement',
    category: 'Trésorerie',
    status: 'mapped' as const,
    description: 'Règlements comptants guichet et petite caisse',
  },
] as const;

export const DEFAULT_JOURNALS = [
  { code: 'VE', name: 'VE — Journal des Ventes (Facturation Scolarité)', type: 'Ventes' },
  { code: 'CA', name: 'CA — Journal de Caisse (Espèces Guichet)', type: 'Caisse' },
  { code: 'BQ', name: 'BQ — Journal Banque SGMB (Virements & Chèques)', type: 'Banque' },
  { code: 'OD', name: 'OD — Opérations Diverses (Avoirs & Ajustements)', type: 'Opérations' },
] as const;

export const DEFAULT_ACCOUNTING_SETTINGS = {
  journalVentes: 'VE',
  journalCaisse: 'CA',
  journalBanque: 'BQ',
  journalOD: 'OD',
  clientCollectifCode: '342100',
  centreCout: 'CC-CASABLANCA — Siège Principal',
  devise: 'MAD (Dirham Marocain)',
  prefixFacture: 'FAC-2026-',
  tauxTva: 20,
  arrondi: '0.01',
  exonerationInscription: true,
  autoNumbering: true,
  periodeOuverte: 'Mai 2026',
};

