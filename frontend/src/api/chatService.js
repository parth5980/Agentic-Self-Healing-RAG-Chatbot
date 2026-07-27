import api from "./axiosInstance";

export const chatService = {
  getThreads: () => api.get("/chat/thread"),
  getThreadMessages: (threadId) => api.get(`/chat/thread/${threadId}`),
  deleteThread: (threadId) => api.delete(`/chat/thread/${threadId}`),
  getThreadSources: (threadId) => api.get(`/chat/thread/${threadId}/sources`),
};
