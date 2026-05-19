import { GoogleLogin } from "@react-oauth/google";

import { loginWithGoogle } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function LoginButton() {
  const { user, login, logout } = useAuth();

  if (user) {
    return (
      <div className="flex items-center gap-3 ml-2">
        <span className="text-sm text-slate-600">
          {user.name}
          {user.is_authorized && (
            <span className="ml-2 inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
              管理員
            </span>
          )}
        </span>
        <button
          onClick={logout}
          className="text-sm text-slate-500 hover:text-slate-900 underline"
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="ml-2">
      <GoogleLogin
        onSuccess={async (credentialResponse) => {
          if (!credentialResponse.credential) return;
          try {
            const payload = await loginWithGoogle(credentialResponse.credential);
            login(payload);
          } catch (err) {
            console.error("Google login failed", err);
            alert("登入失敗：" + (err.response?.data?.detail || err.message));
          }
        }}
        onError={() => alert("Google 登入失敗")}
      />
    </div>
  );
}
