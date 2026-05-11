import { useSearchParams } from 'react-router-dom';
import TopAppBar from '../components/TopAppBar';
import BottomNavBar from '../components/BottomNavBar';
import DestinationCardImage from '../components/DestinationCardImage';
import { useSearchResults, type SearchStage } from '../hooks/useSearchResults';

// design.md 第 3 节：query bubble + AI 状态 + 结果 header + 图片卡片
// AI 流程：意图解析 → 候选查询 → 精排打理由 → 展示
export default function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get('q')?.trim() || '';

  const { data, stage, error, fallback } = useSearchResults(query);

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

        {/* AI 阶段指示 */}
        <StageIndicator stage={stage} error={error} count={data.length} fallback={fallback} />

        {/* 响应 header */}
        {stage === 'done' && (
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
              {fallback
                ? '简单匹配 · AI 服务暂时不可用'
                : 'AI 已结合你的家庭画像精选并给出推荐理由'}
            </p>
          </div>
        )}

        {/* 图片卡片列表 */}
        {stage === 'done' && (
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
        {stage === 'done' && (
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
        )}
      </main>

      <BottomNavBar />
    </>
  );
}

function StageIndicator({
  stage,
  error,
  count,
  fallback,
}: {
  stage: SearchStage;
  error: string | null;
  count: number;
  fallback: boolean;
}) {
  const thinking = stage === 'parsing' || stage === 'querying' || stage === 'ranking';
  const icon =
    stage === 'error'
      ? 'error'
      : stage === 'empty'
        ? 'search_off'
        : thinking
          ? 'auto_awesome'
          : 'check_circle';
  const text =
    stage === 'parsing'
      ? '正在理解你的需求…'
      : stage === 'querying'
        ? '正在从 31 万条数据中筛选…'
        : stage === 'ranking'
          ? '正在为你精选推荐…'
          : stage === 'error'
            ? error ?? '搜索失败'
            : stage === 'empty'
              ? '没有匹配的目的地，换个关键词试试'
              : fallback
                ? `AI 服务异常，已用简单匹配返回 ${count} 个结果`
                : `已完成精选，共 ${count} 个目的地`;

  return (
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
        className={`material-symbols-outlined text-primary ${thinking ? 'animate-pulse' : ''}`}
        style={{ fontSize: '18px' }}
      >
        {icon}
      </span>
      <span
        className="text-on-surface-variant"
        style={{ fontSize: '13px', lineHeight: 1.4 }}
      >
        {text}
      </span>
    </div>
  );
}
