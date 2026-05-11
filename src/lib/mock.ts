import type { UserProfile } from './types';

// Profile 页临时数据（待用户认证 + user_profiles 表后切真实）
export const mockProfile: UserProfile = {
  id: 'u1',
  family_members: [
    { name: '旺仔', role: 'child', birth_date: '2024-11-28' },
    { name: '爸爸', role: 'parent' },
    { name: '妈妈', role: 'parent' },
  ],
  home_city: '北京',
  home_address: '顺义区后沙峪',
  preferences: {
    max_drive_minutes: 90,
    prefers_outdoor: true,
    avoids: ['人多的室内'],
    car_type: 'electric',
    budget_sensitivity: 'medium',
  },
};
