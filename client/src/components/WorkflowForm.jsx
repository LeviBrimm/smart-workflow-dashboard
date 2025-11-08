import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateWorkflowMutation } from '../api/queries.js';

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
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card flex flex-col gap-4">
      <div>
        <label className="text-sm text-slate-300">Name</label>
        <input className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2" {...register('name')} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Description</label>
          <textarea className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2" rows={2} {...register('description')} />
        </div>
        <div>
          <label className="text-sm text-slate-300">Status</label>
          <select className="mt-1 w-full rounded-md border border-slate-800 bg-slate-900 px-3 py-2" {...register('status')}>
            <option value="inactive">Inactive</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="text-sm text-slate-300">Steps</label>
          <div className="mt-2 flex flex-col gap-3">
            {steps.fields.map((field, index) => (
              <div key={field.id} className="rounded border border-slate-800 p-3">
                <select className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" {...register(`steps.${index}.actionKind`)}>
                  <option value="http_request">HTTP Request</option>
                  <option value="send_email">Send Email</option>
                  <option value="write_s3">Write to S3</option>
                </select>
                <textarea className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" rows={3} {...register(`steps.${index}.config`)} />
              </div>
            ))}
            <button type="button" className="btn-primary" onClick={() => steps.append({ actionKind: 'http_request', config: '{"url":"https://example.com"}' })}>
              Add step
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-slate-300">Triggers</label>
          <div className="mt-2 flex flex-col gap-3">
            {triggers.fields.map((field, index) => (
              <div key={field.id} className="rounded border border-slate-800 p-3">
                <select className="w-full rounded border border-slate-700 bg-slate-900 px-2 py-1" {...register(`triggers.${index}.kind`)}>
                  <option value="schedule">Schedule</option>
                  <option value="webhook">Webhook</option>
                </select>
                <textarea className="mt-2 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs" rows={3} {...register(`triggers.${index}.config`)} />
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
