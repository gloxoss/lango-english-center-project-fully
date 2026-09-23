import fs from 'node:fs';

const filePath = 'src/features/students/ui/admission-requests-client.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add getDocumentLabel helper right before component export or inside component
const targetGetStatusLabel = `  const getStatusLabel = (status: string | null | undefined) => {`;
const replacementGetStatusLabel = `  const getDocumentLabel = (docType: string): string => {
    switch (docType) {
      case 'photo': return t('docPhoto');
      case 'birth_certificate': return t('docBirthCertificate');
      case 'school_certificate': return t('docSchoolCertificate');
      case 'guardian_cni': return t('docGuardianCni');
      case 'bulletin': return t('docBulletin');
      default: return docType;
    }
  };

  const getStatusLabel = (status: string | null | undefined) => {
    const s = (status || '').toLowerCase().trim();
    switch (s) {
      case 'applied':
      case 'new':
        return t('applicantReceived');
      case 'in_review':
      case 'contacted':
        return t('applicantInReview');
      case 'approved':
        return t('applicantApprovedNotEnrolled');
      case 'enrolled':
      case 'converted':
        return t('applicantEnrolled');
      case 'rejected':
      case 'lost':
        return t('applicantRejected');
      default:
        return t('applicantReceived');
    }
  };`;

content = content.replace(
  /const getStatusLabel = \(status: string \| null \| undefined\) => \{[\s\S]*?default:[\s\S]*?\}\s*;/m,
  replacementGetStatusLabel
);

// 2. Subtitle
content = content.replace(
  `<p className="text-xs text-slate-500 mt-1">\\n            Gestion du flux d'admission, validation des dossiers et affectation scolaire officielle.\\n          </p>`,
  `<p className="text-xs text-slate-500 mt-1">\\n            {t('admissionsSubtitle')}\\n          </p>`
);
// fallback pattern if newlines differ
content = content.replace(
  /Gestion du flux d'admission, validation des dossiers et affectation scolaire officielle\./g,
  `{t('admissionsSubtitle')}`
);

// 3. Status filter buttons
content = content.replace(
  `<span>Approuvées</span>`,
  `<span>{t('approvedFilter')}</span>`
);
content = content.replace(
  `<span>Inscrites</span>`,
  `<span>{t('enrolledFilter')}</span>`
);

// 4. Search placeholder
content = content.replace(
  `placeholder="Rechercher nom, Code Massar, tél, email..."`,
  `placeholder={t('searchPlaceholder')}`
);

// 5. Left panel empty state
const oldLeftEmpty = `            {!loading && applicants.length === 0 && (
              <Card className="p-8 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center">
                <p className="text-xs text-slate-400">{t('noAdmissions')}</p>
              </Card>
            )}`;

const newLeftEmpty = `            {!loading && applicants.length === 0 && (
              <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs text-center space-y-2">
                <p className="text-xs font-bold text-slate-700">{t('noAdmissionsInFilter')}</p>
                <p className="text-[11px] text-slate-400">{t('noAdmissionsFilterHint')}</p>
                {(search.trim() !== '' || statusFilter !== 'all') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('all');
                    }}
                    className="h-7 text-xs rounded-xl text-slate-600 border-slate-200 mt-2 hover:bg-slate-50 cursor-pointer"
                  >
                    {t('resetFilters')}
                  </Button>
                )}
              </Card>
            )}`;

content = content.replace(oldLeftEmpty, newLeftEmpty);

// 6. Right panel empty state
const oldRightEmpty = `          {!activeCandidate ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Eye className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">Sélectionnez une demande d'admission pour afficher le dossier</p>
            </Card>
          ) : (`;

const newRightEmpty = `          {applicants.length === 0 ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">{t('noAdmissionsInFilter')}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {t('noAdmissionsFilterHint')}
                </p>
              </div>
              {(search.trim() !== '' || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('all');
                  }}
                  className="h-8 px-3 rounded-xl text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 mt-1 cursor-pointer"
                >
                  {t('resetFilters')}
                </Button>
              )}
            </Card>
          ) : !activeCandidate ? (
            <Card className="p-12 bg-white rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col items-center justify-center gap-3 text-center">
              <Eye className="w-10 h-10 text-slate-200" />
              <p className="text-sm font-bold text-slate-400">{t('selectAdmissionToView')}</p>
            </Card>
          ) : (`;

content = content.replace(oldRightEmpty, newRightEmpty);

// 7. Mobile back button and pagination icons
content = content.replace(
  `<ArrowLeft className="w-3.5 h-3.5" />\n                Retour à la liste`,
  `<ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />\n                {t('backToList')}`
);
content = content.replace(
  `<ChevronLeft className="w-3.5 h-3.5" />`,
  `<ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />`
);
content = content.replace(
  `<ChevronRight className="w-3.5 h-3.5" />`,
  `<ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />`
);

