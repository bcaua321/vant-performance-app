export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            VANT<span className="text-signal">·</span>Performance
          </h1>
          <p className="mt-1 text-sm text-muted">
            Análise de desempenho de VANTs elétricos de asa fixa
          </p>
        </div>
        {children}
      </div>
    </main>
  );
}
