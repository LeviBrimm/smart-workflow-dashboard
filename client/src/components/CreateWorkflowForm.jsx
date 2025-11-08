import { useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? '/api/workflows';

function CreateWorkflowForm() {
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState('{\n  "steps": []\n}');
  const [lambdaName, setLambdaName] = useState('');
  const [statusMessage, setStatusMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage('Submitting…');

    try {
      const payload = { name, definition: JSON.parse(definition), triggerLambdaName: lambdaName || undefined };
      await axios.post(API_URL, payload);
      setStatusMessage('Workflow created!');
      setName('');
      setDefinition('{\n  "steps": []\n}');
      setLambdaName('');
    } catch (error) {
      setStatusMessage(error.response?.data?.message ?? 'Failed to create workflow');
    }
  };

  return (
    <form className="workflow-form" onSubmit={handleSubmit}>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Monthly Report" required />
      </label>
      <label>
        Definition (JSON)
        <textarea value={definition} onChange={(event) => setDefinition(event.target.value)} rows={6} required />
      </label>
      <label>
        Lambda Function (optional)
        <input value={lambdaName} onChange={(event) => setLambdaName(event.target.value)} placeholder="workflow-runner" />
      </label>
      <button type="submit">Create Workflow</button>
      {statusMessage && <p className="status">{statusMessage}</p>}
    </form>
  );
}

export default CreateWorkflowForm;