// 8. Hero badge & submitted date
content = content.replace(
  `Massar : {activeCandidate.nationalId}`,
  `{t('massarCode')} : {activeCandidate.nationalId}`
);
content = content.replace(
  `<span>Reçue le {activeCandidate.applicationDate?.slice(0, 10)}</span>`,
  `{activeCandidate.applicationDate && <span>{t('submittedOn', { date: activeCandidate.applicationDate.slice(0, 10) })}</span>}`
);

// 9. Approved Banner
content = content.replace(
  `Candidature acceptée par l'établissement`,
  `{t('approvedBannerTitle')}`
);
content = content.replace(
  `L'inscription doit être finalisée pour attribuer un matricule séquentiel, créer le compte élève et acter l'affectation académique.`,
  `{t('approvedBannerSubtitle')}`
);

// 10. Enrolled Banner
content = content.replace(
  `Élève officiellement inscrit dans l'établissement`,
  `{t('enrolledBannerTitle')}`
);
content = content.replace(
  `{activeCandidate.convertedStudent?.matricule
                          ? \`Matricule officiel : \${activeCandidate.convertedStudent.matricule}\`
                          : 'Matricule attribué'}
                        {activeCandidate.enrolledAt && \` · Inscrit le \${activeCandidate.enrolledAt.slice(0, 10)}\`}`,
  `{activeCandidate.convertedStudent?.matricule
                          ? t('enrolledBannerOfficialMatricule', { matricule: activeCandidate.convertedStudent.matricule })
                          : t('officialMatricule')}
                        {activeCandidate.enrolledAt && ' · ' + t('enrolledBannerDate', { date: activeCandidate.enrolledAt.slice(0, 10) })}`
);
content = content.replace(
  `<ExternalLink className="w-3.5 h-3.5" />`,
  `<ExternalLink className="w-3.5 h-3.5 rtl:rotate-180" />`
);

// 11. Rejected Banner
content = content.replace(
  `<p className="text-xs font-bold text-rose-900">Candidature rejetée</p>`,
  `<p className="text-xs font-bold text-rose-900">{t('rejectedBannerTitle')}</p>`
);
content = content.replace(
  `Motif : {activeCandidate.rejectionReason}`,
  `{t('rejectionReasonPrefix', { reason: activeCandidate.rejectionReason })}`
);
content = content.replace(
  `Décision prise le {activeCandidate.rejectedAt.slice(0, 10)}`,
  `{t('decisionDatePrefix', { date: activeCandidate.rejectedAt.slice(0, 10) })}`
);

// 12. Candidate Info & Guardian Info Cards
content = content.replace(
  `Informations Candidat`,
  `{t('candidateInfoTitle')}`
);
content = content.replace(
  `Contact Tuteur Référent`,
  `{t('guardianInfoTitle')}`
);
content = content.replace(
  `{activeCandidate.guardianName || 'Non renseigné'}`,
  `{activeCandidate.guardianName || t('notSpecified')}`
);
content = content.replace(
  `<span>{activeCandidate.dateOfBirth.slice(0, 10)} ({computeAge(activeCandidate.dateOfBirth)})</span>`,
  `<span>{activeCandidate.dateOfBirth.slice(0, 10)} {computeAge(activeCandidate.dateOfBirth) ? \`(\${t('ageYears', { years: computeAge(activeCandidate.dateOfBirth) })})\` : ''}</span>`
);

// 13. Documents Section
content = content.replace(
  `Dossier & Pièces Justificatives`,
  `{t('documentsSectionTitle')}`
);
content = content.replace(
  `{activeDetail?.documents?.length ?? 0} document(s) téléversé(s)`,
  `{t('uploadedDocumentsCount', { count: activeDetail?.documents?.length ?? 0 })}`
);
content = content.replace(
  `const label = DOCUMENT_LABELS[docType] || docType;`,
  `const label = getDocumentLabel(docType);`
);
content = content.replace(
  `{uploadedDoc ? \`Téléversé (.\${uploadedDoc.fileExt})\` : 'Non fourni'}`,
  `{uploadedDoc ? t('docUploadedExt', { ext: uploadedDoc.fileExt }) : t('docNotProvided')}`
);

// 14. Checklist Section
content = content.replace(
  `Checklist de validation du dossier`,
  `{t('checklistTitle')}`
);
content = content.replace(
  `Synchronisé avec les étapes d'admission`,
  `{t('checklistSubtitle')}`
);
content = content.replace(
  `label: 'Entretien réalisé',\n                      desc: 'Évaluation pédagogique menée',`,
  `label: t('checklistInterviewDoneTitle'),\n                      desc: t('checklistInterviewDoneDesc'),`
);
content = content.replace(
  `label: 'Pièces requises reçues',\n                      desc: 'Documents légaux fournis',`,
  `label: t('checklistDocsReceivedTitle'),\n                      desc: t('checklistDocsReceivedDesc'),`
);
content = content.replace(
  `label: 'Dossier complet',\n                      desc: 'Prêt pour décision et inscription',`,
  `label: t('checklistFileCompleteTitle'),\n                      desc: t('checklistFileCompleteDesc'),`
);

