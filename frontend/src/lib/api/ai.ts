import { apiClient } from "@/lib/api-client";

export async function aiChat(messages: { role: string; text: string }[]): Promise<string> {
  const formatted = messages.map((m) => ({ role: m.role, content: m.text }));
  const res = await apiClient<{ reply: string }>("/ai/chat", {
    method: "POST",
    body: { messages: formatted },
  });
  return res.reply;
}

export async function generateFlier(prompt: string): Promise<string> {
  const res = await apiClient<{ url: string }>("/ai/generate-flier", {
    method: "POST",
    body: { prompt },
  });
  return res.url;
}

export async function parseFlier(imageData: string, mimeType = "image/jpeg"): Promise<Record<string, unknown>> {
  return apiClient("/ai/parse-flier", {
    method: "POST",
    body: { image_data: imageData, mime_type: mimeType },
  });
}
