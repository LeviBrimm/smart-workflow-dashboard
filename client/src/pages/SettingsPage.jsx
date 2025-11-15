import { useState } from 'react';
import toast from 'react-hot-toast';
import {
  useIntegrationsQuery,
  useCreateIntegrationMutation,
  useDeleteIntegrationMutation,
  useUpdateIntegrationMutation,
} from '../api/queries.js';
import { useAuthStore } from '../store/authStore.js';

const SettingsPage = () => {
  const { loginUrl } = useAuthStore();
  const { data: integrations = [], isLoading } = useIntegrationsQuery();
  const createMutation = useCreateIntegrationMutation();
  const updateMutation = useUpdateIntegrationMutation();
  const deleteMutation = useDeleteIntegrationMutation();

  const [form, setForm] = useState({
    name: '',
    type: 'slack_webhook',
    secret: '',
    config: '',
  });
  const [editingIntegration, setEditingIntegration] = useState(null);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetForm = (nextType = 'slack_webhook') => {
    setForm({ name: '', type: nextType, secret: '', config: '' });
    setEditingIntegration(null);
  };

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const parsedConfig = form.config ? JSON.parse(form.config) : undefined;
      if (editingIntegration) {
        const payload = {
          name: form.name.trim(),
          config: parsedConfig,
        };
        if (form.secret.trim()) {
          payload.secret = form.secret.trim();
        }
        await updateMutation.mutateAsync({ integrationId: editingIntegration.id, payload });
        toast.success('Integration updated');
        resetForm(editingIntegration.type);
      } else {
        const payload = {
          name: form.name.trim(),
          type: form.type,
          secret: form.secret.trim(),
          config: parsedConfig,
        };
        await createMutation.mutateAsync(payload);
        toast.success('Integration saved');
        resetForm(form.type);
      }
    } catch (error) {
      console.error(error);
      toast.error('Failed to save integration. Ensure config is valid JSON.');
    }
  };

  const handleDelete = async id => {
    if (!confirm('Delete this integration?')) return;
    try {
      await deleteMutation.mutateAsync(id);
      if (editingIntegration?.id === id) {
        resetForm();
      }
      toast.success('Integration removed');
    } catch (error) {
      console.error(error);
      toast.error('Deletion failed');
    }
  };

  const beginEdit = integration => {
    setEditingIntegration(integration);
    setForm({
      name: integration.name,
      type: integration.type,
      secret: '',
      config: integration.config ? JSON.stringify(integration.config, null, 2) : '',
    });
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const isEditing = Boolean(editingIntegration);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm uppercase tracking-wide text-[#8c6c52]/70">Settings</p>
        <h1 className="text-3xl font-semibold text-[#1f1c1a]">Integrations & Access</h1>
        <p className="text-sm text-[#6b5141]">Store API keys/webhooks securely and manage developer tooling.</p>
      </header>

      <section className="card space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1c1a]">
                {isEditing ? `Edit ${editingIntegration?.name}` : 'Connect an integration'}
              </h2>
              <p className="text-sm text-[#6b5141]">
                Slack webhooks drive the <strong>Send Slack Message</strong> step. OpenAI keys power{' '}
                <strong>Generate AI Content</strong>. Secrets are encrypted before storing in the database.
              </p>
            </div>
            {isEditing && (
              <button className="btn-secondary text-xs" type="button" onClick={() => resetForm(form.type)}>
                Cancel edit
              </button>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm text-[#7a6a5d]">Name</label>
            <input
              name="name"
              className="rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a]"
              value={form.name}
              onChange={handleChange}
              placeholder="Prod Slack Alerts"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-[#7a6a5d]">Type</label>
            <select
              name="type"
              className="rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a]"
              value={form.type}
              onChange={handleChange}
              disabled={isEditing}
            >
              <option value="slack_webhook">Slack Webhook</option>
              <option value="openai">OpenAI API Key</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-[#7a6a5d]">
              Secret {isEditing && <span className="text-xs text-[#9a7a60]">(leave blank to keep current)</span>}
            </label>
            <textarea
              name="secret"
              className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a]"
              rows={2}
              value={form.secret}
              onChange={handleChange}
              placeholder={
                form.type === 'slack_webhook'
                  ? 'https://hooks.slack.com/services/...'
                  : 'sk-live-...'
              }
              required={!isEditing}
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-sm text-[#7a6a5d]">Optional config (JSON)</label>
            <textarea
              name="config"
              className="mt-1 w-full rounded-md border border-[#d9cabc] bg-white px-3 py-2 text-[#1f1c1a] text-sm"
              rows={2}
              value={form.config}
              onChange={handleChange}
              placeholder='e.g. {"channel":"#ops-alerts"}'
            />
          </div>
          <div className="md:col-span-2">
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Update integration' : 'Save integration'}
            </button>
          </div>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-[#1f1c1a]">Connected integrations</h2>
        {isLoading ? (
          <p className="text-sm text-[#6b5141]">Loading...</p>
        ) : integrations.length === 0 ? (
          <p className="text-sm text-[#6b5141]">No integrations yet. Add your first one above.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {integrations.map(integration => (
              <div key={integration.id} className="rounded-lg border border-[#e5d8c9] bg-white/80 p-4 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-[#8c6c52]">{integration.type}</p>
                <h3 className="text-lg font-semibold text-[#1f1c1a]">{integration.name}</h3>
                <p className="text-xs text-[#6b5141]">Created {new Date(integration.createdAt).toLocaleDateString()}</p>
                <div className="mt-3 flex gap-2">
                  <button className="btn-secondary text-xs" onClick={() => beginEdit(integration)}>
                    Edit
                  </button>
                  <button
                    className="btn-secondary text-xs text-rose-600 hover:text-rose-500"
                    onClick={() => handleDelete(integration.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-semibold text-[#1f1c1a]">Developer tools</h2>
        <div>
          <p className="text-sm font-medium text-[#7a6a5d]">Webhook testing</p>
          <p className="text-xs text-[#6b5141]">Use /v1/webhook/:triggerId with your trigger secret.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-[#7a6a5d]">Cognito hosted UI</p>
          <a className="btn-primary mt-2 inline-block" href={loginUrl}>
            Open login page
          </a>
        </div>
      </section>
    </div>
  );
};

export default SettingsPage;
