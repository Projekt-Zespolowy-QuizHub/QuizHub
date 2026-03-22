'use client';

interface TabConfig<T extends string> {
  key: T;
  label: string;
}

interface Props<T extends string> {
  tabs: readonly TabConfig<T>[];
  active: T;
  onChange: (key: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="flex gap-2">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            active === t.key
              ? 'bg-yellow-400 text-black'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
