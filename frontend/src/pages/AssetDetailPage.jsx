import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createBorrow, fetchAsset } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function AssetDetailPage() {
  const { id } = useParams();
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();

  const { data: asset, isLoading } = useQuery({
    queryKey: ["asset", id],
    queryFn: () => fetchAsset(id),
  });

  const borrowMutation = useMutation({
    mutationFn: () => createBorrow({ asset_id: Number(id) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asset", id] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      alert("已送出租借申請");
    },
    onError: (err) => alert("租借失敗：" + (err.response?.data?.detail || err.message)),
  });

  if (isLoading) return <p className="text-slate-500">載入中…</p>;
  if (!asset) return <p className="text-red-600">找不到資產</p>;

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">{asset.name}</h1>
      <p className="text-slate-500 mb-4 font-mono">{asset.asset_no}</p>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="text-slate-500">別名</dt>
        <dd>{asset.alias || "—"}</dd>
        <dt className="text-slate-500">廠牌型別</dt>
        <dd>{asset.model || "—"}</dd>
        <dt className="text-slate-500">存置地點</dt>
        <dd>{asset.location || "—"}</dd>
        <dt className="text-slate-500">數量</dt>
        <dd>{asset.quantity}</dd>
        <dt className="text-slate-500">狀態</dt>
        <dd>{asset.status}</dd>
        <dt className="text-slate-500">備註</dt>
        <dd className="whitespace-pre-wrap">{asset.note || "—"}</dd>
      </dl>

      <div className="mt-6">
        {!isLoggedIn && <p className="text-slate-500 text-sm">請先登入才能租借</p>}
        {isLoggedIn && asset.status === "available" && (
          <button
            onClick={() => borrowMutation.mutate()}
            disabled={borrowMutation.isPending}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded font-medium disabled:opacity-60"
          >
            {borrowMutation.isPending ? "送出中…" : "申請租借"}
          </button>
        )}
        {isLoggedIn && asset.status !== "available" && (
          <p className="text-slate-500 text-sm">目前狀態為「{asset.status}」，無法租借</p>
        )}
      </div>
    </div>
  );
}
