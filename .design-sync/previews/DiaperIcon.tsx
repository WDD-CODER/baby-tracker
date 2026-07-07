import { DiaperIcon } from 'baby-tracker';

export const Default = () => (
  <div className="p-8 flex items-center gap-3 text-teal-400">
    <DiaperIcon className="w-10 h-10" />
    <span className="text-slate-200 text-sm">Diaper change</span>
  </div>
);

export const Sizes = () => (
  <div className="p-8 flex items-end gap-5 text-teal-400">
    <DiaperIcon className="w-5 h-5" />
    <DiaperIcon className="w-8 h-8" />
    <DiaperIcon className="w-12 h-12" strokeWidth={1.5} />
  </div>
);
