interface FilterTagsProps {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}

// design.md 2.3：横向滚动 + 隐藏滚动条；px 16 py 4，rounded-full，gap 8
export default function FilterTags({ tags, selected, onToggle }: FilterTagsProps) {
  return (
    <div
      className="no-scrollbar -mx-container_margin flex overflow-x-auto px-container_margin"
      style={{ gap: '8px' }}
    >
      {tags.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            type="button"
            key={tag}
            onClick={() => onToggle(tag)}
            className="whitespace-nowrap transition-colors"
            style={{
              padding: '4px 16px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.02em',
              backgroundColor: active
                ? 'var(--color-tag-selected-bg)'
                : 'var(--color-tag-neutral-bg)',
              color: active
                ? 'var(--color-tag-selected-text)'
                : 'var(--color-tag-neutral-text)',
              border: `1px solid ${active ? 'rgba(83,74,183,0.1)' : 'transparent'}`,
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
