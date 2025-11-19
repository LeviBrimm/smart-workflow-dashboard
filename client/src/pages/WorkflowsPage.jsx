import WorkflowTable from '../components/WorkflowTable.jsx';
import WorkflowForm from '../components/WorkflowForm.jsx';
import ScheduleOverview from '../components/ScheduleOverview.jsx';
import TemplateGallery from '../components/TemplateGallery.jsx';
import { useIntegrationsQuery, useTemplatesQuery, useWorkflowsQuery } from '../api/queries.js';

const WorkflowsPage = () => {
  const { data, isLoading } = useWorkflowsQuery();
  const { data: integrations = [] } = useIntegrationsQuery();
  const { data: templates = [], isLoading: templatesLoading } = useTemplatesQuery();

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#7a6a5d]">Overview</p>
          <h1 className="text-2xl font-semibold text-[#1f1c1a]">Workflows</h1>
        </div>
      </header>
      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <WorkflowTable workflows={data ?? []} templates={templates} />
          </div>
          <ScheduleOverview />
        </div>
      )}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">New Workflow</h2>
        {templatesLoading ? <p className="text-sm text-[#7a6a5d]">Loading templates…</p> : <TemplateGallery templates={templates} />}
        <div className="card bg-white">
          <h3 className="mb-3 text-lg font-semibold text-[#1f1c1a]">Build your own</h3>
          <WorkflowForm integrations={integrations} />
        </div>
      </section>
    </div>
  );
};

export default WorkflowsPage;
