import api from "./axiosInstance";

export const chatService = {
  getThreads: () => api.get("/chat/thread"),
  getThreadMessages: (threadId) => api.get(`/chat/thread/${threadId}`),
  deleteThread: (threadId) => api.delete(`/chat/thread/${threadId}`),
  getThreadSources: (threadId) => api.get(`/chat/thread/${threadId}/sources`),
  deleteThreadSource: (threadId, sourceId) =>
    api.delete(`/chat/thread/${threadId}/sources/${sourceId}`),

  ingestFile: (threadId, file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    const sourceTypeMap = { pdf: "pdf", docx: "docx", txt: "txt" };
    const sourceType = sourceTypeMap[ext];
    if (!sourceType)
      throw new Error(
        "Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
      );

    const formData = new FormData();
    formData.append("threadId", threadId);
    formData.append("sourceType", sourceType);
    formData.append("file", file);
    return api.post("/chat/ingest", formData);
  },
  ingestUrl: (threadId, source) =>
    api.post("/chat/ingest", { threadId: threadId, sourceType: "url", source }),
  ingestYoutube: (threadId, source) =>
    api.post("/chat/ingest", {
      threadId: threadId,
      sourceType: "youtube",
      source,
    }),
  deleteAllThreadSources: (threadId) =>
    api.delete(`/chat/thread/${threadId}/sources`),
};
