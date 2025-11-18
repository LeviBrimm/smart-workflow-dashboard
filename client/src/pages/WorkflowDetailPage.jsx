import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  useIntegrationsQuery,
  useWorkflowDetailQuery,
  useTemplatesQuery,
  useUpdateWorkflowMutation,
} from '../api/queries.js';
import TriggerList from '../components/TriggerList.jsx';
import RunHistory from '../components/RunHistory.jsx';
import WorkflowEditor from '../components/WorkflowEditor.jsx';
import TemplateFieldsForm from '../components/TemplateFieldsForm.jsx';
import { buildWorkflowPayload } from '../utils/templateHelpers.js';

const WorkflowDetailPage = () => {
  const { workflowId } = useParams();
  const { data: workflow } = useWorkflowDetailQuery(workflowId);
  const { data: integrations = [] } = useIntegrationsQuery();
  const { data: templates = [] } = useTemplatesQuery();
  const updateWorkflow = useUpdateWorkflowMutation();
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateValues, setTemplateValues] = useState({});

  if (!workflow) {
    return <p>Loading workflow…</p>;
  }

  const canEdit = workflow.status === 'inactive';
  const templateMeta = useMemo(
    () => (workflow.templateId ? templates.find(template => template.id === workflow.templateId) ?? null : null),
    [templates, workflow.templateId]
  );
  useEffect(() => {
    if (templateMeta) {
      const initialValues = Object.fromEntries(
        templateMeta.fields.map(field => [field.id, String(workflow.templateInputs?.[field.id] ?? field.defaultValue ?? '')])
      );
      setTemplateValues(initialValues);
      setIsEditingTemplate(false);
    } else {
      setTemplateValues({});
      setIsEditingTemplate(false);
    }
  }, [templateMeta, workflow.templateInputs]);

  const handleTemplateFieldChange = (fieldId, value) => {
    setTemplateValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleTemplateSubmit = async event => {
    event.preventDefault();
    if (!templateMeta || !workflowId) return;
    const cleanedValues = templateMeta.fields.reduce((acc, field) => {
      const raw = templateValues[field.id] ?? '';
      acc[field.id] = typeof raw === 'string' ? raw.trim() : raw;
      return acc;
    }, {});

    const payloadFromTemplate = buildWorkflowPayload(templateMeta, cleanedValues);
    try {
      await updateWorkflow.mutateAsync({
        workflowId,
        payload: {
          steps: payloadFromTemplate.steps,
          triggers: payloadFromTemplate.triggers,
          templateId: templateMeta.id,
          templateInputs: cleanedValues,
        },
      });
      toast.success('Template inputs updated');
      setIsEditingTemplate(false);
    } catch (error) {
      console.error(error);
      toast.error('Unable to update template inputs');
    }
  };

  const handleConvertToCustom = async () => {
    if (!workflowId) return;
    if (!window.confirm('Convert this workflow to a custom version? Template inputs will be detached.')) return;
    try {
      await updateWorkflow.mutateAsync({ workflowId, payload: { templateId: null, templateInputs: null } });
      toast.success('Workflow converted to custom');
      setIsEditingTemplate(false);
    } catch (error) {
      console.error(error);
      toast.error('Unable to convert workflow');
    }
  };

  const editorDisabled = workflow.templateId ? true : !canEdit;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-wide text-[#7a6a5d]">Workflow</p>
          <h1 className="text-2xl font-semibold text-[#1f1c1a]">{workflow.name}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              workflow.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-700'
            }`}
          >
            {workflow.status}
          </span>
          {workflow.templateId && (
            <span className="rounded-full bg-[#f2e7dc] px-3 py-1 text-xs font-medium text-[#6b5141]">
              Template: {templateMeta?.name ?? workflow.templateId}
            </span>
          )}
        </div>
      </header>
      {workflow.templateInputs && templateMeta && (
        <div className="card bg-white text-sm text-[#4a4038]">
          <p className="text-xs uppercase tracking-wide text-[#8c6c52]">Template inputs</p>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            {templateMeta.fields.map(field => (
              <div key={field.id}>
                <dt className="text-xs text-[#9c8573]">{field.label}</dt>
                <dd className="text-sm font-medium text-[#2f2723]">{workflow.templateInputs?.[field.id] ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {workflow.templateId && (
        <div className="card space-y-3 bg-white text-[#1f1c1a]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#8c6c52]">Template</p>
              <h3 className="text-lg font-semibold">
                {templateMeta?.name ?? 'Custom template'}
              </h3>
              <p className="text-sm text-[#6b5141]">Manage the inputs for this workflow or convert it to a custom version.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button className="btn-secondary" onClick={() => setIsEditingTemplate(prev => !prev)}>
                {isEditingTemplate ? 'Close editor' : 'Edit template inputs'}
              </button>
              <button className="btn-secondary text-rose-600 hover:text-rose-500" onClick={handleConvertToCustom}>
                Convert to custom
              </button>
            </div>
          </div>
          {isEditingTemplate && templateMeta ? (
            <TemplateFieldsForm
              template={templateMeta}
              values={templateValues}
              onChange={handleTemplateFieldChange}
              onSubmit={handleTemplateSubmit}
              onCancel={() => setIsEditingTemplate(false)}
              submitLabel="Save changes"
              isSubmitting={updateWorkflow.isPending}
            />
          ) : (
            templateMeta && (
              <dl className="grid gap-3 sm:grid-cols-2">
                {templateMeta.fields.map(field => (
                  <div key={field.id}>
                    <dt className="text-xs uppercase tracking-wide text-[#9c8573]">{field.label}</dt>
                    <dd className="text-sm font-medium text-[#2f2723]">
                      {workflow.templateInputs?.[field.id] ?? '—'}
                    </dd>
                  </div>
                ))}
              </dl>
            )
          )}
          <p className="text-xs text-[#7a6a5d]">To edit steps or triggers directly, convert this workflow to a custom version.</p>
        </div>
      )}
      <WorkflowEditor workflow={workflow} disabled={editorDisabled} integrations={integrations} />
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
