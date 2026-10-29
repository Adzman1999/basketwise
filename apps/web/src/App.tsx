import { useEffect, useState } from 'react';
import { fetchHealthStatus, type HealthResponse } from './lib/api';

type ConnectionState =
  | { kind: 'checking' }
  | { kind: 'connected'; health: HealthResponse }
  | { kind: 'error'; message: string };

function formatCheckedAt(timestamp: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(timestamp));
}

export default function App() {
  const [connection, setConnection] = useState<ConnectionState>({ kind: 'checking' });
  const [checkNumber, setCheckNumber] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setConnection({ kind: 'checking' });

    void fetchHealthStatus(controller.signal)
      .then((health) => {
        if (!controller.signal.aborted) {
          setConnection({ kind: 'connected', health });
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : 'The API is unavailable.';
          setConnection({ kind: 'error', message });
        }
      });

    return () => controller.abort();
  }, [checkNumber]);

  const isChecking = connection.kind === 'checking';
  const isConnected = connection.kind === 'connected';
  const statusLabel = isChecking ? 'Checking' : isConnected ? 'Connected' : 'Unavailable';

  return (
    <div className="min-h-screen overflow-hidden bg-[#f5f6ef] text-[#1d342b]">
      <div className="pointer-events-none absolute -left-32 top-40 h-80 w-80 rounded-full bg-[#e3eddb] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 bottom-0 h-96 w-96 rounded-full bg-[#e8ead9] opacity-70 blur-3xl" />

      <div className="relative mx-auto min-h-screen max-w-6xl px-5 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#d9e0d5] py-5">
          <a href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2d6a4f]">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dcebdc]">
              <svg aria-hidden="true" viewBox="0 0 40 40" className="h-7 w-7" fill="none">
                <path d="M8 16h24l-2.2 15H10.2L8 16Z" stroke="#285E49" strokeWidth="2.2" strokeLinejoin="round" />
                <path d="m14 16 4-8m8 8-4-8M9.2 22h21.6M15 22v7m5-7v7m5-7v7" stroke="#285E49" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span>
              <span className="block text-lg font-semibold tracking-tight">Basketwise</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-[#6d7c70]">Home food costs</span>
            </span>
          </a>

          <div className="hidden items-center gap-2 rounded-full border border-[#d9e0d5] bg-white/70 px-3 py-2 text-xs font-medium text-[#53645a] sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#6a9c70]" />
            Early build
          </div>
        </header>

        <main className="grid gap-12 py-14 md:py-20 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center lg:gap-16 lg:py-24">
          <section aria-labelledby="page-title" className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full bg-[#e5eddf] px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#41664d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6a9c70]" />
              Food spending, made clearer
            </p>

            <h1 id="page-title" className="mt-6 text-5xl font-semibold leading-[1.04] tracking-[-0.055em] text-[#203b30] sm:text-6xl lg:text-[4.25rem]">
              Know what your groceries really cost.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-[#617066] sm:text-lg sm:leading-8">
              Basketwise is being built to help households follow food spending, spot price changes, and make the next shop feel more predictable.
            </p>

            <div className="mt-9 flex flex-wrap gap-2.5" aria-label="Planned areas">
              {['Spending', 'Grocery prices', 'Pantry'].map((item) => (
                <span key={item} className="rounded-full border border-[#d6ded2] bg-white/60 px-3.5 py-2 text-sm text-[#56685d]">
                  {item}
                </span>
              ))}
            </div>

            <p className="mt-12 text-xs font-medium uppercase tracking-[0.15em] text-[#869188]">
              Built one useful step at a time
            </p>
          </section>

          <section aria-labelledby="connection-title" className="rounded-[2rem] bg-[#173e31] p-6 text-white shadow-[0_24px_70px_-36px_rgba(23,62,49,0.65)] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a8c5ad]">System check</p>
                <h2 id="connection-title" className="mt-2 text-2xl font-semibold tracking-tight">Backend connection</h2>
              </div>
              <div
                className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  isConnected ? 'bg-[#d7efdb] text-[#24523b]' : isChecking ? 'bg-[#f4e8bd] text-[#665629]' : 'bg-[#f7d9d2] text-[#713b31]'
                }`}
                aria-live="polite"
              >
                <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-[#3c875b]' : isChecking ? 'animate-pulse bg-[#b18a2f]' : 'bg-[#bd5b49]'}`} />
                {statusLabel}
              </div>
            </div>

            <p className="mt-5 min-h-12 text-sm leading-6 text-[#c3d4c7]" aria-live="polite">
              {isChecking && 'Checking the Basketwise API now.'}
              {isConnected && 'The API is responding and ready for the next build step.'}
              {connection.kind === 'error' && connection.message}
            </p>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-4 text-xs text-[#b7c9bb]">
                <span>Endpoint</span>
                <code className="rounded-md bg-black/10 px-2 py-1 font-mono text-[#edf4ed]">GET /api/health</code>
              </div>
              {isConnected && (
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-[#b7c9bb]">
                  <span>Last checked</span>
                  <time dateTime={connection.health.timestamp} className="text-[#edf4ed]">
                    {formatCheckedAt(connection.health.timestamp)}
                  </time>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setCheckNumber((current) => current + 1)}
              disabled={isChecking}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#e3eee1] px-4 py-3 text-sm font-semibold text-[#204735] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait disabled:opacity-70"
            >
              {isChecking ? 'Checking connection…' : connection.kind === 'error' ? 'Try again' : 'Check again'}
              {!isChecking && <span aria-hidden="true">↗</span>}
            </button>

            <p className="mt-4 text-center text-[11px] leading-5 text-[#9fb6a4]">
              This check confirms the API process is running. Database status will be added with the database step.
            </p>
          </section>
        </main>

        <footer className="flex flex-col gap-2 border-t border-[#d9e0d5] py-5 text-xs text-[#849087] sm:flex-row sm:items-center sm:justify-between">
          <span>Basketwise · A personal food cost system</span>
          <span>Local development preview</span>
        </footer>
      </div>
    </div>
  );
}
