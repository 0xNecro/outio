import { useNavigate } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import BottomNavBar from '../components/BottomNavBar';
import SearchInput from '../components/SearchInput';
import FilterTags from '../components/FilterTags';
import DestinationCard from '../components/DestinationCard';
import { QUICK_TAGS } from '../lib/api';
import { useDestinations } from '../hooks/useDestinations';

// 快捷标签 → 自然语言查询（点击直接走 AI 搜索）
const TAG_TO_QUERY: Record<string, string> = {
  亲子: '适合带 18 个月小孩去的地方',
  周末: '周末适合家庭出游的地方',
  免费: '免费的家庭出游目的地',
  有山有水: '有山有水适合带孩子去',
  '1h 车程内': '从顺义出发 1 小时车程内的家庭目的地',
  室外: '适合带 18 个月孩子去的户外目的地',
};

export default function Home() {
  const navigate = useNavigate();

  const onTagClick = (t: string) => {
    const q = TAG_TO_QUERY[t] ?? t;
    navigate(`/search?q=${encodeURIComponent(q)}`);
  };

  // 默认以家坐标（后沙峪）为中心、按距离从近到远拉推荐
  const { data, loading, error } = useDestinations({});

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
          selected={[]}
          onToggle={onTagClick}
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
          以后沙峪为中心 · 距离由近到远
        </p>

        {/* 状态分支：加载 / 错误 / 空 / 列表 */}
        {loading && <Skeletons count={3} />}
        {error && (
          <ErrorBox message={error} hint="检查 .env 中 Supabase 配置或网络" />
        )}
        {!loading && !error && data.length === 0 && (
          <EmptyBox message="北京市暂无可显示数据" />
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
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            height: '160px',
          }}
        >
          <div
            style={{
              backgroundColor: 'var(--color-surface-container-high)',
              height: '14px',
              width: '60%',
              borderRadius: 'var(--radius-xl)',
            }}
          />
          <div
            style={{
              backgroundColor: 'var(--color-surface-container)',
              height: '10px',
              width: '40%',
              borderRadius: 'var(--radius-xl)',
              marginTop: '12px',
            }}
          />
          <div
            style={{
              backgroundColor: 'var(--color-surface-container)',
              height: '10px',
              width: '90%',
              borderRadius: 'var(--radius-xl)',
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
        borderRadius: 'var(--radius-lg)',
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
        borderRadius: 'var(--radius-lg)',
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
