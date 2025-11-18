const TemplateFieldsForm = ({ template, values, onChange, onSubmit, onCancel, submitLabel = 'Save', isSubmitting = false, showCancel = true }) => (
  <form className="space-y-3" onSubmit={onSubmit}>
    {template.fields.map(field => (
      <div key={field.id} className="space-y-1">
        <label className="text-sm text-[#7a6a5d]">
          {field.label}
          {field.required ? <span className="text-rose-500"> *</span> : null}
        </label>
        {field.type === 'select' ? (
          <select
            className="w-full rounded border border-[#d9cabc] bg-white px-3 py-2 text-sm"
            value={values[field.id] ?? ''}
            onChange={event => onChange(field.id, event.target.value)}
          >
            <option value="">Select…</option>
            {(field.options ?? []).map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : field.type === 'textarea' ? (
          <textarea
            className="w-full rounded border border-[#d9cabc] bg-white px-3 py-2 text-sm"
            rows={3}
            value={values[field.id] ?? ''}
            onChange={event => onChange(field.id, event.target.value)}
            placeholder={field.placeholder}
          />
        ) : (
          <input
            className="w-full rounded border border-[#d9cabc] bg-white px-3 py-2 text-sm"
            value={values[field.id] ?? ''}
            onChange={event => onChange(field.id, event.target.value)}
            placeholder={field.placeholder}
          />
        )}
        {field.helperText && <p className="text-xs text-[#9a7a60]">{field.helperText}</p>}
      </div>
    ))}
    <div className="flex flex-wrap gap-2">
      <button type="submit" className="btn-primary text-sm" disabled={isSubmitting}>
        {isSubmitting ? 'Saving…' : submitLabel}
      </button>
      {showCancel && onCancel && (
        <button type="button" className="btn-secondary text-sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      )}
    </div>
  </form>
);

export default TemplateFieldsForm;
