import { useSearchParams } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import BottomNavBar from '../components/BottomNavBar';
import DestinationCardImage from '../components/DestinationCardImage';
import { useSearchResults } from '../hooks/useSearchResults';

// design.md 第 3 节：query bubble + AI 状态 + 结果 header + 图片卡片
// MVP 阶段用 name/description 模糊匹配代替 AI 精排，后续接 Edge Function
export default function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() || '';

  const { data, loading, error } = useSearchResults(query);
  const status: 'thinking' | 'done' | 'empty' | 'error' =
    loading
      ? 'thinking'
      : error
        ? 'error'
        : data.length === 0
          ? 'empty'
          : 'done';

  return (
    <>
      <TopAppBar variant="back" title="搜索结果" rightIcon="refresh" />

      <main className="px-container_margin" style={{ paddingBottom: '88px' }}>
        {/* 用户查询气泡 */}
        {query && (
          <div
            className="ml-auto"
            style={{
              marginTop: '16px',
              maxWidth: '85%',
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              borderRadius: '12px',
              padding: '12px 16px',
              fontSize: '14px',
              lineHeight: 1.5,
            }}
          >
            {query}
          </div>
        )}

        {/* 状态指示条 */}
        <div
          className="mt-md flex items-center gap-sm"
          style={{
            backgroundColor: 'var(--color-surface-container-low)',
            borderRadius: '12px',
            padding: '12px 16px',
            maxWidth: '85%',
          }}
        >
          <span
            className={`material-symbols-outlined text-primary ${status === 'thinking' ? 'animate-pulse' : ''}`}
            style={{ fontSize: '18px' }}
          >
            {status === 'thinking'
              ? 'auto_awesome'
              : status === 'error'
                ? 'error'
                : status === 'empty'
                  ? 'search_off'
                  : 'check_circle'}
          </span>
          <span
            className="text-on-surface-variant"
            style={{ fontSize: '13px' }}
          >
            {status === 'thinking' && '正在搜索匹配的目的地…'}
            {status === 'error' && (error ?? '搜索失败')}
            {status === 'empty' && '没有匹配的目的地，换个关键词试试'}
            {status === 'done' &&
              `从全国 POI 中匹配到 ${data.length} 个目的地（MVP 字符匹配，AI 精排稍后接入）`}
          </span>
        </div>

        {/* 响应 header */}
        {status === 'done' && (
          <div style={{ marginTop: '20px' }}>
            <h2
              className="text-on-surface"
              style={{
                fontSize: '18px',
                fontWeight: 500,
                lineHeight: 1.2,
                letterSpacing: '-0.01em',
              }}
            >
              为你找到 {data.length} 个目的地
            </h2>
            <p
              className="mt-xs text-secondary"
              style={{ fontSize: '12px', lineHeight: 1.4 }}
            >
              按 name / description 模糊匹配 · 仅含已 enrich 过的记录
            </p>
          </div>
        )}

        {/* 图片卡片列表 */}
        {status === 'done' && (
          <div
            className="flex flex-col"
            style={{ gap: '16px', marginTop: '16px' }}
          >
            {data.map((d) => (
              <DestinationCardImage key={d.id} destination={d} />
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex" style={{ gap: '8px', marginTop: '20px' }}>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-xs"
            style={{
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-surface-container)',
              color: 'var(--color-on-surface-variant)',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px' }}
            >
              refresh
            </span>
            换一批
          </button>
          <button
            type="button"
            className="flex flex-1 items-center justify-center gap-xs"
            style={{
              height: '40px',
              borderRadius: '12px',
              backgroundColor: 'var(--color-primary-fixed)',
              color: 'var(--color-primary)',
              fontSize: '13px',
              fontWeight: 500,
              letterSpacing: '0.02em',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '16px' }}
            >
              tune
            </span>
            细化条件
          </button>
        </div>
      </main>

      <BottomNavBar />
    </>
  );
}
