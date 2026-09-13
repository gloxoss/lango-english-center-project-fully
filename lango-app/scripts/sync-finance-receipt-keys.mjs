import fs from 'fs';
import path from 'path';

const localesDir = path.resolve('locales');

const financeKeys = {
  en: {
    uploadReceiptLabel: "Receipt / Invoice Attachment (PDF, JPG, PNG)",
    uploadingReceipt: "Uploading receipt...",
    receiptUploaded: "Receipt attached",
    removeReceipt: "Remove",
    receiptUploadError: "Failed to upload receipt. Please check file format and size (max 8MB)."
  },
  fr: {
    uploadReceiptLabel: "Justificatif / Facture (PDF, JPG, PNG)",
    uploadingReceipt: "Téléversement du justificatif...",
    receiptUploaded: "Justificatif joint",
    removeReceipt: "Supprimer",
    receiptUploadError: "Échec du téléversement du justificatif. Vérifiez le format et la taille (max 8 Mo)."
  },
  ar: {
    uploadReceiptLabel: "مرفق الإيصال / الفاتورة (PDF, JPG, PNG)",
    uploadingReceipt: "جاري رفع الإيصال...",
    receiptUploaded: "تم إرفاق الإيصال",
    removeReceipt: "إزالة",
    receiptUploadError: "فشل رفع الإيصال. يرجى التحقق من نوع وحجم الملف (أقصى حد 8 ميغابايت)."
  }
};

['en', 'fr', 'ar'].forEach(lang => {
  const filePath = path.join(localesDir, `${lang}.json`);
  const json = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  json.Finance = json.Finance || {};
  Object.assign(json.Finance, financeKeys[lang]);
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated Finance keys in ${lang}.json`);
});
