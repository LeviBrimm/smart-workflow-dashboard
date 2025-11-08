import { useScheduleTriggersQuery } from '../api/queries.js';

const formatDate = value => (value ? new Date(value).toLocaleString() : '—');

const ScheduleOverview = () => {
  const { data: schedules, isLoading } = useScheduleTriggersQuery();

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Scheduler</p>
          <h3 className="text-lg font-semibold">Upcoming triggers</h3>
        </div>
      </div>
      {isLoading && <p className="mt-4 text-sm text-slate-400">Loading schedules…</p>}
      {!isLoading && (
        <ul className="mt-4 space-y-3 text-sm">
          {schedules?.length ? (
            schedules.map(schedule => (
              <li key={schedule.id} className="rounded border border-slate-800/70 p-3">
                <p className="font-medium text-white">{schedule.workflowName}</p>
                <p className="text-xs text-slate-400">Cron: {schedule.cron ?? '—'}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-slate-400">
                  <span>Status: <span className="capitalize">{schedule.workflowStatus}</span></span>
                  <span>Next run: {formatDate(schedule.nextRunAt)}</span>
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-500">No schedule triggers yet.</p>
          )}
        </ul>
      )}
    </div>
  );
};

export default ScheduleOverview;
