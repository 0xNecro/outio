import type { Destination } from '../lib/types';

interface FacilityGridProps {
  destination: Destination;
}

interface Facility {
  icon: string;
  label: string;
  available: boolean;
}

// design.md 2.6：3 列 grid，每格 icon + 标签 + 状态
export default function FacilityGrid({ destination: d }: FacilityGridProps) {
  const items: Facility[] = [
    { icon: 'local_parking', label: '停车场', available: !!d.has_parking },
    { icon: 'ev_station', label: '充电桩', available: !!d.has_ev_charging },
    { icon: 'stroller', label: '婴儿车', available: !!d.stroller_ok },
    { icon: 'accessible', label: '无障碍', available: !!d.wheelchair_ok },
    {
      icon: 'confirmation_number',
      label: d.ticket_price === 0 ? '免费' : `¥${d.ticket_price ?? '—'}`,
      available: d.ticket_price === 0,
    },
    { icon: 'child_care', label: '亲子', available: !!d.child_friendly },
  ];

  return (
    <div className="grid grid-cols-3" style={{ gap: '8px' }}>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex flex-col items-center justify-center"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-card-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '12px 8px',
            minHeight: '80px',
          }}
        >
          <span
            className={`material-symbols-outlined ${it.available ? '' : 'opacity-40'}`}
            style={{
              fontSize: '24px',
              color: it.available
                ? 'var(--color-primary)'
                : 'var(--color-outline)',
            }}
          >
            {it.icon}
          </span>
          <span
            className="mt-xs text-on-surface-variant"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            {it.label}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: it.available ? 'var(--color-primary)' : 'var(--color-outline)',
              marginTop: '2px',
            }}
          >
            {it.available ? '可用' : '无'}
          </span>
        </div>
      ))}
    </div>
  );
}
