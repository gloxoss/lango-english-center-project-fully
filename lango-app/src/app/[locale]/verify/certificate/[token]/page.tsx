'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, XCircle, ScrollText, Loader2 } from 'lucide-react';

type VerifyResult = {
  valid: boolean;
  recipientName?: string;
  certificateTitle?: string;
  serialNumber?: string;
  issuedAt?: string;
  schoolName?: string;
};

// Real, minimal, no-login public certificate verification. The token arrives in
// the URL and is verified server-side (rate-limited, sha256 lookup). The
// response never distinguishes a revoked/replaced certificate from a token that
// was never issued, and never exposes evidence snapshot data.
export default function VerifyCertificatePage() {
  const params = useParams<{ token?: string }>();
  const urlToken = Array.isArray(params?.token) ? params.token[0] : (params?.token ?? '');

  const [token, setToken] = useState(urlToken);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const verify = async (value: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/public/certificates/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: value.trim() }),
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

  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      verify(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlToken]);

  return (
    <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-2 justify-center">
          <div className="w-9 h-9 bg-[#2487B8] rounded-xl flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-black text-[#16212B]">Vérification de certificat</span>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (token.trim()) verify(token); }}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
              Jeton de vérification
            </label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Collez le jeton du certificat ici"
              className="w-full h-11 px-4 bg-slate-50 border border-slate-200 focus:border-[#2487B8] rounded-xl text-xs font-mono outline-none"
            />
          </div>
          {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={loading || !token.trim()}
            className="w-full h-11 bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vérifier'}
          </button>
        </form>

        {result && (
          <div className={`p-4 rounded-2xl border text-center ${result.valid ? 'bg-[#DDF5EC] border-[#17A673]/30' : 'bg-rose-50 border-rose-200'}`}>
            {result.valid ? (
              <div className="space-y-1.5">
                <CheckCircle2 className="w-8 h-8 text-[#17A673] mx-auto" />
                <p className="text-sm font-extrabold text-[#17A673]">Certificat authentique</p>
                <p className="text-xs text-slate-600">
                  {result.certificateTitle}{' '}délivré à <strong>{result.recipientName}</strong>{' '}
                  par {result.schoolName}
                </p>
                {result.serialNumber && (
                  <p className="text-[10px] font-mono text-slate-500">N° {result.serialNumber}</p>
                )}
                {result.issuedAt && (
                  <p className="text-[10px] text-slate-400">
                    Délivré le {new Date(result.issuedAt).toLocaleDateString('fr-FR')}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <XCircle className="w-8 h-8 text-rose-500 mx-auto" />
                <p className="text-sm font-extrabold text-rose-600">Certificat non reconnu</p>
                <p className="text-xs text-slate-500">Ce jeton ne correspond à aucun certificat valide.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
