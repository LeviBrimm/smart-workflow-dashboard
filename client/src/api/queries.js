import axios from 'axios';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'http://localhost:4000/v1',
  withCredentials: true,
});

api.interceptors.request.use(config => {
  const token = useAuthStore.getState().tokens?.idToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;
      try {
        await useAuthStore.getState().refreshSession();
        const newToken = useAuthStore.getState().tokens?.idToken;
        if (newToken) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
      }
    }
    return Promise.reject(error);
  }
);

export const useWorkflowsQuery = () =>
  useQuery({ queryKey: ['workflows'], queryFn: async () => (await api.get('/workflows')).data });

export const useWorkflowDetailQuery = workflowId =>
  useQuery({
    queryKey: ['workflows', workflowId],
    queryFn: async () => (await api.get(`/workflows/${workflowId}`)).data,
    enabled: Boolean(workflowId),
  });

export const useCreateWorkflowMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payload => api.post('/workflows', payload).then(res => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
};

export const useDeleteWorkflowMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: workflowId => api.delete(`/workflows/${workflowId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
};

export const useUpdateWorkflowMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, payload }) => api.put(`/workflows/${workflowId}`, payload).then(res => res.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflows', variables.workflowId] });
    },
  });
};

export const useToggleWorkflowStatusMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, status }) =>
      api.post(`/workflows/${workflowId}/${status === 'active' ? 'activate' : 'deactivate'}`).then(res => res.data),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
      qc.invalidateQueries({ queryKey: ['workflows', variables.workflowId] });
    },
  });
};

export const useWorkflowRunsQuery = ({ workflowId, status, limit = 10 }) =>
  useInfiniteQuery({
    queryKey: ['runs', workflowId, status],
    queryFn: async ({ pageParam }) => {
      const params = { limit };
      if (status && status !== 'all') params.status = status;
      if (pageParam) params.cursor = pageParam;
      const res = await api.get(`/workflows/${workflowId}/runs`, { params });
      return res.data;
    },
    getNextPageParam: lastPage => lastPage?.nextCursor ?? undefined,
    enabled: Boolean(workflowId),
  });

export const useRunDetailQuery = runId =>
  useQuery({
    queryKey: ['run', runId],
    queryFn: async () => (await api.get(`/runs/${runId}`)).data,
    enabled: Boolean(runId),
  });

export const useCancelRunMutation = workflowId => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: runId => api.post(`/runs/${runId}/cancel`).then(res => res.data),
    onSuccess: (_data, runId) => {
      qc.invalidateQueries({
        predicate: query => Array.isArray(query.queryKey) && query.queryKey[0] === 'runs' && query.queryKey[1] === workflowId,
      });
      qc.invalidateQueries({ queryKey: ['run', runId] });
    },
  });
};

export const useScheduleTriggersQuery = () =>
  useQuery({
    queryKey: ['schedule-triggers'],
    queryFn: async () => (await api.get('/triggers/schedules')).data,
  });

export const useIntegrationsQuery = () =>
  useQuery({
    queryKey: ['integrations'],
    queryFn: async () => (await api.get('/integrations')).data,
  });

export const useTemplatesQuery = () =>
  useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api.get('/templates')).data,
  });

export const useCreateIntegrationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: payload => api.post('/integrations', payload).then(res => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};

export const useDeleteIntegrationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: integrationId => api.delete(`/integrations/${integrationId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};

export const useUpdateIntegrationMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ integrationId, payload }) =>
      api.patch(`/integrations/${integrationId}`, payload).then(res => res.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['integrations'] }),
  });
};
