import { useNavigate } from 'react-router-dom';

interface TopAppBarProps {
  // 默认模式：显示 logo + 标题；返回模式：显示返回箭头 + 标题
  variant?: 'home' | 'back';
  title?: string;
  // 右侧 action：默认 settings；详情/搜索结果可隐藏或自定义
  rightIcon?: string | null;
  onRight?: () => void;
}

// design.md 2.1：高度 56px，sticky，bg surface，border-bottom outline-variant
export default function TopAppBar({
  variant = 'home',
  title = 'Outio',
  rightIcon = 'settings',
  onRight,
}: TopAppBarProps) {
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-50 h-14 border-b border-outline-variant bg-surface"
      style={{ height: '56px' }}
    >
      <div className="flex h-full items-center justify-between px-container_margin">
        {variant === 'home' ? (
          <div className="flex items-center gap-sm">
            {/* 32x32 logo（深色底，白色 explore 图标） */}
            <div
              className="flex items-center justify-center bg-on-surface text-on-primary"
              style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-xl)' }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '20px' }}
              >
                explore
              </span>
            </div>
            <span
              className="font-sans font-bold text-primary"
              style={{ fontSize: '18px', letterSpacing: '-0.01em' }}
            >
              {title}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-sm">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex items-center justify-center text-on-surface"
              style={{ width: '40px', height: '40px', marginLeft: '-8px' }}
              aria-label="返回"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span
              className="font-sans text-on-surface"
              style={{
                fontSize: '18px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {title}
            </span>
          </div>
        )}

        {rightIcon && (
          <button
            type="button"
            onClick={
              onRight ??
              (() => {
                if (variant === 'home') navigate('/profile');
                else navigate(-1);
              })
            }
            className="flex items-center justify-center text-on-surface-variant"
            style={{ width: '40px', height: '40px' }}
            aria-label={rightIcon}
          >
            <span className="material-symbols-outlined">{rightIcon}</span>
          </button>
        )}
      </div>
    </header>
  );
}
