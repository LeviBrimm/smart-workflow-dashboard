export const replacePlaceholders = (value, replacements) => {
  if (typeof value === 'string') {
    return value.replace(/{{\s*([^}]+)\s*}}/g, (_match, key) => {
      const trimmed = key.trim();
      return replacements[trimmed] ?? `{{${trimmed}}}`;
    });
  }
  if (Array.isArray(value)) {
    return value.map(entry => replacePlaceholders(entry, replacements));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, replacePlaceholders(v, replacements)]));
  }
  return value;
};

export const buildWorkflowPayload = (template, replacements) => {
  const appliedSteps = template.workflow.steps.map((step, idx) => ({
    idx,
    actionKind: step.actionKind,
    config: replacePlaceholders(step.config, replacements),
  }));

  const appliedTriggers = template.workflow.triggers.map(trigger => ({
    kind: trigger.kind,
    config: replacePlaceholders(trigger.config, replacements),
  }));

  return {
    name: replacePlaceholders(template.workflow.name, replacements),
    description: template.workflow.description ? replacePlaceholders(template.workflow.description, replacements) : undefined,
    steps: appliedSteps,
    triggers: appliedTriggers,
  };
};
