import { useNavigate } from 'react-router-dom';
import type { Destination } from '../lib/types';

interface DestinationCardImageProps {
  destination: Destination;
}

// design.md 2.5：带 hero 图的卡片（搜索结果用）
// MVP 阶段不用图片资源，用 hero_color 占位（design.md 第 6 节）
export default function DestinationCardImage({
  destination: d,
}: DestinationCardImageProps) {
  const navigate = useNavigate();
  const fillColor = d.hero_color ?? 'var(--color-surface-container-high)';

  return (
    <button
      type="button"
      onClick={() => navigate(`/detail/${d.id}`)}
      className="w-full overflow-hidden text-left transition-transform active:scale-[0.99]"
      style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        border: '1px solid var(--color-card-border)',
        borderRadius: '4px',
      }}
    >
      {/* Hero 占位区（h-48） */}
      <div
        className="relative flex items-end"
        style={{ height: '192px', backgroundColor: fillColor }}
      >
        {/* 角标叠层 */}
        {d.badge && (
          <span
            className="absolute"
            style={{
              top: '12px',
              left: '12px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              padding: '4px 10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255,255,255,0.92)',
              color: 'var(--color-on-surface)',
            }}
          >
            {d.badge}
          </span>
        )}
        {/* 类目水印 */}
        <div className="w-full px-md pb-sm">
          <span
            className="text-on-primary"
            style={{
              fontSize: '12px',
              letterSpacing: '0.02em',
              opacity: 0.85,
            }}
          >
            {d.main_category}
            {d.sub_category ? ` · ${d.sub_category}` : ''}
          </span>
        </div>
      </div>

      {/* 内容区 */}
      <div className="p-md">
        <h3
          className="text-on-surface"
          style={{
            fontSize: '18px',
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.01em',
          }}
        >
          {d.name}
        </h3>

        <div
          className="mt-xs flex items-center gap-xs text-secondary"
          style={{ fontSize: '12px', lineHeight: 1.4 }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '14px' }}
          >
            location_on
          </span>
          <span>{d.district ?? d.city}</span>
          {d.drive_minutes != null && (
            <>
              <span aria-hidden>·</span>
              <span>车程 {d.drive_minutes} 分钟</span>
            </>
          )}
          {d.rating != null && (
            <>
              <span aria-hidden>·</span>
              <span className="flex items-center gap-[2px] text-tertiary">
                <span
                  className="material-symbols-outlined filled"
                  style={{ fontSize: '14px' }}
                >
                  star
                </span>
                {d.rating.toFixed(1)}
              </span>
            </>
          )}
        </div>

        {d.ai_reason && (
          <div
            className="mt-sm"
            style={{
              borderLeft: '3px solid var(--color-primary)',
              paddingLeft: '12px',
            }}
          >
            <p
              className="italic text-on-surface-variant"
              style={{ fontSize: '14px', lineHeight: 1.5 }}
            >
              {d.ai_reason}
            </p>
          </div>
        )}
      </div>
    </button>
  );
}
