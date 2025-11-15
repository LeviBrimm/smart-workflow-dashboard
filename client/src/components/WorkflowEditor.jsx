import { useFieldArray, useForm } from 'react-hook-form';
import { useUpdateWorkflowMutation } from '../api/queries.js';
import { toast } from 'react-hot-toast';

const stepTemplates = {
  http_request: {
    method: 'POST',
    url: 'https://api.example.com/endpoint',
    headers: { 'Content-Type': 'application/json' },
    body: { message: 'Hello from Smart Workflow' },
  },
  send_email: {
    to: 'ops@example.com',
    subject: 'Workflow Update',
    body: 'An automated workflow just completed.',
  },
  write_s3: {
    bucket: 'workflow-artifacts',
    key: 'reports/${runId}.json',
  },
  send_slack_message: {
    integrationId: '',
    text: 'Deployment finished successfully ✅',
    channel: '#alerts',
  },
  generate_ai_content: {
    integrationId: '',
    prompt: 'Summarize the latest workflow run results.',
    temperature: 0.2,
  },
};

const triggerTemplates = {
  schedule: {
    cron: '0 9 * * 1-5',
    timezone: 'UTC',
  },
  webhook: {
    secret: 'super-secret-token',
  },
};

const WorkflowEditor = ({ workflow, disabled, integrations = [] }) => {
  const mutation = useUpdateWorkflowMutation();
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    getValues,
    setValue,
    formState: { isDirty },
  } = useForm({
    defaultValues: {
      name: workflow.name ?? '',
      description: workflow.description ?? '',
      status: workflow.status ?? 'inactive',
      steps: (workflow.steps ?? []).map(step => ({
        actionKind: step.actionKind,
        config: JSON.stringify(step.config, null, 2),
      })),
      triggers: (workflow.triggers ?? []).map(trigger => ({
        kind: trigger.kind,
        config: JSON.stringify(trigger.config, null, 2),
      })),
    },
  });

  const steps = useFieldArray({ control, name: 'steps' });
  const triggers = useFieldArray({ control, name: 'triggers' });
  const slackIntegrations = integrations.filter(i => i.type === 'slack_webhook');
  const aiIntegrations = integrations.filter(i => i.type === 'openai');
  const watchedSteps = watch('steps');
  const watchedTriggers = watch('triggers');

  const getIntegrationIdFromConfig = index => {
    try {
      const configString = getValues(`steps.${index}.config`);
      if (!configString) return '';
      const parsed = JSON.parse(configString);
      return typeof parsed.integrationId === 'string' ? parsed.integrationId : '';
    } catch {
      return '';
    }
  };

  const setIntegrationOnConfig = (index, integrationId) => {
    if (disabled) return;
    try {
      const configString = getValues(`steps.${index}.config`);
      const parsed = configString ? JSON.parse(configString) : {};
      if (integrationId) {
        parsed.integrationId = integrationId;
      } else {
        delete parsed.integrationId;
      }
      setValue(`steps.${index}.config`, JSON.stringify(parsed, null, 2), { shouldDirty: true });
    } catch {
      setValue(`steps.${index}.config`, JSON.stringify({ integrationId }, null, 2), { shouldDirty: true });
    }
  };

  const parseJsonField = (value, label) => {
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  };

  const applyStepTemplate = (index, kind) => {
    const template = stepTemplates[kind];
    if (!template) return;
    const clone = JSON.parse(JSON.stringify(template));
    if (clone.integrationId !== undefined) {
      const integrationId = getIntegrationIdFromConfig(index);
      if (integrationId) {
        clone.integrationId = integrationId;
      } else {
        delete clone.integrationId;
      }
    }
    setValue(`steps.${index}.config`, JSON.stringify(clone, null, 2), { shouldDirty: true });
    toast.success('Inserted template config');
  };

  const applyTriggerTemplate = (index, kind) => {
    const template = triggerTemplates[kind];
    if (!template) return;
    setValue(`triggers.${index}.config`, JSON.stringify(template, null, 2), { shouldDirty: true });
    toast.success('Inserted template config');
  };

  const onSubmit = async values => {
    if (disabled) return;
    try {
      const stepsPayload = values.steps.map((step, idx) => ({
        idx,
        actionKind: step.actionKind,
        config: parseJsonField(step.config, `Step ${idx + 1} config`),
      }));
      const triggersPayload = values.triggers.map((trigger, idx) => ({
        kind: trigger.kind,
        config: parseJsonField(trigger.config, `Trigger ${idx + 1} config`),
      }));
      await mutation.mutateAsync({
        workflowId: workflow.id,
        payload: {
          name: values.name,
          description: values.description,
          steps: stepsPayload,
          triggers: triggersPayload,
        },
      });
      reset(values);
      toast.success('Workflow updated');
    } catch (error) {
      console.error(error);
      toast.error(error.message ?? 'Update failed. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-4 bg-white text-[#1f1c1a]">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Edit Workflow</h3>
          {disabled && <p className="text-xs text-[#a18673]">Deactivate this workflow to edit steps or triggers.</p>}
        </div>
        {!disabled && (
          <button className="btn-primary text-xs" type="submit" disabled={mutation.isPending || !isDirty}>
            {mutation.isPending ? 'Saving…' : 'Save changes'}
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-[#7a6a5d]">Name</label>
          <input
            className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a]"
            {...register('name')}
            disabled={disabled}
          />
        </div>
        <div>
          <label className="text-sm text-[#7a6a5d]">Status</label>
          <input
            value={workflow.status}
            disabled
            className="mt-1 w-full rounded-md border border-[#d9cabc] bg-[#f4ece3] px-3 py-2 text-[#5c3d2e]"
          />
        </div>
      </div>
      <div>
        <label className="text-sm text-[#7a6a5d]">Description</label>
        <textarea
          className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a]"
          rows={2}
          {...register('description')}
          disabled={disabled}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-[#7a6a5d]">Steps</label>
          <div className="mt-2 flex flex-col gap-3">
            {steps.fields.map((field, index) => {
              const currentKind = watchedSteps?.[index]?.actionKind;
              const isSlackStep = currentKind === 'send_slack_message';
              const isAIStep = currentKind === 'generate_ai_content';
              const relevant = isSlackStep ? slackIntegrations : aiIntegrations;
              const integrationId = getIntegrationIdFromConfig(index);
              const hasTemplate = Boolean(stepTemplates[currentKind]);

              return (
                <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                  <select
                    className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a]"
                    {...register(`steps.${index}.actionKind`)}
                    disabled={disabled}
                  >
                    <option value="http_request">HTTP Request</option>
                    <option value="send_email">Send Email</option>
                    <option value="write_s3">Write to S3</option>
                    <option value="send_slack_message">Send Slack Message</option>
                    <option value="generate_ai_content">Generate AI Content</option>
                  </select>
                  {(isSlackStep || isAIStep) && (
                    <div className="mt-2 space-y-1">
                      <label className="text-xs text-[#7a6a5d]">
                        {isSlackStep ? 'Slack integration' : 'OpenAI integration'}
                      </label>
                      <select
                        className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
                        value={integrationId}
                        onChange={event => setIntegrationOnConfig(index, event.target.value)}
                        disabled={disabled}
                      >
                        <option value="">
                          {isSlackStep ? 'Select Slack webhook' : 'Select OpenAI key (optional)'}
                        </option>
                        {relevant.map(integration => (
                          <option key={integration.id} value={integration.id}>
                            {integration.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <textarea
                    className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
                    rows={3}
                    {...register(`steps.${index}.config`)}
                    disabled={disabled}
                  />
                  {!disabled && hasTemplate && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[#8c5a3c] hover:text-[#6a4229]"
                      onClick={() => applyStepTemplate(index, currentKind)}
                    >
                      Insert template
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      className="text-xs text-rose-600 hover:text-rose-400"
                      onClick={() => steps.remove(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {!disabled && (
              <button
                type="button"
                className="btn-secondary self-start"
                onClick={() => steps.append({ actionKind: 'http_request', config: '{"url":"https://example.com"}' })}
              >
                Add step
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="text-sm text-[#7a6a5d]">Triggers</label>
          <div className="mt-2 flex flex-col gap-3">
            {triggers.fields.map((field, index) => {
              const triggerKind = watchedTriggers?.[index]?.kind;
              const triggerHasTemplate = Boolean(triggerTemplates[triggerKind]);
              return (
                <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                  <select
                    className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a]"
                    {...register(`triggers.${index}.kind`)}
                    disabled={disabled}
                  >
                    <option value="schedule">Schedule</option>
                    <option value="webhook">Webhook</option>
                  </select>
                  <textarea
                    className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
                    rows={3}
                    {...register(`triggers.${index}.config`)}
                    disabled={disabled}
                  />
                  {!disabled && triggerHasTemplate && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-[#8c5a3c] hover:text-[#6a4229]"
                      onClick={() => applyTriggerTemplate(index, triggerKind)}
                    >
                      Insert template
                    </button>
                  )}
                  {!disabled && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-rose-600 hover:text-rose-400"
                      onClick={() => triggers.remove(index)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
            {!disabled && (
              <button
                type="button"
                className="btn-secondary self-start"
                onClick={() => triggers.append({ kind: 'schedule', config: '{"cron":"0 8 * * *"}' })}
              >
                Add trigger
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

export default WorkflowEditor;
