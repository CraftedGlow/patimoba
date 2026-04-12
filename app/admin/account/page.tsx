"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  FileText,
  Shield,
  Key,
  Bell,
  Save,
  Loader2,
  Check,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const notificationSettings = [
  {
    id: "churn",
    label: "解約リスク通知",
    description: "解約リスク店舗が検出された時",
    defaultChecked: true,
  },
  {
    id: "newStore",
    label: "新規加盟通知",
    description: "新しい店舗が加盟した時",
    defaultChecked: true,
  },
  {
    id: "mrr",
    label: "MRR目標達成通知",
    description: "月次目標を達成した時",
    defaultChecked: true,
  },
  {
    id: "weekly",
    label: "週次レポート",
    description: "毎週月曜日に送信",
    defaultChecked: false,
  },
  {
    id: "monthly",
    label: "月次レポート",
    description: "毎月1日に送信",
    defaultChecked: true,
  },
];

type AdminProfile = {
  id: string | null;
  authUserId: string | null;
  name: string;
  email: string;
  phone: string;
  department: string;
  company: string;
  notificationSettings: Record<string, boolean>;
};

async function fetchAdminProfile(): Promise<AdminProfile | null> {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData.user;

  let query = supabase.from("users").select("*").eq("user_type", "admin").limit(1);
  if (authUser) {
    query = supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUser.id)
      .eq("user_type", "admin")
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    authUserId: data.auth_user_id,
    name: data.name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    department: "",
    company: "",
    notificationSettings: {},
  };
}

