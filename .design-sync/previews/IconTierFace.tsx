import { IconTierFace } from 'baby-tracker';

const tiers = [
  { tier: 'BAD', label: 'Bad', border: '#E5484D' },
  { tier: 'OKAY', label: 'Okay', border: '#F5A623' },
  { tier: 'GOOD', label: 'Good', border: '#46A758' },
  { tier: 'GREAT', label: 'Great', border: '#30A46C' },
] as const;

export const AllTiers = () => (
  <div className="p-8 flex items-center gap-6">
    {tiers.map((t) => (
      <div key={t.tier} className="flex flex-col items-center gap-2">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-950 border-2"
          style={{ borderColor: t.border }}
        >
          <IconTierFace tier={t.tier} className="w-9 h-9" />
        </div>
        <span className="text-slate-300 text-xs">{t.label}</span>
      </div>
    ))}
  </div>
);

export const Inline = () => (
  <div className="p-8 flex items-center gap-3 text-slate-100 text-sm">
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center bg-slate-950 border-2 shrink-0"
      style={{ borderColor: '#30A46C' }}
    >
      <IconTierFace tier="GREAT" className="w-5 h-5" />
    </div>
    <span>Excellent sleep cycle logged</span>
  </div>
);
