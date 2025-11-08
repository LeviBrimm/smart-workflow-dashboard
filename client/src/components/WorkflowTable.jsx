import { Link } from 'react-router-dom';
import { useDeleteWorkflowMutation } from '../api/queries.js';

const statusColors = {
  active: 'text-emerald-400',
  inactive: 'text-slate-400',
};

const WorkflowTable = ({ workflows = [] }) => {
  const { mutateAsync: deleteWorkflow, isPending } = useDeleteWorkflowMutation();

  const handleDelete = async workflow => {
    if (!window.confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
    try {
      await deleteWorkflow(workflow.id);
    } catch (error) {
      console.error('Delete failed', error);
    }
  };

  return (
    <div className="card overflow-hidden">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/60 text-left uppercase tracking-wide text-xs text-slate-400">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {workflows.map(workflow => (
            <tr key={workflow.id} className="hover:bg-slate-900/40">
              <td className="px-4 py-3">
                <Link to={`/workflows/${workflow.id}`} className="font-medium text-white hover:underline">
                  {workflow.name}
                </Link>
                <p className="text-xs text-slate-400">{workflow.description ?? 'No description'}</p>
              </td>
              <td className={`px-4 py-3 capitalize ${statusColors[workflow.status] ?? 'text-slate-300'}`}>{workflow.status}</td>
              <td className="px-4 py-3 text-slate-400">{new Date(workflow.updatedAt).toLocaleString()}</td>
              <td className="px-4 py-3 text-right">
                <button
                  className="text-xs text-rose-400 hover:text-rose-200 disabled:text-slate-600"
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
