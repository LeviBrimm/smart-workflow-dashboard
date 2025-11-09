import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useRunDetailQuery, useWorkflowRunsQuery, useCancelRunMutation } from '../api/queries.js';

const statusMeta = {
  success: { text: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Success', icon: '✔' },
  failed: { text: 'text-rose-700', bg: 'bg-rose-100', label: 'Failed', icon: '✖' },
  running: { text: 'text-amber-700', bg: 'bg-amber-100', label: 'Running', icon: '↻' },
  queued: { text: 'text-slate-600', bg: 'bg-slate-100', label: 'Queued', icon: '•' },
  canceled: { text: 'text-stone-600', bg: 'bg-stone-100', label: 'Canceled', icon: '–' },
};

const triggerMeta = {
  webhook: { text: 'text-[#5c3d2e]', bg: 'bg-[#f7ebe0]', icon: '🪝', label: 'Webhook' },
  schedule: { text: 'text-[#2d3e50]', bg: 'bg-[#e4e8ef]', icon: '⏱', label: 'Schedule' },
};

const formatDate = value => (value ? new Date(value).toLocaleString() : '—');
const formatDuration = ms => {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(0);
  return `${minutes}m ${remainder}s`;
};

const StatusPill = ({ status }) => {
  const meta = statusMeta[status] ?? { text: 'text-[#1f1c1a]', bg: 'bg-[#ece4d9]', label: status, icon: '•' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.text} ${meta.bg}`}>
      <span>{meta.icon}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
};

const TriggerBadge = ({ kind }) => {
  if (!kind) {
    return <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-stone-600">Unknown</span>;
  }
  const meta = triggerMeta[kind] ?? { text: 'text-stone-600', bg: 'bg-stone-100', icon: '⚙︎', label: kind };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${meta.text} ${meta.bg}`}>
      <span>{meta.icon}</span>
      <span className="capitalize">{meta.label}</span>
    </span>
  );
};

const StatCard = ({ label, value }) => (
  <div className="flex flex-col rounded-2xl border border-[#e3d8cb] bg-white/90 px-4 py-3 text-xs text-[#6b5b4b] shadow-sm shadow-[#d8c8ba] transition hover:-translate-y-0.5 hover:shadow-lg">
    <span className="uppercase tracking-wide">{label}</span>
    <span className="mt-1 text-lg font-semibold text-[#1d1a17]">{value}</span>
  </div>
);

