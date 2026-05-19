import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetchBorrowRecords, markReturned } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

export default function BorrowPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["borrow-records"],
    queryFn: fetchBorrowRecords,
    enabled: Boolean(user),
  });

  const returnMutation = useMutation({
    mutationFn: (id) => markReturned(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["borrow-records"] });
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });

  if (!user) return <p className="text-slate-500">請先登入</p>;
  if (isLoading) return <p className="text-slate-500">載入中…</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 mb-4">
        {user.is_authorized ? "所有租借紀錄" : "我的租借紀錄"}
      </h1>
      <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2 text-left">編號</th>
              <th className="px-4 py-2 text-left">資產 ID</th>
              <th className="px-4 py-2 text-left">借用人</th>
              <th className="px-4 py-2 text-left">借出</th>
              <th className="px-4 py-2 text-left">應還</th>
              <th className="px-4 py-2 text-left">歸還</th>
              {user.is_authorized && <th className="px-4 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {data?.map((rec) => (
              <tr key={rec.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{rec.id}</td>
                <td className="px-4 py-2">{rec.asset_id}</td>
                <td className="px-4 py-2">
                  {rec.borrower_name}
                  <div className="text-xs text-slate-500">{rec.borrower_email}</div>
                </td>
                <td className="px-4 py-2">{new Date(rec.borrowed_at).toLocaleString()}</td>
                <td className="px-4 py-2">
                  {rec.due_at ? new Date(rec.due_at).toLocaleString() : "—"}
                </td>
                <td className="px-4 py-2">
                  {rec.returned_at
                    ? new Date(rec.returned_at).toLocaleString()
                    : <span className="text-amber-600">未歸還</span>}
                </td>
                {user.is_authorized && (
                  <td className="px-4 py-2">
                    {!rec.returned_at && (
                      <button
                        onClick={() => returnMutation.mutate(rec.id)}
                        className="text-sky-700 hover:underline text-sm"
                      >
                        標記歸還
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
