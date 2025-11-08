import { useWorkflows } from '../hooks/useWorkflows.js';

const formatDate = (value) => new Date(value).toLocaleString();

function WorkflowList() {
  const { workflows, loading, error } = useWorkflows();

  if (loading) return <p>Loading workflows…</p>;
  if (error) return <p className="error">Unable to load workflows.</p>;

  if (!workflows.length) {
    return <p>No workflows created yet.</p>;
  }

  return (
    <ul className="workflow-list">
      {workflows.map((workflow) => (
        <li key={workflow.id}>
          <strong>{workflow.name}</strong>
          <div>Status: {workflow.status}</div>
          <small>Created: {formatDate(workflow.created_at)}</small>
        </li>
      ))}
    </ul>
  );
}

export default WorkflowList;