export default function AdminAccountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [company, setCompany] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);

  const [notifications, setNotifications] = useState<Record<string, boolean>>(
    Object.fromEntries(
      notificationSettings.map((n) => [n.id, n.defaultChecked])
    )
  );

  const loadProfile = useCallback(async () => {
    try {
      const profile = await fetchAdminProfile();
      if (profile) {
        setProfileId(profile.id);
        setName(profile.name);
        setEmail(profile.email);
        setPhone(profile.phone);
        setDepartment(profile.department);
        setCompany(profile.company);
        setHasPassword(!!profile.authUserId);
        setIsNew(false);
        if (Object.keys(profile.notificationSettings).length > 0) {
          setNotifications((prev) => ({ ...prev, ...profile.notificationSettings }));
        }
      } else {
        setIsNew(true);
      }
    } catch {
      setIsNew(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) {
      setError("氏名は必須です");
      return;
    }
    if (!email.trim()) {
      setError("メールアドレスは必須です");
      return;
    }

    if (isNew) {
      if (!newPassword.trim()) {
        setError("新規登録時はパスワードの設定が必須です");
        return;
      }
      if (newPassword !== confirmPassword) {
        setError("パスワードが一致しません");
        return;
      }
      if (newPassword.length < 6) {
        setError("パスワードは6文字以上で設定してください");
        return;
      }
    }

    setSaving(true);
    setError(null);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const basePayload = {
        name,
        email: cleanEmail,
        phone: phone || null,
        department: department || null,
        company_name: company || null,
        notification_settings: notifications,
      };

      if (isNew) {
        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password: newPassword }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || "認証ユーザーの作成に失敗しました");
        const authUserId = result.userId;
        if (!authUserId) throw new Error("認証ユーザーの作成に失敗しました");

        const { data: created, error: err } = await supabase
          .from("users")
          .insert({
            name: basePayload.name,
            email: basePayload.email,
            phone: basePayload.phone,
            auth_user_id: authUserId,
            user_type: "admin",
          })
          .select()
          .single();
        if (err) throw err;
        if (created) {
          setProfileId(created.id);
          setIsNew(false);
          setHasPassword(true);
          setNewPassword("");
          setConfirmPassword("");
        }
      } else if (profileId) {
        const { error: err } = await supabase
          .from("users")
          .update({
            name: basePayload.name,
            email: basePayload.email,
            phone: basePayload.phone,
          })
          .eq("id", profileId);
        if (err) throw err;
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordSaving) return;
    setPasswordError(null);

    if (!newPassword.trim()) {
      setPasswordError("新しいパスワードを入力してください");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("パスワードは6文字以上で設定してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("新しいパスワードが一致しません");
      return;
    }
    if (!profileId) {
      setPasswordError("先にアカウントを登録してください");
      return;
    }

    setPasswordSaving(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (err) throw err;

      setHasPassword(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2500);
    } catch (e) {
      setPasswordError(e instanceof Error ? e.message : "パスワード変更に失敗しました");
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <header className="bg-[#FFF9C4] px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">アカウント設定</h1>
          <p className="text-xs text-gray-600">
            {isNew ? "管理者アカウントを新規登録" : "プロフィールと設定の管理"}
          </p>
        </div>
        {isNew && (
          <span className="flex items-center gap-1.5 bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full">
            <UserPlus className="w-3.5 h-3.5" />
            新規登録モード
          </span>
        )}
      </header>

      <div className="p-6 space-y-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold">プロフィール情報</h2>
            {isNew && (
              <span className="text-xs text-amber-600 ml-2">* 必須項目があります</span>
            )}
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full border-2 border-amber-400 bg-amber-50 flex items-center justify-center">
              <User className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">{name || "管理者アカウント"}</h3>
                <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  管理者
                </span>
              </div>
              <p className="text-sm text-gray-500">{company || "未設定"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                氏名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@craftedglow.jp"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                電話番号
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03-1234-5678"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">
                部署
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="営業本部"
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1.5">
                会社名
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Crafted Glow Inc."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
              />
            </div>

            {isNew && (
              <>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    パスワード <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="パスワードを設定"
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5">
                    パスワード（確認） <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="もう一度入力"
                      className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Shield className="w-5 h-5 text-gray-500" />
              <h2 className="font-bold">セキュリティ設定</h2>
            </div>

            <div className="space-y-4">
              {!hasPassword && !isNew && (
                <p className="text-sm text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  認証情報が未設定です。ログインに必要なパスワードを設定してください。
                </p>
              )}
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  新しいパスワード
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="新しいパスワードを入力"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1.5">
                  新しいパスワード（確認）
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="もう一度入力"
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                  />
                </div>
              </div>
              <AnimatePresence>
                {passwordError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-sm text-red-500"
                  >
                    {passwordError}
                  </motion.p>
                )}
              </AnimatePresence>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  setNewPassword(currentPassword);
                  handleChangePassword();
                }}
                disabled={passwordSaving || isNew}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                パスワードを変更
              </motion.button>
              {isNew && (
                <p className="text-xs text-gray-400 text-center">
                  先にアカウントを登録してからパスワードを変更できます
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-6">
              <Bell className="w-5 h-5 text-gray-500" />
              <h2 className="font-bold">通知設定</h2>
            </div>

            <div className="space-y-4">
              {notificationSettings.map((setting) => (
                <label
                  key={setting.id}
                  className="flex items-start justify-between cursor-pointer group"
                >
                  <div>
                    <p className="text-sm font-bold">{setting.label}</p>
                    <p className="text-xs text-gray-500">
                      {setting.description}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={notifications[setting.id]}
                    onChange={(e) =>
                      setNotifications((prev) => ({
                        ...prev,
                        [setting.id]: e.target.checked,
                      }))
                    }
                    className="w-5 h-5 accent-blue-600 rounded mt-0.5 cursor-pointer"
                  />
                </label>
              ))}
            </div>
          </motion.div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm"
          >
            {error}
          </motion.div>
        )}

        <div className="flex items-center justify-end gap-3 pb-4">
          <button
            onClick={() => loadProfile()}
            className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-amber-400 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isNew ? (
              <UserPlus className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "保存中..." : isNew ? "管理者を登録" : "変更を保存"}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            {isNew ? "管理者アカウントを登録しました" : "変更を保存しました"}
          </motion.div>
        )}
        {passwordSaved && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50"
          >
            <Check className="w-4 h-4" />
            パスワードを変更しました
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
