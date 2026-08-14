export type ImportRule = {
  column: string;
  required: boolean;
  format: string;
};

export const IMPORT_RULES: ImportRule[] = [
  { column: 'Nom_Complet', required: true, format: 'Texte (Ex. Youssef Alami)' },
  { column: 'Matricule', required: false, format: 'Automatique si vide' },
  { column: 'Date_Naissance', required: true, format: 'AAAA-MM-JJ' },
  { column: 'Niveau_Classe', required: true, format: 'Ex. 2BAC-A' },
  { column: 'Telephone_Tuteur', required: true, format: 'Format international (+212...)' },
];
