const TEMPLATE_REGEX = /{{\s*([^}]+)\s*}}/g;

const getPathValue = (source: unknown, path: string): unknown => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc === undefined || acc === null) {
      return undefined;
    }
    if (typeof acc !== 'object') {
      return undefined;
    }
    const current = acc as Record<string, unknown>;
    return current[key];
  }, source);
};

const applyTemplates = (value: unknown, context: Record<string, unknown>): unknown => {
  if (typeof value === 'string') {
    return value.replace(TEMPLATE_REGEX, (_match, path) => {
      const trimmed = String(path).trim();
      const resolved = getPathValue(context, trimmed);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map(item => applyTemplates(item, context));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = applyTemplates(val, context);
      return acc;
    }, {});
  }

  return value;
};

export const resolveTemplates = <T>(value: T, context: Record<string, unknown>): T => {
  return applyTemplates(value, context) as T;
};
