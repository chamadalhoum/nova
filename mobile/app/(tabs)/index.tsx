import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, Task } from "@/lib/api";
import { Badge, Button, Card, EmptyState, colors } from "@/lib/ui";

type Conversation = { id: string };
type AIResponse = { state: string; assistant_message: { content: string }; proposed_task?: { title: string; category?: string; location?: string; due_date?: string; suggested_capability?: string } };

function categoryLabel(category?: string) {
  return (category || "task").replaceAll("_", " ");
}

export default function HomeScreen() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [latestAIResponse, setLatestAIResponse] = useState<AIResponse | null>(null);
  const [toolMessage, setToolMessage] = useState("");

  const send = useMutation({
    mutationFn: async (content: string) => {
      const active = conversation ?? await apiFetch<Conversation>("/api/v1/conversations", { method: "POST", body: JSON.stringify({}) });
      setConversation(active);
      return apiFetch<AIResponse>(`/api/v1/conversations/${active.id}/messages`, { method: "POST", body: JSON.stringify({ content }) });
    },
    onSuccess: (data, content) => {
      setMessages((current) => [...current, { role: "user", content }, { role: "assistant", content: data.assistant_message.content }]);
      setLatestAIResponse(data);
      setTask(null);
      setInput("");
    },
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("No conversation");
      return apiFetch<Task>(`/api/v1/conversations/${conversation.id}/confirm-task`, { method: "POST" });
    },
    onSuccess: (createdTask) => {
      setTask(createdTask);
      setLatestAIResponse(null);
    },
  });

  const waiting = latestAIResponse?.state === "waiting_confirmation" && Boolean(latestAIResponse.proposed_task);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.eyebrow}>NOVA</Text>
      <Text style={styles.title}>What do you need to get done?</Text>
      <Text style={styles.subtitle}>Tell NOVA the outcome. It will ask only for missing details and create a task after you confirm.</Text>
      <Card>
        {messages.length === 0 ? <EmptyState title="Start with a natural request" description={'Examples: "N7eb plombier fi Ariana" or "Need AC repair tomorrow".'} /> : messages.map((message, index) => <Text key={index} style={[styles.bubble, message.role === "user" ? styles.user : styles.assistant]}>{message.content}</Text>)}
      </Card>
      {waiting && !task && <Card tone="amber"><Badge>I understand</Badge><Text style={styles.confirmationTitle}>Service: {categoryLabel(latestAIResponse?.proposed_task?.category)}</Text>{latestAIResponse?.proposed_task?.location && <Text>Area: {latestAIResponse.proposed_task.location}</Text>}{latestAIResponse?.proposed_task?.due_date && <Text>Date: {latestAIResponse.proposed_task.due_date}</Text>}{latestAIResponse?.proposed_task?.suggested_capability === "search_services" && <Text>I can search the service options available in NOVA.</Text>}<Text>No booking or provider contact will happen yet.</Text><Button onPress={() => confirm.mutate()} disabled={confirm.isPending}>{confirm.isPending ? "Preparing your task..." : latestAIResponse?.proposed_task?.suggested_capability === "search_services" ? "Create task, then search options" : "Confirm and create task"}</Button><Button variant="secondary" onPress={() => setLatestAIResponse(null)}>Modify</Button></Card>}
      {task && <Text style={styles.success}>Task created: {task.title}</Text>}
      <TextInput accessibilityLabel="Write what you need" style={styles.input} placeholder="Write what you need..." value={input} onChangeText={setInput} multiline />
      <Button onPress={() => input.trim() && send.mutate(input.trim())}>{send.isPending ? "Understanding..." : "Send"}</Button>
      <View style={styles.row}><Button variant="secondary" onPress={() => setToolMessage("Voice input is not available in this mobile build. You can still type normally.")}>Microphone</Button><Button variant="secondary" onPress={() => setToolMessage("Attachments are available on web first. Mobile upload is intentionally not faked.")}>Attachment</Button></View>
      {toolMessage ? <Text style={styles.toolMessage}>{toolMessage}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, backgroundColor: colors.bg, minHeight: "100%" },
  eyebrow: { color: colors.calm, fontWeight: "800", letterSpacing: 2 },
  title: { marginTop: 10, fontSize: 36, lineHeight: 42, fontWeight: "800", color: colors.ink },
  subtitle: { marginTop: 10, color: "#4b5563", fontSize: 17, lineHeight: 24 },
  bubble: { marginVertical: 6, padding: 14, borderRadius: 18, fontSize: 16, lineHeight: 22 },
  user: { alignSelf: "flex-end", backgroundColor: "#111827", color: "#fff" },
  assistant: { alignSelf: "flex-start", backgroundColor: "#eef2f7", color: "#111827" },
  input: { minHeight: 56, marginTop: 16, padding: 16, borderRadius: 24, backgroundColor: "#fff", fontSize: 16 },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  success: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: "#dcfce7", color: "#166534" },
  confirmationTitle: { color: "#111827", fontWeight: "700" },
  toolMessage: { marginTop: 10, color: "#6b7280", lineHeight: 20 },
});
