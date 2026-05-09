interface AISummaryCardProps {
  text: string;
  // 可选标题，默认 "为什么推荐给你"
  title?: string;
}

// design.md 2.6：AI 卡片，primary-container bg(#534ab7)，浅色文字
export default function AISummaryCard({
  text,
  title = '为什么推荐给你',
}: AISummaryCardProps) {
  return (
    <section
      className="relative overflow-hidden text-on-primary-container"
      style={{
        backgroundColor: 'var(--color-primary-container)',
        borderRadius: '4px',
        padding: '20px',
      }}
    >
      {/* 装饰图标 */}
      <span
        className="material-symbols-outlined absolute pointer-events-none"
        style={{
          right: '-8px',
          bottom: '-12px',
          fontSize: '120px',
          color: 'rgba(255,255,255,0.08)',
        }}
        aria-hidden
      >
        auto_awesome
      </span>

      <div className="relative flex items-center gap-sm">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '20px', color: 'var(--color-on-primary-container)' }}
        >
          smart_toy
        </span>
        <h4
          className="text-on-primary"
          style={{
            fontSize: '14px',
            fontWeight: 500,
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </h4>
      </div>
      <p
        className="relative mt-sm text-on-primary"
        style={{ fontSize: '14px', lineHeight: 1.6 }}
      >
        {text}
      </p>
    </section>
  );
}
