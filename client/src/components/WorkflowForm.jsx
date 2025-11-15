import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWorkflowMutation } from '../api/queries.js';
import { toast } from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  steps: z.array(
    z.object({
      actionKind: z.enum(['send_email', 'http_request', 'write_s3', 'send_slack_message', 'generate_ai_content']),
      config: z.string().min(2),
    })
  ),
  triggers: z.array(
    z.object({
      kind: z.enum(['schedule', 'webhook']),
      config: z.string().min(2),
    })
  ),
});

const WorkflowForm = ({ integrations = [] }) => {
  const { register, handleSubmit, control, reset, watch, getValues, setValue } = useForm({
    defaultValues: {
      name: '',
      description: '',
      status: 'inactive',
      steps: [{ actionKind: 'http_request', config: '{"url":"https://example.com"}' }],
      triggers: [{ kind: 'schedule', config: '{"cron":"0 12 * * *"}' }],
    },
    resolver: zodResolver(schema),
  });
  const steps = useFieldArray({ control, name: 'steps' });
  const triggers = useFieldArray({ control, name: 'triggers' });
  const mutation = useCreateWorkflowMutation();
  const slackIntegrations = integrations.filter(integration => integration.type === 'slack_webhook');
  const aiIntegrations = integrations.filter(integration => integration.type === 'openai');
  const watchedSteps = watch('steps');

  const getIntegrationIdFromConfig = (index, fallback = '') => {
    try {
      const configString = getValues(`steps.${index}.config`);
      if (!configString) return fallback;
      const parsed = JSON.parse(configString);
      return typeof parsed.integrationId === 'string' ? parsed.integrationId : fallback;
    } catch {
      return fallback;
    }
  };

  const setIntegrationOnConfig = (index, integrationId) => {
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

  const onSubmit = async values => {
    try {
      await mutation.mutateAsync({
        ...values,
        steps: values.steps.map((step, idx) => ({ idx, actionKind: step.actionKind, config: JSON.parse(step.config) })),
        triggers: values.triggers.map(trigger => ({ kind: trigger.kind, config: JSON.parse(trigger.config) })),
      });
      reset();
      toast.success('Workflow created');
    } catch (error) {
      console.error(error);
      toast.error('Creation failed. Please check your payloads.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-4 bg-white text-[#1f1c1a]">
      <div>
        <label className="text-sm text-[#7a6a5d]">Name</label>
        <input
          className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
          {...register('name')}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-[#7a6a5d]">Description</label>
          <textarea
            className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
            rows={2}
            {...register('description')}
          />
        </div>
        <div>
          <label className="text-sm text-[#7a6a5d]">Status</label>
          <select
            className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
            {...register('status')}
          >
            <option value="inactive">Inactive</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-[#7a6a5d]">Steps</label>
          <div className="mt-2 flex flex-col gap-3">
            {steps.fields.map((field, index) => {
              const currentKind = watchedSteps?.[index]?.actionKind;
              const isSlackStep = currentKind === 'send_slack_message';
              const isAIStep = currentKind === 'generate_ai_content';
              const relevantIntegrations = isSlackStep ? slackIntegrations : aiIntegrations;
              const integrationId = getIntegrationIdFromConfig(index, '');

              return (
                <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                  <select
                    className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                    {...register(`steps.${index}.actionKind`)}
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
                      {relevantIntegrations.length === 0 ? (
                        <p className="text-xs text-[#a18673]">Add an integration in Settings to unlock this step.</p>
                      ) : (
                        <select
                          className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
                          value={integrationId}
                          onChange={event => setIntegrationOnConfig(index, event.target.value)}
                        >
                          <option value="">
                            {isSlackStep ? 'Select Slack webhook' : 'Select OpenAI key (optional)'}
                          </option>
                          {relevantIntegrations.map(integration => (
                            <option key={integration.id} value={integration.id}>
                              {integration.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                  <textarea
                    className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                    rows={3}
                    {...register(`steps.${index}.config`)}
                  />
                </div>
              );
            })}
            <button
              type="button"
              className="btn-primary"
              onClick={() => steps.append({ actionKind: 'http_request', config: '{"url":"https://example.com"}' })}
            >
              Add step
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-[#7a6a5d]">Triggers</label>
          <div className="mt-2 flex flex-col gap-3">
            {triggers.fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                <select
                  className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                  {...register(`triggers.${index}.kind`)}
                >
                  <option value="schedule">Schedule</option>
                  <option value="webhook">Webhook</option>
                </select>
                <textarea
                  className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                  rows={3}
                  {...register(`triggers.${index}.config`)}
                />
              </div>
            ))}
            <button
              type="button"
              className="btn-primary"
              onClick={() => triggers.append({ kind: 'schedule', config: '{"cron":"0 8 * * *"}' })}
            >
              Add trigger
            </button>
          </div>
        </div>
      </div>
      <button type="submit" className="btn-primary self-start" disabled={mutation.isPending}>
        {mutation.isPending ? 'Saving…' : 'Create workflow'}
      </button>
    </form>
  );
};

export default WorkflowForm;
