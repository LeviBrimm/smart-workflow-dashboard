import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDeleteWorkflowMutation, useToggleWorkflowStatusMutation } from '../api/queries.js';
import { toast } from 'react-hot-toast';

const statusColors = {
  active: 'text-emerald-700 bg-emerald-100',
  inactive: 'text-stone-600 bg-stone-100',
};

const WorkflowTable = ({ workflows = [], templates = [] }) => {
  const { mutateAsync: deleteWorkflow, isPending } = useDeleteWorkflowMutation();
  const toggleStatus = useToggleWorkflowStatusMutation();
  const templateNames = useMemo(
    () => Object.fromEntries((templates ?? []).map(template => [template.id, template.name])),
    [templates]
  );

  const handleDelete = async workflow => {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkflow(workflow.id);
      toast.success('Workflow deleted');
    } catch (error) {
      console.error('Delete failed', error);
      toast.error('Delete failed. Please try again.');
    }
  };

  return (
    <div className="card overflow-hidden bg-white">
      <table className="min-w-full divide-y divide-[#e9dfd2] text-sm text-[#3c342f]">
        <thead className="bg-[#f6f0ea] text-left uppercase tracking-wide text-xs text-[#8a7767]">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#efe5da]">
          {workflows.map(workflow => (
            <tr key={workflow.id} className="transition hover:bg-[#fef8f3]">
              <td className="px-4 py-3">
                <Link to={`/workflows/${workflow.id}`} className="font-medium text-[#1f1c1a] hover:underline">
                  {workflow.name}
                </Link>
                <p className="text-xs text-[#7a6a5d]">{workflow.description ?? 'No description'}</p>
                {workflow.templateId && (
                  <p className="text-[11px] text-[#a07d64]">
                    Template: {templateNames[workflow.templateId] ?? workflow.templateId}
                  </p>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColors[workflow.status] ?? 'text-stone-600 bg-stone-100'}`}>
                  {workflow.status}
                </span>
              </td>
              <td className="px-4 py-3 text-[#927e6d]">{new Date(workflow.updatedAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-right space-x-2">
                <button
                  className="rounded-full border border-[#d9cabc] px-3 py-1 text-xs font-medium text-[#5c3d2e] hover:bg-[#f4ece3] disabled:text-stone-400"
                  onClick={() =>
                    toggleStatus.mutate(
                      {
                        workflowId: workflow.id,
                        status: workflow.status === 'active' ? 'inactive' : 'active',
                      },
                      {
                        onSuccess: () =>
                          workflow.status === 'active'
                            ? toast.success('Workflow deactivated')
                            : toast.success('Workflow activated'),
                        onError: () => toast.error('Unable to update workflow'),
                      }
                    )
                  }
                  disabled={toggleStatus.isPending}
                >
                  {workflow.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  className="text-xs text-rose-600 hover:text-rose-400 disabled:text-stone-400"
                  onClick={() => handleDelete(workflow)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
          {!workflows.length && (
            <tr>
              <td className="px-4 py-6 text-center text-slate-500" colSpan={4}>
                No workflows yet. Create one to get started.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default WorkflowTable;
