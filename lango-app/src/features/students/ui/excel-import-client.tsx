'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import {
  Upload, FileSpreadsheet, Download, UserPlus,
} from 'lucide-react';
import { IMPORT_RULES } from '../data/excel-import-config';

export function ExcelImportClient({ locale: _locale }: { locale?: string } = {}) {
  const [activeTab, setActiveTab] = useState<'manual' | 'import'>('import');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#16212B] tracking-tight">Création & Import d&apos;élèves</h1>
          <p className="text-xs text-slate-500 mt-1">Ajoutez un nouvel élève manuellement ou importez un lot complet via fichier Excel / CSV.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-10 rounded-xl px-4 gap-2 border-slate-200 text-xs font-bold">
            <Download className="w-4 h-4 text-slate-600" />
            <span>Télécharger le modèle CSV</span>
          </Button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'manual' ? 'bg-[#2487B8] text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          <span>Création manuelle</span>
        </button>
        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition ${
            activeTab === 'import' ? 'bg-[#2487B8] text-white' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Import massif (Excel / CSV)</span>
        </button>
      </div>

      {/* TAB 1: Manual Form */}
      {activeTab === 'manual' && (
        <Card className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-6 max-w-3xl">
          <h2 className="text-base font-extrabold text-[#16212B]">Identité de l&apos;élève</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Prénom *</label>
              <Input placeholder="Ex. Youssef" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Nom *</label>
              <Input placeholder="Ex. El Amrani" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Date de naissance</label>
              <Input type="date" className="h-9 text-xs rounded-xl" />
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Genre</label>
              <Select defaultValue="M">
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <h2 className="text-base font-extrabold text-[#16212B] pt-2 border-t border-slate-100">Affectation scolaire</h2>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Niveau d&apos;études *</label>
              <Select defaultValue="2nde">
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2nde">Seconde (2de)</SelectItem>
                  <SelectItem value="1ere">Première (1ère)</SelectItem>
                  <SelectItem value="Tle">Terminale (Tle)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="font-bold text-slate-700 block mb-1">Classe / Section *</label>
              <Select defaultValue="2BAC-A">
                <SelectTrigger className="h-9 text-xs rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2BAC-A">2BAC-A (Casablanca Main)</SelectItem>
                  <SelectItem value="2BAC-B">2BAC-B (Casablanca Main)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="outline" className="h-10 rounded-xl px-5 text-xs font-bold">Annuler</Button>
            <Button className="h-10 rounded-xl px-6 text-xs font-bold bg-[#2487B8] hover:bg-[#1B6C93] text-white">Créer le dossier</Button>
          </div>
        </Card>
      )}

      {/* TAB 2: Excel / CSV Import Workspace */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          <Card className="p-8 bg-white rounded-2xl border-2 border-dashed border-slate-200 shadow-2xs text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DCEBF4] text-[#1B6C93] flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-[#16212B]">Glissez-déposez votre fichier Excel / CSV ici</p>
              <p className="text-xs text-slate-400 mt-0.5">Formats supportés: .xlsx, .xls, .csv (Taille max: 10 Mo)</p>
              {uploadedFile && (
                <p className="text-xs font-extrabold text-[#17A673] mt-2">Fichier sélectionné: {uploadedFile.name}</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => setUploadedFile(e.target.files?.[0] ?? null)}
            />
            <Button
              onClick={() => fileRef.current?.click()}
              variant="outline"
              size="sm"
              className="h-9 rounded-xl px-4 text-xs font-bold border-slate-200 text-[#2487B8]"
            >
              Parcourir mes fichiers
            </Button>
          </Card>

          {/* Import Rules Format Spec Card */}
          <Card className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs space-y-3">
            <h3 className="text-xs font-extrabold text-[#16212B]">Spécifications des colonnes du modèle CSV / Excel</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {IMPORT_RULES.map((rule, idx) => (
                <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                  <div className="flex justify-between font-bold text-[#16212B]">
                    <span>{rule.column}</span>
                    <span className={rule.required ? 'text-rose-600 text-[10px]' : 'text-slate-400 text-[10px]'}>
                      {rule.required ? 'Obligatoire' : 'Optionnel'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500">{rule.format}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
