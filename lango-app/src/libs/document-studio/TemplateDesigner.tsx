'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Designer } from '@pdfme/ui';
import { text, image, barcodes } from '@pdfme/schemas';
import { DocumentTemplateSchema, FieldAllowlist } from './types';
import { validateTemplateFields } from './validators';
import { Button } from '@/components/ui/button';

import { AlertCircle, Save } from 'lucide-react';

export interface TemplateDesignerProps {
  initialTemplate: DocumentTemplateSchema;
  allowlist: FieldAllowlist;
  onSave: (template: DocumentTemplateSchema) => Promise<void>;
  isSaving?: boolean;
}

export function TemplateDesigner({ initialTemplate, allowlist, onSave, isSaving }: TemplateDesignerProps) {
  const designerRef = useRef<HTMLDivElement>(null);
  const designerInstance = useRef<Designer | null>(null);
  const [violations, setViolations] = useState<string[]>([]);

  useEffect(() => {
    if (!designerRef.current) return;

    let mounted = true;

    Promise.all([
      import('@pdfme/ui').then(m => m.Designer),
      import('./fonts').then(m => m.loadFonts())
    ]).then(([Designer, font]) => {
      if (!mounted) return;
      designerInstance.current = new Designer({
        domContainer: designerRef.current!,
        template: initialTemplate,
        plugins: { text, image, qrcode: barcodes.qrcode, barcode: barcodes.code128 },
        options: { font },
      });

      designerInstance.current.onChangeTemplate((newTemplate: DocumentTemplateSchema) => {
        const invalidFields = validateTemplateFields(newTemplate, allowlist);
        setViolations(invalidFields);
      });
    }).catch(console.error);

    return () => {
      mounted = false;
      if (designerInstance.current) {
        designerInstance.current.destroy();
        designerInstance.current = null;
      }
    };
  }, []);

  const handleSave = () => {
    if (designerInstance.current) {
      const currentTemplate = designerInstance.current.getTemplate() as DocumentTemplateSchema;
      const invalidFields = validateTemplateFields(currentTemplate, allowlist);
      setViolations(invalidFields);
      if (invalidFields.length === 0) {
        onSave(currentTemplate);
      }
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full h-[800px]">
      <div className="flex justify-between items-center bg-white p-4 border rounded-md shadow-sm">
        <h2 className="text-lg font-semibold">Éditeur de Modèle</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500">
            Champs autorisés: {allowlist.allowedFields.join(', ')}
          </div>
          <Button onClick={handleSave} disabled={isSaving || violations.length > 0}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Enregistrement...' : 'Enregistrer le modèle'}
          </Button>
        </div>
      </div>

      {violations.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="font-medium text-red-800 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Champs non autorisés détectés
          </h4>
          <p className="text-sm mt-1 text-red-600">
            Veuillez supprimer les champs suivants ou les renommer avec un nom autorisé: {violations.join(', ')}
          </p>
        </div>
      )}

      <div className="flex-grow border rounded-md overflow-hidden bg-gray-50" ref={designerRef} />
    </div>
  );
}
