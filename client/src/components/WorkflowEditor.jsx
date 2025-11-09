import { useFieldArray, useForm } from 'react-hook-form';
import { useUpdateWorkflowMutation } from '../api/queries.js';
import { useToastStore } from '../store/toastStore.js';

const WorkflowEditor = ({ workflow, disabled }) => {
  const mutation = useUpdateWorkflowMutation();
  const pushToast = useToastStore(state => state.pushToast);
  const {
    register,
    handleSubmit,
    control,
    reset,
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

  const onSubmit = async values => {
    if (disabled) return;
    try {
      await mutation.mutateAsync({
        workflowId: workflow.id,
        payload: {
          name: values.name,
          description: values.description,
          steps: values.steps.map((step, idx) => ({
            idx,
            actionKind: step.actionKind,
            config: JSON.parse(step.config || '{}'),
          })),
          triggers: values.triggers.map(trigger => ({
            kind: trigger.kind,
            config: JSON.parse(trigger.config || '{}'),
          })),
        },
      });
      reset(values);
      pushToast({ title: 'Workflow updated', variant: 'success' });
    } catch (error) {
      console.error(error);
      pushToast({ title: 'Update failed', message: 'Please try again.', variant: 'error' });
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
            {steps.fields.map((field, index) => (
              <div key={field.id} className="rounded-2xl border border-[#e0d4c6] bg-white/70 p-3 shadow-inner">
                <select
                  className="w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-[#1f1c1a]"
                  {...register(`steps.${index}.actionKind`)}
                  disabled={disabled}
                >
                  <option value="http_request">HTTP Request</option>
                  <option value="send_email">Send Email</option>
                  <option value="write_s3">Write to S3</option>
                </select>
                <textarea
                  className="mt-2 w-full rounded border border-[#d9cabc] bg-white px-2 py-1 text-xs text-[#1f1c1a]"
                  rows={3}
                  {...register(`steps.${index}.config`)}
                  disabled={disabled}
                />
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
            ))}
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
            {triggers.fields.map((field, index) => (
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
                {!disabled && (
                  <button
                    type="button"
                    className="text-xs text-rose-600 hover:text-rose-400"
                    onClick={() => triggers.remove(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
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
