import { NavLink, useLocation } from 'react-router-dom';

// design.md 2.8：高度 64px，固定底部，4 tabs，标签英文
const tabs = [
  { to: '/', icon: 'explore', label: 'Discover' },
  { to: '/saved', icon: 'bookmark', label: 'Saved' },
  { to: '/history', icon: 'history', label: 'History' },
  { to: '/profile', icon: 'person', label: 'Profile' },
];

export default function BottomNavBar() {
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[28rem] border-t border-outline-variant bg-surface safe-bottom"
      style={{ height: '64px' }}
    >
      <ul className="flex h-full items-stretch">
        {tabs.map((t) => {
          const active =
            t.to === '/' ? pathname === '/' : pathname.startsWith(t.to);
          return (
            <li key={t.to} className="flex-1">
              <NavLink
                to={t.to}
                className={`flex h-full flex-col items-center justify-center gap-[2px] ${
                  active ? 'text-primary' : 'text-secondary'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${active ? 'filled' : ''}`}
                  style={{ fontSize: '22px' }}
                >
                  {t.icon}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    lineHeight: 1.2,
                    letterSpacing: '0.02em',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {t.label}
                </span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
