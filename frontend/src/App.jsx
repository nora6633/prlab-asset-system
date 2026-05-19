import { Routes, Route, Link, NavLink } from "react-router-dom";

import AssetsPage from "./pages/AssetsPage.jsx";
import AssetDetailPage from "./pages/AssetDetailPage.jsx";
import BorrowPage from "./pages/BorrowPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import HealthPage from "./pages/HealthPage.jsx";
import LoginButton from "./components/LoginButton.jsx";
import { useAuth } from "./auth/AuthContext.jsx";

const navLinkClass = ({ isActive }) =>
  `px-3 py-2 rounded-md text-sm font-medium ${
    isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200"
  }`;

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg text-slate-900">
            PRLab 資產管理
          </Link>
          <nav className="flex items-center gap-2">
            <NavLink to="/" end className={navLinkClass}>
              資產列表
            </NavLink>
            {user && (
              <NavLink to="/borrow" className={navLinkClass}>
                我的租借
              </NavLink>
            )}
            {user?.is_authorized && (
              <NavLink to="/admin" className={navLinkClass}>
                管理
              </NavLink>
            )}
            <LoginButton />
          </nav>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<AssetsPage />} />
          <Route path="/assets/:id" element={<AssetDetailPage />} />
          <Route path="/borrow" element={<BorrowPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/health" element={<HealthPage />} />
        </Routes>
      </main>
    </div>
  );
}
