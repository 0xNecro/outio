import { useState } from 'react';
import TopAppBar from '../components/TopAppBar';
import BottomNavBar from '../components/BottomNavBar';
import { mockProfile } from '../lib/mock';

// design.md 2.7 + 第 3 节
export default function Profile() {
  const p = mockProfile;
  const [outdoor, setOutdoor] = useState(p.preferences.prefers_outdoor);
  const [maxMin, setMaxMin] = useState(p.preferences.max_drive_minutes);

  return (
    <>
      <TopAppBar variant="back" title="个人资料" rightIcon={null} />

      <main className="px-container_margin" style={{ paddingBottom: '96px' }}>
        {/* 头像区 */}
        <section
          className="flex flex-col items-center"
          style={{ paddingTop: '24px' }}
        >
          <div
            className="flex items-center justify-center bg-primary-fixed text-primary"
            style={{
              width: '96px',
              height: '96px',
              borderRadius: '9999px',
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '40px' }}
            >
              person
            </span>
          </div>
          <h2
            className="mt-md text-on-surface"
            style={{
              fontSize: '18px',
              fontWeight: 500,
              letterSpacing: '-0.01em',
            }}
          >
            旺仔家
          </h2>
          <p
            className="mt-xs text-secondary"
            style={{ fontSize: '12px', letterSpacing: '0.02em' }}
          >
            woody.wdd@gmail.com
          </p>
        </section>

        {/* 家庭成员卡片 */}
        <Card title="家庭成员" rightAction={{ icon: 'edit', label: '编辑' }}>
          {p.family_members.map((m, i) => (
            <Row
              key={m.name}
              isLast={i === p.family_members.length - 1}
              icon={
                m.role === 'child'
                  ? 'child_care'
                  : m.role === 'grandparent'
                    ? 'elderly'
                    : 'person'
              }
              label={m.name}
              sub={
                m.role === 'child' && m.birth_date
                  ? `${ageFromBirth(m.birth_date)} · ${roleLabel(m.role)}`
                  : roleLabel(m.role)
              }
            />
          ))}
        </Card>

        {/* 常驻地卡片 */}
        <Card title="常驻地">
          <Row
            icon="location_on"
            label={p.home_city}
            sub={p.home_address}
            isLast
          />
        </Card>

        {/* 偏好卡片：toggle + slider */}
        <Card title="偏好设置">
          <div
            className="flex items-center justify-between"
            style={{ padding: '14px 0' }}
          >
            <div className="flex items-center gap-sm">
              <span
                className="material-symbols-outlined text-secondary"
                style={{ fontSize: '18px' }}
              >
                landscape
              </span>
              <span
                className="text-on-surface"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                优先户外目的地
              </span>
            </div>
            <Toggle on={outdoor} onChange={setOutdoor} />
          </div>

          <div
            className="border-t"
            style={{
              borderColor: 'var(--color-surface-container)',
              padding: '14px 0',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontSize: '18px' }}
                >
                  schedule
                </span>
                <span
                  className="text-on-surface"
                  style={{ fontSize: '14px', fontWeight: 500 }}
                >
                  最长车程
                </span>
              </div>
              <span
                className="text-primary"
                style={{ fontSize: '14px', fontWeight: 500 }}
              >
                {maxMin} 分钟
              </span>
            </div>
            <Slider value={maxMin} min={30} max={180} onChange={setMaxMin} />
          </div>

          <Row
            isLast
            icon="electric_car"
            label="车型"
            sub={p.preferences.car_type === 'electric' ? '纯电（需快充）' : '燃油'}
            chevron
          />
        </Card>

        {/* About / Logout */}
        <Card>
          <Row icon="info" label="关于 Outio" sub="v0.1 MVP" chevron />
          <Row
            isLast
            icon="logout"
            label="退出登录"
            danger
          />
        </Card>
      </main>

      <BottomNavBar />
    </>
  );
}

function Card({
  title,
  rightAction,
  children,
}: {
  title?: string;
  rightAction?: { icon: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: '20px' }}>
      {title && (
        <div className="flex items-center justify-between" style={{ marginBottom: '8px' }}>
          <h3
            className="text-outline"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </h3>
          {rightAction && (
            <button
              type="button"
              className="flex items-center gap-[2px] text-primary"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.02em',
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '14px' }}
              >
                {rightAction.icon}
              </span>
              {rightAction.label}
            </button>
          )}
        </div>
      )}
      <div
        style={{
          backgroundColor: 'var(--color-surface-container-lowest)',
          border: '1px solid var(--color-card-border)',
          borderRadius: '4px',
          padding: '0 16px',
        }}
      >
        {children}
      </div>
    </section>
  );
}

function Row({
  icon,
  label,
  sub,
  chevron,
  danger,
  isLast,
}: {
  icon: string;
  label: string;
  sub?: string;
  chevron?: boolean;
  danger?: boolean;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        padding: '14px 0',
        borderBottom: isLast ? 'none' : '1px solid var(--color-surface-container)',
      }}
    >
      <div className="flex items-center gap-sm">
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: '20px',
            color: danger ? 'var(--color-error)' : 'var(--color-secondary)',
          }}
        >
          {icon}
        </span>
        <div>
          <p
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: danger ? 'var(--color-error)' : 'var(--color-on-surface)',
            }}
          >
            {label}
          </p>
          {sub && (
            <p
              className="text-secondary"
              style={{ fontSize: '12px', lineHeight: 1.4, marginTop: '2px' }}
            >
              {sub}
            </p>
          )}
        </div>
      </div>
      {chevron && (
        <span
          className="material-symbols-outlined text-outline"
          style={{ fontSize: '20px' }}
        >
          chevron_right
        </span>
      )}
    </div>
  );
}

function Toggle({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  // design.md 2.7：44x24，开启时 primary
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="relative transition-colors"
      style={{
        width: '44px',
        height: '24px',
        borderRadius: '12px',
        backgroundColor: on ? 'var(--color-primary)' : 'var(--color-surface-container-high)',
      }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[2px] bg-surface-container-lowest transition-transform"
        style={{
          left: '2px',
          width: '20px',
          height: '20px',
          borderRadius: '9999px',
          transform: on ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  );
}

function Slider({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  // design.md 2.7：track 4px，thumb 16px primary
  return (
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full appearance-none bg-transparent"
      style={{ marginTop: '12px', height: '16px' }}
    />
  );
}

function ageFromBirth(birth: string): string {
  const b = new Date(birth);
  const now = new Date('2026-05-09');
  const months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (months < 24) return `${months} 个月`;
  const years = Math.floor(months / 12);
  return `${years} 岁`;
}

function roleLabel(role: string): string {
  return (
    {
      parent: '父母',
      child: '孩子',
      grandparent: '祖辈',
      partner: '伴侣',
    } as Record<string, string>
  )[role] ?? role;
}
