import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addAuthorizedUser,
  createAsset,
  deleteAsset,
  fetchAssets,
  fetchAuthorizedUsers,
  removeAuthorizedUser,
} from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";

const emptyAsset = {
  asset_no: "",
  name: "",
  alias: "",
  model: "",
  location: "",
  quantity: 1,
  note: "",
};

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newAsset, setNewAsset] = useState(emptyAsset);
  const [newEmail, setNewEmail] = useState("");

  const assetsQuery = useQuery({ queryKey: ["assets"], queryFn: fetchAssets });
  const authQuery = useQuery({
    queryKey: ["authorized-users"],
    queryFn: fetchAuthorizedUsers,
    enabled: Boolean(user?.is_authorized),
  });

  const createMutation = useMutation({
    mutationFn: createAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      setNewAsset(emptyAsset);
    },
    onError: (err) => alert("新增失敗：" + (err.response?.data?.detail || err.message)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });

  const addUserMutation = useMutation({
    mutationFn: (email) => addAuthorizedUser(email),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authorized-users"] });
      setNewEmail("");
    },
    onError: (err) => alert("新增失敗：" + (err.response?.data?.detail || err.message)),
  });

  const removeUserMutation = useMutation({
    mutationFn: removeAuthorizedUser,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["authorized-users"] }),
  });

  if (!user?.is_authorized) {
    return <p className="text-red-600">沒有權限</p>;
  }

  return (
    <div className="space-y-8">
      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">新增資產</h2>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              ...newAsset,
              quantity: Number(newAsset.quantity) || 1,
            });
          }}
        >
          {[
            ["asset_no", "財產編號 *"],
            ["name", "名稱 *"],
            ["alias", "別名"],
            ["model", "廠牌型別"],
            ["location", "存置地點"],
            ["quantity", "數量"],
          ].map(([key, label]) => (
            <label key={key} className="text-sm">
              <span className="block text-slate-600 mb-1">{label}</span>
              <input
                value={newAsset[key]}
                onChange={(e) => setNewAsset({ ...newAsset, [key]: e.target.value })}
                className="w-full border border-slate-300 rounded px-2 py-1"
                required={["asset_no", "name"].includes(key)}
              />
            </label>
          ))}
          <label className="text-sm col-span-2">
            <span className="block text-slate-600 mb-1">備註</span>
            <textarea
              value={newAsset.note}
              onChange={(e) => setNewAsset({ ...newAsset, note: e.target.value })}
              className="w-full border border-slate-300 rounded px-2 py-1"
              rows={2}
            />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="col-span-2 bg-sky-600 hover:bg-sky-700 text-white rounded py-2 font-medium disabled:opacity-60"
          >
            {createMutation.isPending ? "新增中…" : "新增資產"}
          </button>
        </form>
      </section>

      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">資產一覽</h2>
        <ul className="divide-y divide-slate-100">
          {assetsQuery.data?.map((asset) => (
            <li key={asset.id} className="flex justify-between py-2 text-sm">
              <div>
                <span className="font-mono">{asset.asset_no}</span>
                <span className="ml-3 text-slate-700">{asset.name}</span>
                <span className="ml-3 text-slate-500">{asset.status}</span>
              </div>
              <button
                onClick={() => {
                  if (confirm(`刪除資產 ${asset.asset_no}？`)) deleteMutation.mutate(asset.id);
                }}
                className="text-red-600 hover:underline"
              >
                刪除
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-bold mb-4">授權使用者</h2>
        <form
          className="flex gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (newEmail) addUserMutation.mutate(newEmail);
          }}
        >
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 border border-slate-300 rounded px-3 py-2"
          />
          <button
            type="submit"
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded font-medium"
          >
            新增
          </button>
        </form>
        <ul className="divide-y divide-slate-100">
          {authQuery.data?.map((u) => (
            <li key={u.id} className="flex justify-between py-2 text-sm">
              <div>
                <span>{u.email}</span>
                <span className="ml-3 text-slate-500">by {u.added_by}</span>
              </div>
              <button
                onClick={() => {
                  if (confirm(`移除 ${u.email} 的授權？`)) removeUserMutation.mutate(u.id);
                }}
                className="text-red-600 hover:underline"
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
