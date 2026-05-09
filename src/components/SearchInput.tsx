import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface SearchInputProps {
  // 详情/搜索结果页可以传入只读模式或回填值
  defaultValue?: string;
  placeholder?: string;
  onSubmit?: (value: string) => void;
}

// design.md 2.2：高度 48px，白底，border #DDDBD6，rounded-xl，focus 时 border-primary
export default function SearchInput({
  defaultValue = '',
  placeholder = '想去哪儿？带孩子周末去...',
  onSubmit,
}: SearchInputProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);

  const submit = () => {
    if (!value.trim()) return;
    if (onSubmit) onSubmit(value);
    else navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  return (
    <div
      className="flex items-center gap-sm bg-surface-container-lowest transition-colors"
      style={{
        height: '48px',
        borderRadius: '12px',
        border: `1px solid ${focused ? 'var(--color-primary)' : 'var(--color-card-border)'}`,
        padding: '0 16px',
      }}
    >
      <span
        className="material-symbols-outlined text-outline"
        style={{ fontSize: '20px' }}
      >
        search
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-on-surface placeholder:text-outline-variant focus:outline-none"
        style={{ fontSize: '14px', lineHeight: 1.5 }}
      />
      {value && (
        <button
          type="button"
          onClick={submit}
          className="text-primary"
          aria-label="发送"
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '20px' }}
          >
            arrow_forward
          </span>
        </button>
      )}
    </div>
  );
}
