import { useState } from 'react';
import { Trophy, Award, CheckCircle2, Crown, Medal } from 'lucide-react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useCollection';
import { PageHeader, Spinner, Avatar, EmptyState } from '../components/shared/ui';

type Period = '' | 'week' | 'month';

interface LeaderRow {
  id: string;
  display_name: string;
  avatar_color: string;
  total_points: number;
  earned: number;
  chores_done: number;
}

const PODIUM_TINT: Record<number, string> = {
  0: 'from-amber-100 to-amber-50 ring-amber-300',
  1: 'from-gray-100 to-gray-50 ring-gray-300',
  2: 'from-orange-100 to-orange-50 ring-orange-300',
};

const MEDAL_COLOR: Record<number, string> = {
  0: 'text-amber-500',
  1: 'text-gray-400',
  2: 'text-orange-500',
};

export default function Leaderboard() {
  const [period, setPeriod] = useState<Period>('');
  const { data: rows, loading } = useAsync(() => api.leaderboard(period) as Promise<LeaderRow[]>, [period]);

  const list = rows || [];
  const top3 = list.slice(0, 3);
  // Podium display order: 2nd, 1st (taller, center), 3rd.
  const podiumOrder = [top3[1], top3[0], top3[2]].map((row, idx) => ({
    row,
    rank: [1, 0, 2][idx],
  }));

  const periodOptions: { value: Period; label: string }[] = [
    { value: '', label: 'All time' },
    { value: 'week', label: 'This week' },
    { value: 'month', label: 'This month' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Leaderboard"
        subtitle="Who's been earning the most points"
        icon={Trophy}
        actions={
          <div className="inline-flex bg-gray-100 rounded-xl p-1 text-sm">
            {periodOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => setPeriod(o.value)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${period === o.value ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        }
      />

      {loading && !rows ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={Trophy} title="No scores yet" message="Complete chores to start climbing the leaderboard." />
      ) : (
        <>
          {/* Podium */}
          <div className="card p-6">
            <div className="flex items-end justify-center gap-3 sm:gap-6">
              {podiumOrder.map(({ row, rank }) => {
                if (!row) return <div key={rank} className="flex-1 max-w-[8rem]" />;
                const isFirst = rank === 0;
                const heights: Record<number, string> = { 0: 'h-28', 1: 'h-20', 2: 'h-16' };
                return (
                  <div key={row.id} className="flex flex-col items-center flex-1 max-w-[9rem] min-w-0">
                    <div className="relative mb-2">
                      <Avatar user={row} size={isFirst ? 72 : 56} ring />
                      {isFirst && <Crown size={22} className="text-amber-500 absolute -top-4 left-1/2 -translate-x-1/2" />}
                    </div>
                    <div className="font-semibold text-gray-900 text-sm truncate max-w-full text-center">{row.display_name}</div>
                    <div className="text-xs text-amber-600 font-bold mb-2">{row.earned} pts</div>
                    <div
                      className={`w-full ${heights[rank]} rounded-t-2xl bg-gradient-to-t ring-1 flex items-start justify-center pt-2 ${PODIUM_TINT[rank]}`}
                    >
                      <span className={`font-extrabold text-lg ${MEDAL_COLOR[rank]}`}>#{rank + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Full ranking */}
          <div className="space-y-2">
            {list.map((row, i) => (
              <div key={row.id} className={`card p-3 flex items-center gap-3 ${i < 3 ? 'ring-1 ring-gray-100' : ''}`}>
                <span className="w-8 flex-shrink-0 flex items-center justify-center">
                  {i < 3 ? (
                    <Medal size={20} className={MEDAL_COLOR[i]} />
                  ) : (
                    <span className="text-sm font-bold text-gray-400">{i + 1}</span>
                  )}
                </span>
                <Avatar user={row} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-900 truncate">{row.display_name}</div>
                  <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
                    <span className="inline-flex items-center gap-1"><CheckCircle2 size={12} /> {row.chores_done} chores</span>
                    <span className="inline-flex items-center gap-1"><Award size={12} /> {row.total_points} total</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-amber-600">{row.earned}</div>
                  <div className="text-[11px] text-gray-400 uppercase tracking-wide">pts</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
