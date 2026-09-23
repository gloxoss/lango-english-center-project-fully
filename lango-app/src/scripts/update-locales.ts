import fs from 'node:fs';
import path from 'node:path';

const localesDir = path.resolve('locales');

const newEnKeys: Record<string, string> = {
  filterAll: 'All',
  filterWithPhoto: 'With Photo',
  filterWithoutPhoto: 'Without Photo',
  searchPhotosPlaceholder: 'Search by name, matricule, or Massar...',
  deletePhotoBtn: 'Delete photo',
  deletePhotoConfirm: 'Are you sure you want to remove this student\'s profile photo? The display will revert to initials.',
  photoDeletedSuccess: 'Photo deleted successfully.',
  bulkPreviewStage: 'Reconciliation & Preview',
  bulkPreviewDesc: 'Review detected student mappings and validation statuses before applying changes to the database.',
  bulkColFile: 'File',
  bulkColDetected: 'Detected Identifier',
  bulkColMatched: 'Matched Student',
  bulkColMatricule: 'Matricule',
  bulkColMethod: 'Method',
  bulkColStatus: 'Status',
  bulkColDetails: 'Details',
  bulkStatusReady: 'Ready',
  bulkStatusExisting: 'Existing photo',
  bulkStatusAmbiguous: 'Ambiguous name',
  bulkStatusDuplicate: 'Duplicate in batch',
  bulkStatusInvalid: 'Invalid image',
  bulkStatusTooLarge: 'File too large',
  bulkStatusNoMatch: 'No match',
  bulkMethodUuid: 'UUID',
  bulkMethodMatricule: 'Matricule',
  bulkMethodMassar: 'Massar',
  bulkMethodName: 'Full name',
  bulkBtnPreview: 'Analyze Candidates',
  bulkBtnConfirm: 'Confirm & Import ({count})',
  bulkAllowReplace: 'Replace existing photos for matched students',
  bulkSummaryReady: '{count} ready',
  bulkSummaryExisting: '{count} existing',
  bulkSummaryAmbiguous: '{count} ambiguous (skipped)',
  bulkSummaryDuplicate: '{count} duplicate (skipped)',
  bulkSummaryInvalid: '{count} invalid',
  bulkSummaryNoMatch: '{count} unmatched',
  bulkCompleteReport: 'Import Report',
  bulkCommittedCount: '{count} photo(s) successfully imported.',
};

const newFrKeys: Record<string, string> = {
  filterAll: 'Tous',
  filterWithPhoto: 'Avec Photo',
  filterWithoutPhoto: 'Sans Photo',
  searchPhotosPlaceholder: 'Rechercher par nom, matricule ou Massar...',
  deletePhotoBtn: 'Supprimer la photo',
  deletePhotoConfirm: 'Êtes-vous sûr de vouloir supprimer la photo de profil de cet élève ? L\'affichage utilisera à nouveau ses initiales.',
  photoDeletedSuccess: 'Photo supprimée avec succès.',
  bulkPreviewStage: 'Rapprochement et Prévisualisation',
  bulkPreviewDesc: 'Vérifiez les correspondances détectées et les statuts de validation avant d\'appliquer les modifications en base.',
  bulkColFile: 'Fichier',
  bulkColDetected: 'Identifiant détecté',
  bulkColMatched: 'Élève associé',
  bulkColMatricule: 'Matricule',
  bulkColMethod: 'Méthode',
  bulkColStatus: 'Statut',
  bulkColDetails: 'Détails',
  bulkStatusReady: 'Prêt',
  bulkStatusExisting: 'Photo existante',
  bulkStatusAmbiguous: 'Nom ambigu',
  bulkStatusDuplicate: 'Doublon dans le lot',
  bulkStatusInvalid: 'Image invalide',
  bulkStatusTooLarge: 'Fichier trop lourd',
  bulkStatusNoMatch: 'Aucune correspondance',
  bulkMethodUuid: 'UUID',
  bulkMethodMatricule: 'Matricule',
  bulkMethodMassar: 'Massar',
  bulkMethodName: 'Nom complet',
  bulkBtnPreview: 'Analyser les correspondances',
  bulkBtnConfirm: 'Confirmer et importer ({count})',
  bulkAllowReplace: 'Remplacer les photos existantes pour les élèves détectés',
  bulkSummaryReady: '{count} prêt(s)',
  bulkSummaryExisting: '{count} existante(s)',
  bulkSummaryAmbiguous: '{count} ambigu(s) (ignorés)',
  bulkSummaryDuplicate: '{count} doublon(s) (ignorés)',
  bulkSummaryInvalid: '{count} invalide(s)',
  bulkSummaryNoMatch: '{count} sans correspondance',
  bulkCompleteReport: 'Rapport d\'importation',
  bulkCommittedCount: '{count} photo(s) enregistrée(s) avec succès.',
};

