import { SleepTimer } from 'baby-tracker';

// Elapsed since ~1h 23m ago, so the static capture shows a real running duration.
const startAt = new Date(Date.now() - (1 * 3600 + 23 * 60 + 12) * 1000).toISOString();

export const Running = () => (
  <div className="p-8">
    <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-100">
      <span className="text-2xl leading-none">💤</span>
      <div className="flex flex-col">
        <span className="text-[11px] text-indigo-300/80">Sleeping</span>
        <span className="font-mono text-2xl tabular-nums tracking-tight">
          <SleepTimer startAt={startAt} />
        </span>
      </div>
    </div>
  </div>
);

export const Zeroed = () => (
  <div className="p-8">
    <span className="font-mono text-2xl tabular-nums text-slate-300">
      <SleepTimer />
    </span>
  </div>
);
