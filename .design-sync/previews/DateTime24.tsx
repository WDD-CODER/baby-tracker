import { useState } from 'react';
import { DateTime24 } from 'baby-tracker';

export const Default = () => {
  const [value, setValue] = useState('2026-07-05T14:30');
  return (
    <div className="p-8 w-80">
      <label className="block text-slate-300 text-sm mb-2">When did it happen?</label>
      <DateTime24 value={value} onChange={setValue} />
    </div>
  );
};