const newArKeys: Record<string, string> = {
  filterAll: 'الكل',
  filterWithPhoto: 'مع صورة',
  filterWithoutPhoto: 'بدون صورة',
  searchPhotosPlaceholder: 'البحث بالاسم أو رقم القيد أو مسار...',
  deletePhotoBtn: 'حذف الصورة',
  deletePhotoConfirm: 'هل أنت متأكد من رغبتك في حذف الصورة الشخصية لهذا التلميذ؟ ستتم العودة إلى عرض الأحرف الأولى.',
  photoDeletedSuccess: 'تم حذف الصورة بنجاح.',
  bulkPreviewStage: 'مطابقة ومعاينة الصور',
  bulkPreviewDesc: 'تحقق من مطابقة التلاميذ وحالات الصلاحية قبل اعتماد التعديلات في قاعدة البيانات.',
  bulkColFile: 'الملف',
  bulkColDetected: 'المعرف المكتشف',
  bulkColMatched: 'التلميذ المطابق',
  bulkColMatricule: 'رقم القيد',
  bulkColMethod: 'طريقة المطابقة',
  bulkColStatus: 'الحالة',
  bulkColDetails: 'التفاصيل',
  bulkStatusReady: 'جاهز',
  bulkStatusExisting: 'صورة موجودة',
  bulkStatusAmbiguous: 'اسم مكرر/غامض',
  bulkStatusDuplicate: 'ملف مكرر في الدفعة',
  bulkStatusInvalid: 'صورة غير صالحة',
  bulkStatusTooLarge: 'حجم الملف كبير جداً',
  bulkStatusNoMatch: 'لا توجد مطابقة',
  bulkMethodUuid: 'UUID',
  bulkMethodMatricule: 'رقم القيد',
  bulkMethodMassar: 'مسار',
  bulkMethodName: 'الاسم الكامل',
  bulkBtnPreview: 'تحليل المطابقات',
  bulkBtnConfirm: 'تأكيد واستيراد ({count})',
  bulkAllowReplace: 'استبدال الصور الحالية للتلاميذ المطابقين',
  bulkSummaryReady: '{count} جاهز',
  bulkSummaryExisting: '{count} موجودة',
  bulkSummaryAmbiguous: '{count} مكرر (تم تجاهله)',
  bulkSummaryDuplicate: '{count} ملف مكرر (تم تجاهله)',
  bulkSummaryInvalid: '{count} غير صالح',
  bulkSummaryNoMatch: '{count} غير مطابق',
  bulkCompleteReport: 'تقرير الاستيراد',
  bulkCommittedCount: 'تم استيراد {count} صورة بنجاح.',
};

function updateFile(file: string, keys: Record<string, string>) {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  if (!data.Students) data.Students = {};
  for (const [k, v] of Object.entries(keys)) {
    data.Students[k] = v;
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${file}`);
}

updateFile('en.json', newEnKeys);
updateFile('fr.json', newFrKeys);
updateFile('ar.json', newArKeys);
