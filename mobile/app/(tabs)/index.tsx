import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, Task } from "@/lib/api";

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
      <Text style={styles.logo}>NOVA</Text>
      <Text style={styles.title}>Tell me what you need.</Text>
      <Text style={styles.subtitle}>I will help turn it into something you can actually get done.</Text>
      <View style={styles.messages}>
        {messages.length === 0 ? <View><Text style={styles.muted}>Examples:</Text><Text style={styles.example}>"N7eb plombier fi Ariana."</Text><Text style={styles.example}>"Help me organize my week."</Text><Text style={styles.example}>"Find someone to repair my AC."</Text><Text style={styles.example}>"Set a reminder for tomorrow."</Text></View> : messages.map((message, index) => <Text key={index} style={[styles.bubble, message.role === "user" ? styles.user : styles.assistant]}>{message.content}</Text>)}
      </View>
      {waiting && !task && <View style={styles.confirmation}><Text style={styles.confirmationTitle}>I understand:</Text><Text>Service: {categoryLabel(latestAIResponse?.proposed_task?.category)}</Text>{latestAIResponse?.proposed_task?.location && <Text>Area: {latestAIResponse.proposed_task.location}</Text>}{latestAIResponse?.proposed_task?.due_date && <Text>Date: {latestAIResponse.proposed_task.due_date}</Text>}{latestAIResponse?.proposed_task?.suggested_capability === "search_services" && <Text>I can search the service options available in NOVA.</Text>}<Text>No booking or provider contact will happen yet.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={() => confirm.mutate()}><Text style={styles.primaryText}>{confirm.isPending ? "Preparing your task..." : latestAIResponse?.proposed_task?.suggested_capability === "search_services" ? "Create task, then search options" : "Confirm and create task"}</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={() => setLatestAIResponse(null)}><Text>Modify</Text></Pressable></View>}
      {task && <Text style={styles.success}>Task created: {task.title}</Text>}
      <TextInput accessibilityLabel="Write what you need" style={styles.input} placeholder="Write what you need..." value={input} onChangeText={setInput} multiline />
      <Pressable accessibilityRole="button" style={styles.primary} onPress={() => input.trim() && send.mutate(input.trim())}><Text style={styles.primaryText}>{send.isPending ? "Understanding..." : "Send"}</Text></Pressable>
      <View style={styles.row}><Pressable style={styles.secondary}><Text>Microphone</Text></Pressable><Pressable style={styles.secondary}><Text>Camera</Text></Pressable></View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, backgroundColor: "#f5f7fb", minHeight: "100%" },
  logo: { fontSize: 18, fontWeight: "700", letterSpacing: 2 },
  title: { marginTop: 20, fontSize: 38, lineHeight: 44, fontWeight: "700", color: "#111827" },
  subtitle: { marginTop: 10, color: "#4b5563", fontSize: 17, lineHeight: 24 },
  messages: { minHeight: 220, marginTop: 24, padding: 16, borderRadius: 28, backgroundColor: "#fff" },
  muted: { color: "#6b7280", fontSize: 16, lineHeight: 24 },
  example: { marginTop: 8, padding: 10, borderRadius: 14, backgroundColor: "#f8fafc", color: "#374151" },
  bubble: { marginVertical: 6, padding: 14, borderRadius: 18, fontSize: 16, lineHeight: 22 },
  user: { alignSelf: "flex-end", backgroundColor: "#111827", color: "#fff" },
  assistant: { alignSelf: "flex-start", backgroundColor: "#eef2f7", color: "#111827" },
  input: { minHeight: 56, marginTop: 16, padding: 16, borderRadius: 24, backgroundColor: "#fff", fontSize: 16 },
  primary: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#111827" },
  primaryText: { color: "#fff", fontWeight: "700" },
  secondary: { minHeight: 44, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#fff" },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  success: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: "#dcfce7", color: "#166534" },
  confirmation: { marginTop: 12, padding: 12, borderRadius: 16, backgroundColor: "#ecfdf5", gap: 4 },
  confirmationTitle: { color: "#111827", fontWeight: "700" },
});
