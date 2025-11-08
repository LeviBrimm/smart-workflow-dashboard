import WorkflowTable from '../components/WorkflowTable.jsx';
import WorkflowForm from '../components/WorkflowForm.jsx';
import { useWorkflowsQuery } from '../api/queries.js';

const WorkflowsPage = () => {
  const { data, isLoading } = useWorkflowsQuery();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Overview</p>
          <h1 className="text-2xl font-semibold text-white">Workflows</h1>
        </div>
      </header>
      {isLoading ? <p>Loading…</p> : <WorkflowTable workflows={data ?? []} />}
      <section>
        <h2 className="mb-3 text-xl font-semibold">New Workflow</h2>
        <WorkflowForm />
      </section>
    </div>
  );
};

export default WorkflowsPage;
