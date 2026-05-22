interface AISummaryCardProps {
  text: string;
  // 可选标题，默认 "为什么推荐给你"
  title?: string;
}

// design.md 5.5：AI 卡片与目的地卡片同样式，不加特殊装饰
export default function AISummaryCard({
  text,
  title = '为什么推荐给你',
}: AISummaryCardProps) {
  return (
    <section
      className="text-on-surface"
      style={{
        backgroundColor: 'var(--color-card-bg)',
        border: '1px solid var(--color-card-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
      }}
    >
      <div className="flex items-center gap-sm">
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '20px', color: 'var(--color-primary)' }}
        >
          smart_toy
        </span>
        <h4
          className="text-on-surface"
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
        className="mt-sm text-on-surface-variant"
        style={{ fontSize: '14px', lineHeight: 1.6 }}
      >
        {text}
      </p>
    </section>
  );
}
