export function ComingSoon({ siteName }: { siteName: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-extrabold text-[#16212B] mb-2">{siteName}</h1>
        <p className="text-sm text-slate-500">Ce site est actuellement indisponible. Revenez bientôt.</p>
      </div>
    </div>
  );
}
