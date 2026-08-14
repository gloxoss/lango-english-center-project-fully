'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, GraduationCap, Loader2 } from 'lucide-react';

type VerifyResult = { valid: boolean; alumnusName?: string; documentType?: string; issuedAt?: string; schoolName?: string };

const DOCUMENT_LABELS: Record<string, string> = {
  transcript: 'Relevé de notes',
  certificate: 'Certificat',
  attestation: 'Attestation',
};

// Real, minimal, no-login public verification page (future-implementation
// /alumni-portal) - no navigation, no session, just a real yes/no answer.
export default function VerifyDocumentPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/public/alumni-documents/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message || 'Vérification impossible pour le moment.');
        return;
      }
      setResult(json.data);
    } catch {
      setError('Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="w-9 h-9 bg-[#0066FF] rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black text-[#16212B]">Vérification de document</span>
        </div>

        <form onSubmit={handleVerify} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">Code de vérification</label>
            <input
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="VER-2026-000001"
              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 focus:border-[#0066FF] rounded-xl text-sm font-mono outline-none"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full h-11 bg-[#0066FF] hover:bg-[#0052CC] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
          </button>
        </form>

        {result && (
          <div className={`p-4 rounded-2xl border text-center ${result.valid ? 'bg-[#DDF5EC] border-[#17A673]/30' : 'bg-rose-50 border-rose-200'}`}>
            {result.valid
              ? (
                  <div className="space-y-1.5">
                    <CheckCircle2 className="w-8 h-8 text-[#17A673] mx-auto" />
                    <p className="text-sm font-extrabold text-[#17A673]">Document authentique</p>
                    <p className="text-xs text-slate-600">
                      {DOCUMENT_LABELS[result.documentType ?? ''] ?? result.documentType}
                      {' '}
                      délivré à
                      {' '}
                      <strong>{result.alumnusName}</strong>
                      {' '}
                      par
                      {' '}
                      {result.schoolName}
                    </p>
                    {result.issuedAt && <p className="text-[10px] text-slate-400">Délivré le {new Date(result.issuedAt).toLocaleDateString('fr-FR')}</p>}
                  </div>
                )
              : (
                  <div className="space-y-1.5">
                    <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
                    <p className="text-sm font-extrabold text-rose-600">Code non reconnu</p>
                    <p className="text-xs text-slate-500">Ce code ne correspond à aucun document valide.</p>
                  </div>
                )}
          </div>
        )}
      </div>
    </main>
  );
}
