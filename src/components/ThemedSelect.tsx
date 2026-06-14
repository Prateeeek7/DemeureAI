import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
}

interface ThemedSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  id?: string;
}

export default function ThemedSelect({
  value,
  onChange,
  options,
  placeholder = 'Select option...',
  id,
}: ThemedSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedLabel = options.find(o => o.value === value)?.label ?? '';

  return (
    <div ref={ref} className="relative w-full font-mono text-xs" id={id}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`
          w-full flex items-center justify-between
          bg-warm-ivory border px-3 py-2.5
          text-left transition-colors duration-150
          ${open
            ? 'border-navy-accent ring-1 ring-navy-accent/20'
            : 'border-charcoal/15 hover:border-navy-accent/50'
          }
        `}
      >
        <span className={value ? 'text-charcoal font-medium' : 'text-slate-gray/60'}>
          {value ? selectedLabel : placeholder}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-gray transition-transform duration-200 flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="
          absolute z-50 top-full left-0 right-0 mt-0.5
          bg-surface-white border border-navy-accent/20
          shadow-[0_4px_24px_rgba(30,58,95,0.10)]
          overflow-hidden
        ">
          {/* Placeholder / reset row */}
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="
              w-full flex items-center gap-2 px-3 py-2.5
              text-left text-slate-gray/70 italic
              border-b border-charcoal/5
              hover:bg-warm-ivory transition-colors
            "
          >
            <Check className={`w-3.5 h-3.5 flex-shrink-0 ${!value ? 'text-navy-accent' : 'text-transparent'}`} />
            {placeholder}
          </button>

          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`
                w-full flex items-center gap-2 px-3 py-2.5
                text-left transition-colors duration-100
                ${value === opt.value
                  ? 'bg-navy-accent text-surface-white font-semibold'
                  : 'text-charcoal hover:bg-warm-ivory'
                }
              `}
            >
              <Check className={`w-3.5 h-3.5 flex-shrink-0 transition-opacity ${value === opt.value ? 'opacity-100 text-surface-white' : 'opacity-0'}`} />
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
