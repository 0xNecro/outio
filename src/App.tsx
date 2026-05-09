import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Detail from './pages/Detail';
import SearchResults from './pages/SearchResults';
import Profile from './pages/Profile';

export default function App() {
  return (
    // 移动端容器：448px 居中（design.md 第 5 节）。
    // 不能用 max-w-md：Tailwind v4 中 max-w-md 读 --spacing-md (=16px)。
    <div className="mx-auto min-h-dvh w-full max-w-[28rem] bg-[var(--color-page-bg)]">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/detail/:id" element={<Detail />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
