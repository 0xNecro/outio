import { useNavigate, useParams } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import AISummaryCard from '../components/AISummaryCard';
import FacilityGrid from '../components/FacilityGrid';
import { useDestination } from '../hooks/useDestination';

// design.md 2.6 + 第 3 节
export default function Detail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: d, loading, error } = useDestination(id);

  if (loading) {
    return (
      <>
        <TopAppBar variant="back" title="加载中…" rightIcon={null} />
        <main className="px-container_margin" style={{ paddingTop: '24px' }}>
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-surface-container-high)',
              height: '224px',
              borderRadius: '4px',
            }}
          />
          <div
            className="animate-pulse"
            style={{
              backgroundColor: 'var(--color-surface-container)',
              height: '14px',
              width: '70%',
              borderRadius: '4px',
              marginTop: '20px',
            }}
          />
        </main>
      </>
    );
  }

  if (error || !d) {
    return (
      <>
        <TopAppBar variant="back" title="未找到" rightIcon={null} />
        <main
          className="px-container_margin flex flex-col items-center justify-center"
          style={{ paddingTop: '64px', color: 'var(--color-secondary)' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '40px', marginBottom: '12px' }}
          >
            explore_off
          </span>
          <p style={{ fontSize: '14px' }}>
            {error ?? '该目的地不存在或已被移除'}
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <TopAppBar
        variant="back"
        title={d.name}
        rightIcon="bookmark"
        onRight={() => {}}
      />

      <main style={{ paddingBottom: '96px' }}>
        {/* Hero：4 列 grid，主图 col-span-4 h-56；下方两个缩略 col-span-2 h-24 */}
        <section
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '0 16px',
            marginTop: '8px',
          }}
        >
          <div
            style={{
              gridColumn: 'span 4',
              height: '224px',
              backgroundColor: d.hero_color ?? 'var(--color-surface-container-high)',
              borderRadius: '4px',
            }}
          />
          <div
            style={{
              gridColumn: 'span 2',
              height: '96px',
              backgroundColor: 'var(--color-surface-container-high)',
              borderRadius: '4px',
            }}
          />
          <div
            style={{
              gridColumn: 'span 2',
              height: '96px',
              backgroundColor: 'var(--color-surface-container)',
              borderRadius: '4px',
            }}
          />
        </section>

        {/* 信息卡：icon + label + value，分隔细线 */}
        <section className="px-container_margin" style={{ marginTop: '20px' }}>
          <div
            className="bg-surface-container-lowest"
            style={{
              border: '1px solid var(--color-card-border)',
              borderRadius: '4px',
              padding: '4px 16px',
            }}
          >
            <InfoRow icon="location_on" label="位置" value={`${d.city} · ${d.district ?? ''} ${d.address ?? ''}`} />
            <InfoRow icon="near_me" label="车程" value={d.drive_minutes ? `约 ${d.drive_minutes} 分钟（自驾）` : '—'} />
            <InfoRow
              icon="confirmation_number"
              label="门票"
              value={d.ticket_price === 0 ? '免费' : d.ticket_price ? `¥${d.ticket_price} / 成人` : '—'}
            />
            <InfoRow icon="schedule" label="建议时长" value="2–4 小时" />
            <InfoRow
              icon="star"
              label="综合评分"
              value={d.rating ? `${d.rating.toFixed(1)} / 5.0` : '—'}
              valueColor="var(--color-tertiary)"
            />
          </div>
        </section>

        {/* 标签：横向滚动；首个为主标签（紫底），其余灰底 */}
        <section style={{ marginTop: '20px' }}>
          <div
            className="no-scrollbar flex overflow-x-auto px-container_margin"
            style={{ gap: '8px' }}
          >
            <Tag primary>{d.main_category}</Tag>
            {d.tags?.map((t) => (
              <Tag key={t}>{t}</Tag>
            ))}
            {d.suitable_for?.map((s) => (
              <Tag key={s}>适合 {s}</Tag>
            ))}
          </div>
        </section>

        {/* AI 推荐卡 */}
        {d.ai_reason && (
          <section className="px-container_margin" style={{ marginTop: '20px' }}>
            <AISummaryCard text={d.ai_reason} />
          </section>
        )}

        {/* 描述 */}
        {d.description && (
          <section className="px-container_margin" style={{ marginTop: '20px' }}>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
                color: 'var(--color-on-surface)',
              }}
            >
              简介
            </h3>
            <p
              className="mt-sm text-on-surface-variant"
              style={{ fontSize: '14px', lineHeight: 1.6 }}
            >
              {d.description}
            </p>
            {d.tips && (
              <div
                className="mt-sm flex items-start gap-sm"
                style={{
                  backgroundColor: 'var(--color-surface-container-low)',
                  borderRadius: '4px',
                  padding: '12px',
                }}
              >
                <span
                  className="material-symbols-outlined text-tertiary"
                  style={{ fontSize: '18px' }}
                >
                  info
                </span>
                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--color-on-surface-variant)',
                  }}
                >
                  {d.tips}
                </p>
              </div>
            )}
          </section>
        )}

        {/* 设施 */}
        <section className="px-container_margin" style={{ marginTop: '24px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: 'var(--color-on-surface)',
              marginBottom: '12px',
            }}
          >
            设施
          </h3>
          <FacilityGrid destination={d} />
        </section>

        {/* 地图占位 */}
        <section className="px-container_margin" style={{ marginTop: '24px' }}>
          <h3
            style={{
              fontSize: '16px',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
              color: 'var(--color-on-surface)',
              marginBottom: '12px',
            }}
          >
            位置
          </h3>
          <div
            className="flex items-center justify-center"
            style={{
              height: '160px',
              backgroundColor: 'var(--color-surface-container)',
              border: '1px solid var(--color-card-border)',
              borderRadius: '4px',
              color: 'var(--color-outline)',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '32px', marginRight: '8px' }}
            >
              map
            </span>
            <span style={{ fontSize: '12px', letterSpacing: '0.02em' }}>
              地图（高德 SDK 接入后可用）
            </span>
          </div>
        </section>
      </main>

      {/* 底部固定操作栏：次按钮 + 主按钮 */}
      <footer
        className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[28rem] border-t border-outline-variant bg-surface-container-lowest safe-bottom"
        style={{ padding: '12px 16px', display: 'flex', gap: '8px' }}
      >
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex flex-1 items-center justify-center gap-xs"
          style={{
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-surface-container)',
            color: 'var(--color-on-surface-variant)',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px' }}
          >
            check_circle
          </span>
          标记去过
        </button>
        <button
          type="button"
          className="flex flex-1 items-center justify-center gap-xs"
          style={{
            height: '44px',
            borderRadius: '12px',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-on-primary)',
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '18px' }}
          >
            near_me
          </span>
          导航
        </button>
      </footer>
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '14px 0',
        borderBottom: '1px solid var(--color-surface-container)',
      }}
    >
      <div className="flex items-center gap-sm">
        <span
          className="material-symbols-outlined text-secondary"
          style={{ fontSize: '18px' }}
        >
          {icon}
        </span>
        <span
          className="text-on-surface-variant"
          style={{ fontSize: '13px', letterSpacing: '0.02em' }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: '14px',
          color: valueColor ?? 'var(--color-on-surface)',
          fontWeight: 500,
          maxWidth: '60%',
          textAlign: 'right',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function Tag({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <span
      className="whitespace-nowrap"
      style={{
        padding: '4px 12px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        backgroundColor: primary
          ? 'var(--color-tag-selected-bg)'
          : 'var(--color-tag-neutral-bg)',
        color: primary
          ? 'var(--color-tag-selected-text)'
          : 'var(--color-tag-neutral-text)',
      }}
    >
      {children}
    </span>
  );
}