const RunDetailPanel = ({ runId, onClose }) => {
  const { data, isLoading } = useRunDetailQuery(runId);
  const [expandedSteps, setExpandedSteps] = useState({});

  useEffect(() => {
    setExpandedSteps({});
  }, [runId]);

  if (!runId) return null;
  return (
    <aside className="sticky top-4 h-fit rounded-2xl border border-[#e0d4c6] bg-white/95 p-5 text-sm text-[#1f1c1a] shadow-2xl shadow-[#d5c5b7]/60">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7a6a5d]">Run Detail</p>
          <p className="font-mono text-sm text-[#1f1c1a]">{runId}</p>
        </div>
        <button className="text-xs text-[#7a6a5d] hover:text-[#1f1c1a]" onClick={onClose}>
          Close
        </button>
      </div>
      {isLoading && <p className="mt-4 text-[#7a6a5d]">Loading…</p>}
      {!isLoading && data?.run && (
        <>
          <div className="mt-4 grid gap-3 text-xs text-[#4a4038] sm:grid-cols-2">
            <div>
              <p className="text-[#938274]">Status</p>
              <StatusPill status={data.run.status} />
            </div>
            <div>
              <p className="text-[#938274]">Trigger</p>
              <div className="mt-1">
                <TriggerBadge kind={data.run.triggerKind} />
              </div>
            </div>
            <div>
              <p className="text-[#938274]">Started</p>
              <p>{formatDate(data.run.startedAt)}</p>
            </div>
            <div>
              <p className="text-[#938274]">Duration</p>
              <p>{formatDuration(data.run.durationMs)}</p>
            </div>
            {data.run.error && (
              <div className="sm:col-span-2">
                <p className="text-[#938274]">Run Error</p>
                <p className="font-mono text-rose-500">{data.run.error}</p>
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-[#938274]">Steps</p>
            <ol className="mt-2 border-l border-[#e4d7c8] pl-4 text-xs">
              {(data.steps ?? []).map(step => (
                <li key={step.id} className="relative mb-3 pl-2 last:mb-0">
                  <span className="absolute -left-[10px] mt-1 h-2.5 w-2.5 rounded-full bg-[#c08a5b] ring-2 ring-white" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">Step {step.stepIdx}</p>
                    <StatusPill status={step.status} />
                  </div>
                  <p className="mt-1 text-[#7a6a5d]">Duration: {formatDuration(step.durationMs)}</p>
                  {step.error && <p className="mt-1 font-mono text-rose-500">{step.error}</p>}
                  {step.output && (
                    <div className="mt-2">
                      <button
                        className="text-[11px] text-[#8c5a3c] hover:text-[#6a4229]"
                        onClick={() =>
                          setExpandedSteps(prev => ({
                            ...prev,
                            [step.id]: !prev[step.id],
                          }))
                        }
                      >
                        {expandedSteps[step.id] ? 'Hide payload' : 'View payload'}
                      </button>
                      {expandedSteps[step.id] && (
                        <pre className="mt-2 max-h-48 overflow-auto rounded bg-[#f7f1ea] p-2 text-[11px] text-[#44362d]">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </li>
              ))}
              {!data.steps?.length && <p className="text-slate-500">No step logs available.</p>}
            </ol>
          </div>
        </>
      )}
    </aside>
  );
};

const RunHistory = ({ workflowId, initialStatus = 'all' }) => {
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useWorkflowRunsQuery({
    workflowId,
    status: statusFilter,
  });

  const runs = useMemo(
    () => (data ? data.pages.flatMap(page => page.items ?? []) : []),
    [data]
  );

  const stats = useMemo(() => {
    const base = { success: 0, failed: 0, running: 0 };
    runs.forEach(run => {
      if (run.status in base) base[run.status] += 1;
    });
    return base;
  }, [runs]);

  const overviewCards = useMemo(() => {
    const total = runs.length;
    const successRate = total ? `${Math.round((stats.success / total) * 100)}%` : '0%';
    const lastRun = runs[0]?.startedAt ? formatDate(runs[0].startedAt) : '—';
    return [
      { label: 'Total Runs', value: total },
      { label: 'Success Rate', value: successRate },
      { label: 'Last Run', value: lastRun },
    ];
  }, [runs, stats.success]);

  const selectByIndex = useCallback(
    index => {
      if (index < 0 || index >= runs.length) return;
      setSelectedIndex(index);
      setSelectedRunId(runs[index].id);
    },
    [runs]
  );

  useEffect(() => {
    if (!selectedRunId && runs.length) {
      selectByIndex(0);
    } else if (selectedRunId) {
      const idx = runs.findIndex(run => run.id === selectedRunId);
      if (idx !== -1) setSelectedIndex(idx);
    }
  }, [runs, selectByIndex, selectedRunId]);

  useEffect(() => {
    const handleKey = event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        selectByIndex(selectedIndex + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        selectByIndex(selectedIndex - 1);
      } else if (event.key === 'Escape') {
        setSelectedRunId(null);
        setSelectedIndex(-1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectByIndex, selectedIndex]);

  const renderSkeletons = () => (
    <ul className="space-y-2 text-sm">
      {[...Array(3)].map((_, idx) => (
        <li key={idx} className="animate-pulse rounded border border-[#e6dbce] bg-white/70 px-3 py-3 shadow-sm">
          <div className="flex justify-between">
            <div className="h-4 w-16 rounded bg-[#efe5d7]" />
            <div className="h-4 w-24 rounded bg-[#efe5d7]" />
          </div>
          <div className="mt-2 h-3 w-32 rounded bg-[#f4ece1]" />
          <div className="mt-2 h-3 w-48 rounded bg-[#f4ece1]" />
        </li>
      ))}
    </ul>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e0d4c6] bg-white/70 px-6 py-8 text-center text-sm text-[#6b5b4b] shadow-inner">
      <span className="text-2xl">🛰️</span>
      <p>No runs yet. Trigger your workflow to see executions here.</p>
    </div>
  );

  return (
    <div className="card relative overflow-hidden bg-gradient-to-br from-white via-[#f9f6f1] to-[#f2e7dc] text-[#1f1c1a] shadow-xl shadow-[#d9cabc]/70">
      <div className="pointer-events-none absolute -top-16 right-0 h-48 w-48 rounded-full bg-[#d9c2af]/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-40 w-40 rounded-full bg-[#c4d4de]/40 blur-3xl" />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">Recent Runs</h3>
            <select
              className="rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="queued">Queued</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          {canCancelSelected && (
            <button
              className="rounded-full border border-[#d9cabc] px-3 py-1 text-xs font-medium text-[#5c3d2e] hover:bg-[#f4ece3] disabled:text-stone-400"
              onClick={handleCancelSelectedRun}
              disabled={cancelRunMutation.isPending}
            >
              {cancelRunMutation.isPending ? 'Canceling…' : 'Cancel run'}
            </button>
          )}
          {selectedRunId && (
            <button className="text-xs text-[#7a6a5d] hover:text-[#1f1c1a]" onClick={() => setSelectedRunId(null)}>
              Clear selection
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Success" value={stats.success} />
        <StatCard label="Failed" value={stats.failed} />
        <StatCard label="Running" value={stats.running} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {overviewCards.map(card => (
          <StatCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      {isLoading && renderSkeletons()}
      {!isLoading && (
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
          <div>
            {runs.length === 0 ? (
              renderEmptyState()
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {runs.map((run, index) => (
                    <li
                      key={run.id}
                      className={`cursor-pointer rounded-2xl border px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
                        run.id === selectedRunId
                          ? 'border-[#c0895a] bg-[#fdf8f3] shadow-lg shadow-[#e4cbb1]/60'
                          : 'border-[#e1d5c7] bg-white/80 hover:border-[#cdb7a3] hover:bg-white'
                      }`}
                      onClick={() => {
                        setSelectedRunId(run.id);
                        setSelectedIndex(index);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <StatusPill status={run.status} />
                        <span className="text-xs text-[#77675a]">{formatDate(run.startedAt)}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between text-xs text-[#7a6a5d]">
                        <TriggerBadge kind={run.triggerKind} />
                        <span>Duration: {formatDuration(run.durationMs)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#9a8a7d]">Run ID: {run.id}</p>
                    </li>
                  ))}
                </ul>
                {hasNextPage && (
                  <button
                    className="btn-secondary mt-3 w-full text-xs"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                  >
                    {isFetchingNextPage ? 'Loading…' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>
          <div>{selectedRunId ? <RunDetailPanel runId={selectedRunId} onClose={() => setSelectedRunId(null)} /> : null}</div>
        </div>
      )}
      </div>
    </div>
  );
};

export default RunHistory;
  const cancelRunMutation = useCancelRunMutation();
  const selectedRun = useMemo(() => runs.find(run => run.id === selectedRunId), [runs, selectedRunId]);
  const canCancelSelected = selectedRun && (selectedRun.status === 'queued' || selectedRun.status === 'running');

  const handleCancelSelectedRun = () => {
    if (!selectedRunId) return;
    cancelRunMutation.mutate(selectedRunId, {
      onSuccess: () => toast.success('Run canceled'),
      onError: () => toast.error('Unable to cancel run'),
    });
  };
