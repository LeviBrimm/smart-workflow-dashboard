import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useCreateWorkflowMutation } from '../api/queries.js';
import TemplateFieldsForm from './TemplateFieldsForm.jsx';
import { buildWorkflowPayload } from '../utils/templateHelpers.js';

const TemplateGallery = ({ templates = [] }) => {
  const mutation = useCreateWorkflowMutation();
  const [activeTemplateId, setActiveTemplateId] = useState(null);
  const [fieldValues, setFieldValues] = useState({});

  const activeTemplate = useMemo(() => templates.find(template => template.id === activeTemplateId) ?? null, [templates, activeTemplateId]);

  const handleSelect = template => {
    setActiveTemplateId(template.id);
    const defaults = Object.fromEntries(template.fields.map(field => [field.id, field.defaultValue ?? '']));
    setFieldValues(defaults);
  };

  const handleFieldChange = (fieldId, value) => {
    setFieldValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    if (!activeTemplate) return;

    const cleanedValues = activeTemplate.fields.reduce((acc, field) => {
      const rawValue = fieldValues[field.id] ?? '';
      acc[field.id] = typeof rawValue === 'string' ? rawValue.trim() : rawValue;
      return acc;
    }, {});

    const missingField = activeTemplate.fields.find(field => field.required && !cleanedValues[field.id]);
    if (missingField) {
      toast.error(`Please fill in ${missingField.label}.`);
      return;
    }

    try {
      const payload = buildWorkflowPayload(activeTemplate, cleanedValues);
      await mutation.mutateAsync({
        ...payload,
        templateId: activeTemplate.id,
        templateInputs: cleanedValues,
      });
      toast.success('Workflow created from template');
      setActiveTemplateId(null);
      setFieldValues({});
    } catch (error) {
      console.error(error);
      toast.error('Unable to create workflow');
    }
  };

  return (
    <div className="card space-y-4 bg-white text-[#1f1c1a]">
      <div>
        <p className="text-sm text-[#7a6a5d]">Templates</p>
        <h3 className="text-lg font-semibold">Start from a recipe</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {templates.map(template => (
          <div key={template.id} className={`rounded-2xl border ${activeTemplateId === template.id ? 'border-[#c0895a] bg-[#fffaf6]' : 'border-[#e2d6c8] bg-white'} p-4 shadow-sm`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[#8c6c52]">Template</p>
                <h4 className="text-lg font-semibold">{template.name}</h4>
                <p className="text-sm text-[#6b5141]">{template.summary}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#7a6a5d]">
              {(template.recommendedIntegrations ?? []).map(tag => (
                <span key={tag} className="rounded-full border border-[#e2d6c8] px-2 py-0.5">
                  {tag.replace('_', ' ')}
                </span>
              ))}
            </div>
            <button
              type="button"
              className="btn-secondary mt-4 w-full text-sm"
              onClick={() => handleSelect(template)}
            >
              {activeTemplateId === template.id ? 'Selected' : 'Use template'}
            </button>
          </div>
        ))}
        {!templates.length && <p className="text-sm text-[#7a6a5d]">No templates yet.</p>}
      </div>
      {activeTemplate && (
        <div className="rounded-2xl border border-[#e4d7c8] bg-[#fffdf9] p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold">{activeTemplate.name} setup</p>
            <p className="text-xs text-[#7a6a5d]">Fill in the blanks and we’ll wire up the steps for you.</p>
          </div>
          <TemplateFieldsForm
            template={activeTemplate}
            values={fieldValues}
            onChange={handleFieldChange}
            onSubmit={handleSubmit}
            onCancel={() => setActiveTemplateId(null)}
            submitLabel="Create workflow"
            isSubmitting={mutation.isPending}
          />
        </div>
      )}
    </div>
  );
};

export default TemplateGallery;
