-- Seeds report_definitions from the addon's in-memory catalog
-- (src/addons/advanced-reporting/services/catalog-definitions.ts), so the
-- foreign-key-dependent tables (report_runs, report_favorites,
-- report_saved_views, report_schedules, report_snapshots) stop failing on
-- insert. Idempotent: safe to re-run via ON CONFLICT DO UPDATE.
-- future-implementation/advanced-reporting remediation, section-01.

INSERT INTO report_definitions (key, domain, current_version, title, description, sensitivity_level, freshness_type, execution_adapter, supported_formats, required_permissions, is_active)
VALUES
  ('student.credentials', 'Student', 1, 'État d''Activation des Comptes Élèves', 'Rapport d''activation et de préparation des comptes élèves (sans secrets ni mots de passe).', 'restricted', 'realtime', 'StudentAdapter.getCredentialStatusReport', ARRAY['csv','xlsx','pdf'], ARRAY['students.read'], true),
  ('student.admission_funnel', 'Student', 1, 'Entonnoir de Conversion des Admissions', 'Analyse du flux des prospects de la demande d''information jusqu''à l''inscription finale.', 'standard', 'realtime', 'StudentAdapter.getAdmissionFunnelReport', ARRAY['csv','xlsx','pdf'], ARRAY['admissions.view','students.read'], true),
  ('student.class_section_occupancy', 'Student', 1, 'Taux d''Occupation des Classes & Sections', 'Rapport d''effectifs et de capacité d''accueil par classe, section et cycle.', 'standard', 'realtime', 'StudentAdapter.getClassSectionOccupancyReport', ARRAY['csv','xlsx','pdf'], ARRAY['academics.read','students.read'], true),
  ('student.siblings', 'Student', 1, 'Répartition par Foyer & Fratrie', 'Groupement des élèves par foyer familial et tuteur légal autorisé.', 'standard', 'realtime', 'StudentAdapter.getSiblingReport', ARRAY['csv','xlsx','pdf'], ARRAY['guardians.read','students.read'], true),

  ('fees.summary', 'Fees', 1, 'Récapitulatif Global des Frais Scolaires', 'Synthèse des factures émises, remises, paiements perçus et soldes dus.', 'restricted', 'realtime', 'FeesAdapter.getFeesSummaryReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('fees.receipts', 'Fees', 1, 'Journal des Reçus de Caisse', 'Liste des encaissements enregistrés par session de caisse, mode de règlement et caissier.', 'restricted', 'realtime', 'FeesAdapter.getReceiptsReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('fees.due_aging', 'Fees', 1, 'Balance Âgée des Impayés (Recouvrement)', 'Analyse de l''ancienneté des créances échues (Courant, 1-30, 31-60, 61-90, 90+ jours).', 'restricted', 'realtime', 'FeesAdapter.getDueAgingReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('fees.fines', 'Fees', 1, 'Registre des Pénalités & Exonérations', 'Suivi des frais de retard appliqués, encaissés, exonérés ou annulés.', 'restricted', 'realtime', 'FeesAdapter.getFinesReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),

  ('finance.statement', 'Financial', 1, 'Relevé de Compte Tiers / Tuteur', 'Historique chronologique des débits, crédits et solde progressif d''un compte.', 'restricted', 'realtime', 'FinancialAdapter.getAccountStatementReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('finance.income_expense', 'Financial', 1, 'Compte de Produits et Charges (CPC)', 'Ventilation périodique des recettes de scolarité et des dépenses d''exploitation.', 'restricted', 'snapshot', 'FinancialAdapter.getIncomeExpenseReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('finance.transactions', 'Financial', 1, 'Grand Livre / Journal des Écritures', 'Détail exhaustif des lignes de journal comptable validées.', 'restricted', 'realtime', 'FinancialAdapter.getTransactionsReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('finance.balance_sheet', 'Financial', 1, 'Bilan Comptable (Actif = Passif + Capitaux)', 'État du patrimoine financier à la clôture de période (Actif = Passif + Capitaux Propres).', 'restricted', 'snapshot', 'FinancialAdapter.getBalanceSheetReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),
  ('finance.income_vs_expense', 'Financial', 1, 'Tendance Comparée Produits vs Charges', 'Évolution mensuelle des recettes encaissées par rapport aux dépenses payées.', 'restricted', 'realtime', 'FinancialAdapter.getIncomeVsExpenseReport', ARRAY['csv','xlsx','pdf'], ARRAY['finance.read'], true),

  ('attendance.student_log', 'Attendance', 1, 'Historique Détaillé des Présences Élève', 'Relevé individuel des séances, retards en minutes, justifications et motifs.', 'standard', 'realtime', 'AttendanceAdapter.getStudentAttendanceLogReport', ARRAY['csv','xlsx','pdf'], ARRAY['attendance.read'], true),
  ('attendance.daily_matrix', 'Attendance', 1, 'Matrice Journalière de Présence par Section', 'Grille d''appel journalier par classe/section avec indicateur de registres verrouillés.', 'standard', 'realtime', 'AttendanceAdapter.getDailySectionMatrixReport', ARRAY['csv','xlsx','pdf'], ARRAY['attendance.read'], true),
  ('attendance.overview_streaks', 'Attendance', 1, 'Synthèse d''Assiduité & Alertes Récurrence', 'Statistiques globales de présence et identification des séries d''absences injustifiées.', 'standard', 'realtime', 'AttendanceAdapter.getAttendanceOverviewReport', ARRAY['csv','xlsx','pdf'], ARRAY['attendance.read'], true),
  ('attendance.employee_summary', 'Attendance', 1, 'Pointage & Heures de Présence Personnel', 'Heures travaillées, retards et absences du personnel enseignant et administratif.', 'restricted', 'realtime', 'AttendanceAdapter.getEmployeeAttendanceSummaryReport', ARRAY['csv','xlsx','pdf'], ARRAY['attendance.read'], true),
  ('attendance.exam_session', 'Attendance', 1, 'Émargement des Séances d''Examen', 'Présence, émargement et incidents des candidats en salle d''examen.', 'standard', 'realtime', 'AttendanceAdapter.getExamSessionAttendanceReport', ARRAY['csv','xlsx','pdf'], ARRAY['attendance.read','grading.read'], true),

  ('hr.payroll_summary', 'HR', 1, 'Masse Salariale & Synthèse de Paie', 'Synthèse des traitements bruts, cotisations et net à payer par département (avec masquage si < 3 personnes).', 'confidential', 'snapshot', 'HRAdapter.getPayrollSummaryReport', ARRAY['csv','xlsx','pdf'], ARRAY['hr.read'], true),
  ('hr.leave_balances', 'HR', 1, 'Droits & Soldes de Congés du Personnel', 'Compteur des jours de congés acquis, pris et solde restant par collaborateur.', 'restricted', 'realtime', 'HRAdapter.getLeaveBalancesReport', ARRAY['csv','xlsx','pdf'], ARRAY['hr.read'], true),

  ('exam.report_card', 'Examination', 1, 'Bulletin Scolaire Officiel (Snapshot Examen)', 'Génération et archivage des bulletins de notes officiels validés.', 'restricted', 'snapshot', 'ExaminationAdapter.getReportCardSnapshotReport', ARRAY['csv','xlsx','pdf'], ARRAY['grading.read'], true),
  ('exam.tabulation_sheet', 'Examination', 1, 'Procès-Verbal & Feuille de Tabulation des Notes', 'Tableau récapitulatif des notes par élève x matière pour conseil de classe.', 'restricted', 'realtime', 'ExaminationAdapter.getTabulationSheetReport', ARRAY['csv','xlsx','pdf'], ARRAY['grading.read'], true),
  ('exam.progress', 'Examination', 1, 'Suivi de la Progression & Compétences', 'Analyse comparative des résultats d''un élève au fil des périodes d''évaluation.', 'standard', 'realtime', 'ExaminationAdapter.getProgressReport', ARRAY['csv','xlsx','pdf'], ARRAY['grading.read'], true),

  ('inventory.stock_valuation', 'Inventory', 1, 'Inventaire & Valorisation des Stocks', 'Quantités en stock, seuils de réapprovisionnement et valeur financière des articles.', 'standard', 'realtime', 'InventoryAdapter.getStockValuationReport', ARRAY['csv','xlsx','pdf'], ARRAY['reports.read'], true),
  ('inventory.purchase_summary', 'Inventory', 1, 'Journal des Achats & Réceptions Fournisseurs', 'Commandes d''achats d''équipements et fournitures par fournisseur et statut.', 'standard', 'realtime', 'InventoryAdapter.getPurchaseSummaryReport', ARRAY['csv','xlsx','pdf'], ARRAY['reports.read'], true),
  ('inventory.sales_revenue', 'Inventory', 1, 'Ventes Boutique Scolaire & Manuels', 'Ventes d''articles, fournitures et manuels scolaires à la boutique de l''école.', 'standard', 'realtime', 'InventoryAdapter.getSalesRevenueReport', ARRAY['csv','xlsx','pdf'], ARRAY['reports.read'], true),
  ('inventory.issues_custody', 'Inventory', 1, 'Prêts d''Équipements & Consommations', 'Matériel prêté au personnel/élèves, dates d''échéance de retour et retards.', 'standard', 'realtime', 'InventoryAdapter.getIssuesCustodyReport', ARRAY['csv','xlsx','pdf'], ARRAY['reports.read'], true)
ON CONFLICT (key) DO UPDATE SET
  domain = EXCLUDED.domain,
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  sensitivity_level = EXCLUDED.sensitivity_level,
  freshness_type = EXCLUDED.freshness_type,
  execution_adapter = EXCLUDED.execution_adapter,
  supported_formats = EXCLUDED.supported_formats,
  required_permissions = EXCLUDED.required_permissions,
  updated_at = now();
