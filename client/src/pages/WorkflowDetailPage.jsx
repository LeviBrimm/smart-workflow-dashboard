import { useParams } from 'react-router-dom';
import { useWorkflowDetailQuery } from '../api/queries.js';
import TriggerList from '../components/TriggerList.jsx';
import RunHistory from '../components/RunHistory.jsx';
import WorkflowEditor from '../components/WorkflowEditor.jsx';

const WorkflowDetailPage = () => {
  const { workflowId } = useParams();
  const { data: workflow } = useWorkflowDetailQuery(workflowId);

  if (!workflow) {
    return <p>Loading workflow…</p>;
  }

  const canEdit = workflow.status === 'inactive';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#7a6a5d]">Workflow</p>
          <h1 className="text-2xl font-semibold text-[#1f1c1a]">{workflow.name}</h1>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            workflow.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
          }`}
        >
          {workflow.status}
        </span>
      </header>
      <WorkflowEditor workflow={workflow} disabled={!canEdit} />
      <section className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="card bg-white text-[#1f1c1a]">
            <h3 className="mb-3 text-lg font-semibold">Current Steps</h3>
            <ol className="space-y-2 text-sm">
              {(workflow.steps ?? []).map(step => (
                <li key={step.id ?? step.idx} className="rounded-2xl border border-[#e0d4c6] bg-white/80 px-3 py-2">
                  <p className="font-medium capitalize">{step.actionKind}</p>
                  <pre className="mt-1 whitespace-pre-wrap rounded bg-[#f8f2ec] p-2 text-xs text-[#5c4c41]">
                    {JSON.stringify(step.config, null, 2)}
                  </pre>
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
