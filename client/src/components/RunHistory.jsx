import { useMemo, useState } from 'react';
import { useRunDetailQuery, useWorkflowRunsQuery } from '../api/queries.js';

const statusColors = {
  success: 'text-emerald-400',
  failed: 'text-rose-400',
  running: 'text-amber-300',
  queued: 'text-slate-300',
  canceled: 'text-slate-400',
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

const RunDetailPanel = ({ runId, onClose }) => {
  const { data, isLoading } = useRunDetailQuery(runId);
  if (!runId) return null;
  return (
    <div className="rounded border border-slate-800/60 bg-slate-900/40 p-4 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Run Detail</p>
          <p className="text-base font-semibold text-white">{runId}</p>
        </div>
        <button className="text-xs text-slate-400 hover:text-white" onClick={onClose}>
          Close
        </button>
      </div>
      {isLoading && <p className="mt-4 text-slate-400">Loading…</p>}
      {!isLoading && data?.run && (
        <>
          <div className="mt-4 grid gap-3 text-xs text-slate-300 sm:grid-cols-2">
            <div>
              <p className="text-slate-500">Status</p>
              <p className={`font-medium capitalize ${statusColors[data.run.status] ?? 'text-white'}`}>{data.run.status}</p>
            </div>
            <div>
              <p className="text-slate-500">Trigger</p>
              <p className="font-medium">{data.run.triggerKind ?? '—'}</p>
            </div>
            <div>
              <p className="text-slate-500">Started</p>
              <p>{formatDate(data.run.startedAt)}</p>
            </div>
            <div>
              <p className="text-slate-500">Duration</p>
              <p>{formatDuration(data.run.durationMs)}</p>
            </div>
            {data.run.error && (
              <div className="sm:col-span-2">
                <p className="text-slate-500">Run Error</p>
                <p className="font-mono text-rose-300">{data.run.error}</p>
              </div>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Steps</p>
            <ol className="mt-2 space-y-2 text-xs">
              {(data.steps ?? []).map(step => (
                <li key={step.id} className="rounded border border-slate-800/70 p-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      Step {step.stepIdx}
                      <span className={`ml-2 font-medium capitalize ${statusColors[step.status] ?? 'text-white'}`}>
                        {step.status}
                      </span>
                    </p>
                    <p className="text-slate-400">{formatDuration(step.durationMs)}</p>
                  </div>
                  {step.error && <p className="mt-1 font-mono text-rose-300">{step.error}</p>}
                  {step.output && (
                    <pre className="mt-2 max-h-40 overflow-auto rounded bg-slate-950/40 p-2 text-[11px] text-slate-300">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  )}
                </li>
              ))}
              {!data.steps?.length && <p className="text-slate-500">No step logs available.</p>}
            </ol>
          </div>
        </>
      )}
    </div>
  );
};

const RunHistory = ({ workflowId, initialStatus = 'all' }) => {
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useWorkflowRunsQuery({
    workflowId,
    status: statusFilter,
  });

  const runs = useMemo(
    () => (data ? data.pages.flatMap(page => page.items ?? []) : []),
    [data]
  );

  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Recent Runs</h3>
          <select
            className="rounded border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
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
        {selectedRunId && (
          <button className="text-xs text-slate-400 hover:text-white" onClick={() => setSelectedRunId(null)}>
            Clear selection
          </button>
        )}
      </div>
      {isLoading && <p className="text-sm text-slate-400">Loading runs…</p>}
      {!isLoading && (
        <>
          <ul className="space-y-2 text-sm">
            {runs.map(run => (
              <li
                key={run.id}
                className={`cursor-pointer rounded border border-slate-800/80 px-3 py-2 transition hover:border-slate-600 ${
                  run.id === selectedRunId ? 'border-sky-500/60 bg-slate-900/40' : ''
                }`}
                onClick={() => setSelectedRunId(run.id)}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium capitalize ${statusColors[run.status] ?? 'text-white'}`}>{run.status}</span>
                  <span className="text-xs text-slate-400">{formatDate(run.startedAt)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between text-xs text-slate-400">
                  <span>Trigger: {run.triggerKind ?? '—'}</span>
                  <span>Duration: {formatDuration(run.durationMs)}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Run ID: {run.id}</p>
              </li>
            ))}
            {!runs.length && <p className="text-slate-500">No runs yet.</p>}
          </ul>
          {hasNextPage && (
            <button
              className="btn-secondary w-full text-xs"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
      {selectedRunId && <RunDetailPanel runId={selectedRunId} onClose={() => setSelectedRunId(null)} />}
    </div>
  );
};

export default RunHistory;
