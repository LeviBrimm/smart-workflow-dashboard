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
      actionKind: z.enum(['send_email', 'http_request', 'write_s3']),
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

const WorkflowForm = () => {
  const { register, handleSubmit, control, reset } = useForm({
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
            {steps.fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                <select
                  className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                  {...register(`steps.${index}.actionKind`)}
                >
                  <option value="http_request">HTTP Request</option>
                  <option value="send_email">Send Email</option>
                  <option value="write_s3">Write to S3</option>
                </select>
                <textarea
                  className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a] focus:border-[#b28967] focus:outline-none"
                  rows={3}
                  {...register(`steps.${index}.config`)}
                />
              </div>
            ))}
            <button type="button" className="btn-primary" onClick={() => steps.append({ actionKind: 'http_request', config: '{"url":"https://example.com"}' })}>
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
            <button type="button" className="btn-primary" onClick={() => triggers.append({ kind: 'schedule', config: '{"cron":"0 8 * * *"}' })}>
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
