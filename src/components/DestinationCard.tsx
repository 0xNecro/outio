import { useNavigate } from 'react-router-dom';
import type { Destination } from '../lib/types';

interface DestinationCardProps {
  destination: Destination;
}

// design.md 2.4：纯文字+图标卡片（首页用）
// 白底 + card-border + rounded-lg(4px) + p-md(16px)
export default function DestinationCard({ destination: d }: DestinationCardProps) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate(`/detail/${d.id}`)}
      className="w-full text-left transition-transform active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        border: '1px solid var(--color-card-border)',
        borderRadius: '4px',
        padding: '16px',
      }}
    >
      {/* Row 1: 名称 + badge */}
      <div className="flex items-start justify-between gap-sm">
        <h3
          className="text-on-surface"
          style={{
            fontSize: '16px',
            fontWeight: 500,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}
        >
          {d.name}
        </h3>
        {d.badge && (
          <span
            className="shrink-0"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              padding: '2px 8px',
              borderRadius: '8px',
              backgroundColor: 'var(--color-secondary-container)',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            {d.badge}
          </span>
        )}
      </div>

      {/* Row 2: 位置 + 车程 */}
      <div
        className="mt-xs flex items-center gap-xs text-secondary"
        style={{ fontSize: '12px', lineHeight: 1.4 }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
          location_on
        </span>
        <span>{d.district ?? d.city}</span>
        {d.drive_minutes != null && (
          <>
            <span aria-hidden>·</span>
            <span>车程 {d.drive_minutes} 分钟</span>
          </>
        )}
      </div>

      {/* Row 3: 评分 + 季节 + 室内外 */}
      <div className="mt-sm flex flex-wrap items-center" style={{ gap: '8px' }}>
        {d.rating != null && (
          <span className="flex items-center gap-[2px] text-tertiary">
            <span
              className="material-symbols-outlined filled"
              style={{ fontSize: '14px' }}
            >
              star
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              {d.rating.toFixed(1)}
            </span>
          </span>
        )}
        {d.best_season?.[0] && (
          <Pill>当季 · {d.best_season.join('/')}</Pill>
        )}
        {d.indoor_outdoor && (
          <Pill>{d.indoor_outdoor === 'outdoor' ? '户外' : d.indoor_outdoor === 'indoor' ? '室内' : '户外/室内'}</Pill>
        )}
        {d.ticket_price === 0 && <Pill>免费</Pill>}
      </div>

      {/* Row 4: AI 推荐理由（带分割线） */}
      {d.ai_reason && (
        <div
          className="mt-md flex items-start gap-sm border-t border-outline-variant"
          style={{ paddingTop: '12px' }}
        >
          <div
            className="mt-[2px] flex shrink-0 items-center justify-center bg-primary-fixed text-primary"
            style={{ width: '24px', height: '24px', borderRadius: '12px' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              auto_awesome
            </span>
          </div>
          <p
            className="italic text-on-surface-variant"
            style={{ fontSize: '14px', lineHeight: 1.5 }}
          >
            {d.ai_reason}
          </p>
        </div>
      )}
    </button>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: 'var(--color-surface-container)',
        color: 'var(--color-on-surface-variant)',
      }}
    >
      {children}
    </span>
  );
}
