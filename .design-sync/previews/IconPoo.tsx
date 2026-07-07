import { IconPoo } from 'baby-tracker';

// fill maps to the POO_GLYPH_FILL classification colors (mustard / green / brown).
const colors = [
  { fill: '#E8B923', label: 'Mustard' },
  { fill: '#2D8A4E', label: 'Green' },
  { fill: '#8B5A2B', label: 'Brown' },
];

export const Colors = () => (
  <div className="p-8 flex items-center gap-7">
    {colors.map((c) => (
      <div key={c.fill} className="flex flex-col items-center gap-2">
        <IconPoo fill={c.fill} className="w-11 h-11" />
        <span className="text-slate-300 text-xs">{c.label}</span>
      </div>
    ))}
  </div>
);
