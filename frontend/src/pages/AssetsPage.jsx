import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchAssets } from "../api/client.js";

const statusBadge = {
  available: "bg-emerald-100 text-emerald-700",
  borrowed: "bg-amber-100 text-amber-700",
  retired: "bg-slate-200 text-slate-600",
};

const statusLabel = {
  available: "可借用",
  borrowed: "已借出",
  retired: "已停用",
};

export default function AssetsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["assets"],
    queryFn: fetchAssets,
  });

  if (isLoading) return <p className="text-slate-500">載入中…</p>;
  if (error) return <p className="text-red-600">載入失敗：{error.message}</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">資產列表</h1>
      <div className="overflow-x-auto bg-white rounded-lg shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">財產編號</th>
              <th className="px-4 py-2 text-left">名稱</th>
              <th className="px-4 py-2 text-left">型號 / 別名</th>
              <th className="px-4 py-2 text-left">存置地點</th>
              <th className="px-4 py-2 text-left">數量</th>
              <th className="px-4 py-2 text-left">狀態</th>
              <th className="px-4 py-2 text-left">借用者</th>
            </tr>
          </thead>
          <tbody>
            {data?.map((asset) => (
              <tr key={asset.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2 font-mono">
                  <Link to={`/assets/${asset.id}`} className="text-sky-700 hover:underline">
                    {asset.asset_no}
                  </Link>
                </td>
                <td className="px-4 py-2">{asset.name}</td>
                <td className="px-4 py-2 text-slate-600">
                  {[asset.model, asset.alias].filter(Boolean).join(" / ") || "—"}
                </td>
                <td className="px-4 py-2 text-slate-600">{asset.location || "—"}</td>
                <td className="px-4 py-2">{asset.quantity}</td>
                <td className="px-4 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      statusBadge[asset.status] || "bg-slate-100"
                    }`}
                  >
                    {statusLabel[asset.status] || asset.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {asset.current_borrower || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
