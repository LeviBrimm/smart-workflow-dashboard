import { useScheduleTriggersQuery } from '../api/queries.js';

const formatDate = value => (value ? new Date(value).toLocaleString() : '—');

const ScheduleOverview = () => {
  const { data: schedules, isLoading } = useScheduleTriggersQuery();

  return (
    <div className="card bg-white text-[#1f1c1a]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-[#7a6a5d]">Scheduler</p>
          <h3 className="text-lg font-semibold">Upcoming triggers</h3>
        </div>
      </div>
      {isLoading && <p className="mt-4 text-sm text-[#7a6a5d]">Loading schedules…</p>}
      {!isLoading && (
        <ul className="mt-4 space-y-3 text-sm">
          {schedules?.length ? (
            schedules.map(schedule => (
              <li key={schedule.id} className="rounded-2xl border border-[#e0d4c6] bg-white/80 p-3">
                <p className="font-medium text-[#1f1c1a]">{schedule.workflowName}</p>
                <p className="text-xs text-[#7a6a5d]">Cron: {schedule.cron ?? '—'}</p>
                <div className="mt-2 flex flex-wrap items-center justify-between text-xs text-[#7a6a5d]">
                  <span>
                    Status: <span className="capitalize">{schedule.workflowStatus}</span>
                  </span>
                  <span>Next run: {formatDate(schedule.nextRunAt)}</span>
                </div>
              </li>
            ))
          ) : (
            <p className="text-sm text-[#7a6a5d]">No schedule triggers yet.</p>
          )}
        </ul>
      )}
    </div>
  );
};

export default ScheduleOverview;