// 15. Internal Notes
content = content.replace(
  `Notes internes (équipe uniquement)`,
  `{t('internalNotesTitle')}`
);
content = content.replace(
  `Confidentiel · Équipe administrative`,
  `{t('internalNotesSubtitle')}`
);
content = content.replace(
  `Aucune note pour le moment.`,
  `{t('noInternalNotes')}`
);
content = content.replace(
  `{c.authorName ?? 'Équipe'}`,
  `{c.authorName ?? t('administrativeTeam')}`
);
content = content.replace(
  `placeholder="Ajouter une observation d'équipe..."`,
  `placeholder={t('addNotePlaceholder')}`
);

// 16. Action button "Approuver l'admission"
content = content.replace(
  `<span>Approuver l'admission</span>`,
  `<span>{t('approveAdmissionAction')}</span>`
);

// 17. Enrollment Modal Content
content = content.replace(
  `<span>Succursale : <strong className="text-slate-700">{activeCandidate.branchName || 'Campus Principal'}</strong></span>`,
  `<span>{t('targetBranch')} : <strong className="text-slate-700">{activeCandidate.branchName || 'Campus Principal'}</strong></span>`
);
content = content.replace(
  `<span>Année : <strong className="text-slate-700">{activeCandidate.sessionYearName || '2026-2027'}</strong></span>`,
  `<span>{t('targetSessionYear')} : <strong className="text-slate-700">{activeCandidate.sessionYearName || '2026-2027'}</strong></span>`
);
content = content.replace(
  `{cs.className} {cs.sectionName} — {cs.currentOccupancy ?? 0}/{cs.maxStudents ?? 'Non config.'} places {isFull ? '(COMPLÈTE)' : ''}`,
  `{cs.className} {cs.sectionName} — {cs.currentOccupancy ?? 0}/{cs.maxStudents ?? t('sectionCapacityUnconfigured')} {t('placesWord')} {isFull ? '(' + t('sectionFull').toUpperCase() + ')' : ''}`
);
content = content.replace(
  `Si aucune classe n'est sélectionnée, l'élève sera créé avec le statut "Sans classe assignée".`,
  `{t('unassignedClassNotice')}`
);

// 18. Guardian microcopy in modal (Requirement 3: avoid implying verification)
content = content.replace(
  `<p className="font-bold text-teal-900 text-xs">Gestion du tuteur</p>`,
  `<p className="font-bold text-teal-900 text-xs">{t('guardianManagementTitle')}</p>`
);
content = content.replace(
  `{activeCandidate.guardianPhone
                      ? \`Le contact \${activeCandidate.guardianName || 'Parent'} (\${activeCandidate.guardianPhone}) sera automatiquement rattaché ou créé.\`
                      : 'Aucun contact tuteur déclaré.'}`,
  `{activeCandidate.guardianPhone
                      ? t('guardianManagementNotice')
                      : t('guardianManagementEmpty')}`
);

// 19. Rejection Modal subtitle
content = content.replace(
  `Veuillez indiquer la raison du rejet de la candidature.`,
  `{t('rejectionModalSubtitle')}`
);

// 20. Edit Applicant Modal subtitle & fields
content = content.replace(
  `Mettez à jour les informations du candidat. Les modifications sont possibles tant qu'aucune décision définitive n'a été prise.`,
  `{t('editCandidateSubtitle')}`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Prénom *</span>`,
  `<span className="font-bold text-slate-600">{t('firstName')} *</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Nom *</span>`,
  `<span className="font-bold text-slate-600">{t('lastName')} *</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Email *</span>`,
  `<span className="font-bold text-slate-600">{t('email')} *</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Téléphone *</span>`,
  `<span className="font-bold text-slate-600">{t('phone')} *</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Code Massar (optionnel)</span>`,
  `<span className="font-bold text-slate-600">{t('massarCode')} ({t('notSpecified')})</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Date de naissance</span>`,
  `<span className="font-bold text-slate-600">{t('dateOfBirth')}</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Nom du Tuteur</span>`,
  `<span className="font-bold text-slate-600">{t('guardianName')}</span>`
);
content = content.replace(
  `<span className="font-bold text-slate-600">Téléphone du Tuteur</span>`,
  `<span className="font-bold text-slate-600">{t('guardianPhone')}</span>`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched admission-requests-client.tsx');
