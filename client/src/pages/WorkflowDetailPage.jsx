import { useParams } from 'react-router-dom';
import { useWorkflowDetailQuery } from '../api/queries.js';
import TriggerList from '../components/TriggerList.jsx';
import RunHistory from '../components/RunHistory.jsx';

const WorkflowDetailPage = () => {
  const { workflowId } = useParams();
  const { data: workflow } = useWorkflowDetailQuery(workflowId);

  if (!workflow) {
    return <p>Loading workflow…</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-slate-400">Workflow</p>
          <h1 className="text-2xl font-semibold">{workflow.name}</h1>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm ${workflow.status === 'active' ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-800 text-slate-300'}`}>
          {workflow.status}
        </span>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="card">
            <h3 className="mb-3 text-lg font-semibold">Steps</h3>
            <ol className="space-y-2 text-sm">
              {(workflow.steps ?? []).map(step => (
                <li key={step.id ?? step.idx} className="rounded border border-slate-800/80 px-3 py-2">
                  <p className="font-medium capitalize">{step.actionKind}</p>
                  <pre className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{JSON.stringify(step.config, null, 2)}</pre>
                </li>
              ))}
            </ol>
          </div>
          <RunHistory workflowId={workflowId} />
        </div>
        <TriggerList triggers={workflow.triggers ?? []} />
      </section>
    </div>
  );
};

export default WorkflowDetailPage;
