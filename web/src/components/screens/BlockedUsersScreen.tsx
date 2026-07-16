import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHaptic } from '@/hooks/useHaptic';
import { useToastStore } from '@/components/shared/Toast';
import { apiGet, apiDelete, isErrorResult } from '@/lib/api';
import { Avatar } from '@/components/shared/Avatar';

type BlockedUser = {
  id: string;
  blocked_id: string;
  blocked_name: string;
  blocked_avatar: string | null;
  created_at: string;
};

export default function BlockedUsersScreen({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { impact } = useHaptic();
  const showToast = useToastStore((s) => s.showToast);
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  const load = async () => {
    const res = await apiGet<{ blocks: BlockedUser[] }>('/blocks');
    if ('data' in res && res.data) {
      setUsers(res.data.blocks ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const handleUnblock = async (userId: string) => {
    impact('medium');
    setUnblocking(userId);
    const res = await apiDelete(`/blocks/${userId}`);
    setUnblocking(null);
    if (isErrorResult(res)) {
      showToast(res.error, 'error');
      return;
    }
    setUsers((prev) => prev.filter((u) => u.blocked_id !== userId));
    showToast(t('blocks.unblocked_toast'), 'success');
  };

  return (
    <div className="min-h-screen bg-[#f4f4f6] flex flex-col">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100">
        <div className="flex items-center gap-3 px-5 h-14">
          <button onClick={onBack} className="text-sm font-semibold text-slate-500">{t('common.back')}</button>
          <h2 className="text-base font-bold text-slate-800">{t('blocks.title')}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-2">
        {loading && [0, 1].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-200" />
              <div className="flex-1"><div className="h-4 w-32 bg-slate-200 rounded" /></div>
            </div>
          </div>
        ))}

        {!loading && users.length === 0 && (
          <div className="text-center py-16">
            <span className="text-4xl block mb-3">🛡️</span>
            <p className="text-sm text-slate-400">{t('blocks.empty')}</p>
          </div>
        )}

        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-3">
            <Avatar size={40} name={u.blocked_name} src={u.blocked_avatar ?? undefined} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{u.blocked_name}</p>
              <p className="text-[11px] text-slate-400">{t('blocks.blocked_at')} {new Date(u.created_at).toLocaleDateString('ru-RU')}</p>
            </div>
            <button
              onClick={() => void handleUnblock(u.blocked_id)}
              disabled={unblocking === u.blocked_id}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {unblocking === u.blocked_id ? '...' : t('blocks.unblock')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
