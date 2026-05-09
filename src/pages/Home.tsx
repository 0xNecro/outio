import { useState } from 'react';
import TopAppBar from '../components/TopAppBar';
import BottomNavBar from '../components/BottomNavBar';
import SearchInput from '../components/SearchInput';
import FilterTags from '../components/FilterTags';
import DestinationCard from '../components/DestinationCard';
import { QUICK_TAGS, TODO_TAGS, type QuickTag } from '../lib/api';
import { useDestinations } from '../hooks/useDestinations';

export default function Home() {
  const [selected, setSelected] = useState<QuickTag[]>([]);

  const toggle = (t: string) =>
    setSelected((prev) => {
      const tag = t as QuickTag;
      return prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag];
    });

  const { data, loading, error } = useDestinations({
    city: '北京市',
    filters: selected,
  });

  return (
    <>
      <TopAppBar variant="home" />

      <main className="px-container_margin" style={{ paddingBottom: '88px' }}>
        <div style={{ paddingTop: '16px' }}>
          <SearchInput />
        </div>

        <p
          className="text-outline"
          style={{
            fontSize: '12px',
            letterSpacing: '0.02em',
            marginTop: '20px',
            marginBottom: '8px',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}
        >
          快捷标签
        </p>
        <FilterTags
          tags={QUICK_TAGS as unknown as string[]}
          selected={selected as string[]}
          onToggle={toggle}
        />

        <hr
          className="border-outline-variant"
          style={{ marginTop: '20px', marginBottom: '20px' }}
        />

        <div className="flex items-baseline justify-between">
          <h2
            className="text-on-surface"
            style={{
              fontSize: '18px',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            {loading
              ? '加载中…'
              : error
                ? '加载失败'
                : `为你推荐 ${data.length} 个目的地`}
          </h2>
          <button
            type="button"
            className="flex items-center gap-[2px] text-primary"
            style={{ fontSize: '12px', fontWeight: 500, letterSpacing: '0.02em' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px' }}
            >
              tune
            </span>
            筛选
          </button>
        </div>

        <p
          className="mt-xs text-secondary"
          style={{ fontSize: '12px', lineHeight: 1.4 }}
        >
          {selected.length
            ? `已应用 ${selected.length} 个筛选 · 北京市`
            : '北京市 · 景区/公园/博物馆等核心目的地，有简介者优先'}
        </p>

        {/* 占位标签提示：选中却未实现的筛选 */}
        {selected.some((t) => TODO_TAGS.includes(t)) && (
          <div
            className="mt-sm flex items-start gap-sm"
            style={{
              backgroundColor: 'var(--color-primary-fixed)',
              color: 'var(--color-primary)',
              borderRadius: '4px',
              padding: '10px 12px',
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px', marginTop: '1px' }}
            >
              schedule
            </span>
            <span>
              {selected
                .filter((t) => TODO_TAGS.includes(t))
                .map((t) => `「${t}」`)
                .join('、')}
              筛选即将上线，当前仍按默认列表展示。
            </span>
          </div>
        )}

        {/* 状态分支：加载 / 错误 / 空 / 列表 */}
        {loading && <Skeletons count={3} />}
        {error && (
          <ErrorBox message={error} hint="检查 .env 中 Supabase 配置或网络" />
        )}
        {!loading && !error && data.length === 0 && (
          <EmptyBox
            message={
              selected.length
                ? '当前筛选下没有匹配目的地'
                : '北京市暂无可显示数据'
            }
          />
        )}
        {!loading && !error && data.length > 0 && (
          <div
            className="flex flex-col"
            style={{ gap: '12px', marginTop: '16px' }}
          >
            {data.map((d) => (
              <DestinationCard key={d.id} destination={d} />
            ))}
          </div>
        )}
      </main>

      <BottomNavBar />
    </>
  );
}

function Skeletons({ count }: { count: number }) {
  return (
    <div className="flex flex-col" style={{ gap: '12px', marginTop: '16px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse"
          style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            border: '1px solid var(--color-card-border)',
            borderRadius: '4px',
            padding: '16px',
            height: '160px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-high)',
              height: '14px',
              width: '60%',
              borderRadius: '4px',
            }}
          />
          <div
            style={{
              backgroundColor: 'var(--color-surface-container)',
              height: '10px',
              width: '40%',
              borderRadius: '4px',
              marginTop: '12px',
            }}
          />
          <div
            style={{
              backgroundColor: 'var(--color-surface-container)',
              height: '10px',
              width: '90%',
              borderRadius: '4px',
              marginTop: '20px',
            }}
          />
        </div>
      ))}
    </div>
  );
}

function ErrorBox({ message, hint }: { message: string; hint?: string }) {
  return (
    <div
      className="mt-md"
      style={{
        backgroundColor: 'var(--color-error-container)',
        color: 'var(--color-on-error-container)',
        border: '1px solid var(--color-error-container)',
        borderRadius: '4px',
        padding: '12px',
        fontSize: '13px',
        lineHeight: 1.5,
      }}
    >
      <strong style={{ fontWeight: 500 }}>加载失败</strong>
      <p style={{ marginTop: '4px', fontSize: '12px' }}>{message}</p>
      {hint && <p style={{ marginTop: '4px', fontSize: '12px', opacity: 0.8 }}>{hint}</p>}
    </div>
  );
}

function EmptyBox({ message }: { message: string }) {
  return (
    <div
      className="mt-md flex flex-col items-center justify-center text-secondary"
      style={{
        backgroundColor: 'var(--color-surface-container-low)',
        borderRadius: '4px',
        padding: '32px 16px',
        fontSize: '13px',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: '32px', marginBottom: '8px' }}
      >
        explore_off
      </span>
      {message}
    </div>
  );
}
