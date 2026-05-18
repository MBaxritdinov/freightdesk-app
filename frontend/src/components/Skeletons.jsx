export function StatCardSkeleton() {
  return (
    <div className="relative bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 bg-slate-800/60 animate-pulse" />
      <div className="p-6 pt-5">
        <div className="h-2 bg-slate-800/60 animate-pulse rounded w-24 mb-3" />
        <div className="h-8 bg-slate-800/60 animate-pulse rounded w-14 mb-2" />
        <div className="h-2 bg-slate-800/60 animate-pulse rounded w-32 mt-2" />
      </div>
    </div>
  )
}

const ROW_WIDTHS = ['w-16', 'w-28', 'w-20', 'w-32', 'w-24', 'w-12', 'w-20', 'w-10', 'w-8', 'w-8', 'w-16']

export function TableRowSkeleton({ cols = 6 }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-3.5">
          <div className={`h-3 bg-slate-800/60 animate-pulse rounded ${ROW_WIDTHS[i % ROW_WIDTHS.length]}`} />
        </td>
      ))}
    </tr>
  )
}

export function LoadDetailSkeleton() {
  return (
    <div className="space-y-5">
      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
        <div className="flex items-center">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-slate-800/60 animate-pulse" />
                <div className="h-2.5 w-14 bg-slate-800/60 animate-pulse rounded" />
              </div>
              {i < 4 && <div className="flex-1 h-px mx-3 mb-7 bg-slate-800/60 animate-pulse" />}
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
        <div className="h-2.5 w-24 bg-slate-800/60 animate-pulse rounded mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
          {['w-24','w-32','w-20','w-28','w-20','w-24','w-16','w-28','w-20'].map((w, i) => (
            <div key={i}>
              <div className="h-2 w-16 bg-slate-800/60 animate-pulse rounded mb-1.5" />
              <div className={`h-4 bg-slate-800/60 animate-pulse rounded ${w}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-slate-900 ring-1 ring-white/8 rounded-xl shadow-lg p-6">
        <div className="h-2.5 w-16 bg-slate-800/60 animate-pulse rounded mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-2 w-16 bg-slate-800/60 animate-pulse rounded mb-1.5" />
              <div className="h-4 w-20 bg-slate-800/60 animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
