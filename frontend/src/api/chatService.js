import api from "./axiosInstance";

export const chatService = {
  getThreads: () => api.get("/chat/thread"),
  getThreadMessages: (threadId) => api.get(`/chat/thread/${threadId}`),
  deleteThread: (threadId) => api.delete(`/chat/thread/${threadId}`),
  getThreadSources: (threadId) => api.get(`/chat/thread/${threadId}/sources`),
  deleteThreadSource: (threadId, sourceId) =>
    api.delete(`/chat/thread/${threadId}/sources/${sourceId}`),

  ingestFile: (threadId, file) => {
    const formData = new FormData();
    formData.append("threadId", threadId);
    formData.append("sourceType", "pdf");
    formData.append("file", file);
    return api.post("/chat/ingest", formData);
  },
  ingestUrl: (threadId, source) =>
    api.post("/chat/ingest", { threadId, sourceType: "url", source }),
  ingestYoutube: (threadId, source) =>
    api.post("/chat/ingest", { threadId, sourceType: "youtube", source }),
};
