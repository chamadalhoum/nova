"use client";

import { useMutation } from "@tanstack/react-query";
import React, { FormEvent, useEffect, useRef, useState } from "react";
import { Attachment, apiFetch, Task, uploadMessageAttachment } from "@/lib/api";
import { Badge, Button, Card, EmptyState, ErrorState, LinkButton, PageHeader } from "@/components/ui";

type Conversation = { id: string; title: string; messages?: { role: string; content: string }[] };
type AIResponse = {
  user_message: { id: string };
  state: string;
  assistant_message: { content: string; data: Record<string, unknown> };
  proposed_task?: { title: string; category: string; due_date?: string; location?: string; next_action?: string; suggested_capability?: string };
};

type MicState = "idle" | "requesting_permission" | "recording" | "processing" | "error";
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ["application/pdf", "text/plain"];

function categoryLabel(category?: string) {
  return (category || "task").replaceAll("_", " ");
}

export default function ChatPage() {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [latestAIResponse, setLatestAIResponse] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [micState, setMicState] = useState<MicState>("idle");
  const [micError, setMicError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<Attachment[]>([]);
  const [pendingAttachmentMessageId, setPendingAttachmentMessageId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognitionRef.current?.abort(), []);
  useEffect(() => {
    const conversationId = new URLSearchParams(window.location.search).get("conversation");
    if (!conversationId) return;
    let active = true;
    apiFetch<Conversation>(`/api/v1/conversations/${conversationId}`)
      .then((item) => {
        if (!active) return;
        setConversation(item);
        setMessages((item.messages || []).map((message) => ({ role: message.role, content: message.content })));
      })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : "Could not load this conversation."); });
    return () => { active = false; };
  }, []);

  async function uploadAttachment(messageId: string, file: File) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return uploadMessageAttachment(messageId, { file_name: file.name, content_type: file.type, content_base64: btoa(binary) });
  }

  const send = useMutation({
    mutationFn: async ({ content, files }: { content: string; files: File[] }) => {
      const active = conversation ?? await apiFetch<Conversation>("/api/v1/conversations", { method: "POST", body: JSON.stringify({}) });
      setConversation(active);
      const response = await apiFetch<AIResponse>(`/api/v1/conversations/${active.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content }),
      });
      const uploaded: Attachment[] = [];
      let uploadError: string | null = null;
      let failedFiles: File[] = [];
      for (const [index, file] of files.entries()) {
        try {
          uploaded.push(await uploadAttachment(response.user_message.id, file));
        } catch (err) {
          uploadError = err instanceof Error ? err.message : "Attachment upload failed.";
          failedFiles = files.slice(index);
          break;
        }
      }
      return { response, uploaded, uploadError, failedFiles };
    },
    onSuccess: (data, variables) => {
      const attachmentText = data.uploaded.length ? `\n${data.uploaded.length} attachment${data.uploaded.length > 1 ? "s" : ""} added.` : "";
      setMessages((current) => [...current, { role: "user", content: `${variables.content}${attachmentText}` }, { role: "assistant", content: data.response.assistant_message.content }]);
      setUploadedAttachments(data.uploaded);
      setLatestAIResponse(data.response);
      setCreatedTask(null);
      setInput("");
      setAttachments(data.failedFiles);
      setPendingAttachmentMessageId(data.uploadError ? data.response.user_message.id : null);
      setError(data.uploadError ? `${data.uploadError} Unuploaded files remain attached so you can retry or remove them.` : null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Something went wrong."),
  });

  const retryUpload = useMutation({
    mutationFn: async () => {
      if (!pendingAttachmentMessageId) throw new Error("No message is ready for attachment retry.");
      const uploaded: Attachment[] = [];
      let uploadError: string | null = null;
      let failedFiles: File[] = [];
      for (const [index, file] of attachments.entries()) {
        try {
          uploaded.push(await uploadAttachment(pendingAttachmentMessageId, file));
        } catch (err) {
          uploadError = err instanceof Error ? err.message : "Attachment upload failed.";
          failedFiles = attachments.slice(index);
          break;
        }
      }
      return { uploaded, uploadError, failedFiles };
    },
    onSuccess: (data) => {
      setUploadedAttachments((current) => [...current, ...data.uploaded]);
      setAttachments(data.failedFiles);
      setPendingAttachmentMessageId(data.uploadError ? pendingAttachmentMessageId : null);
      setError(data.uploadError ? `${data.uploadError} Unuploaded files remain attached so you can retry or remove them.` : null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Attachment upload failed."),
  });

  const confirm = useMutation({
    mutationFn: async () => {
      if (!conversation) throw new Error("No conversation is ready.");
      return apiFetch<Task>(`/api/v1/conversations/${conversation.id}/confirm-task`, { method: "POST" });
    },
    onSuccess: (task) => {
      setCreatedTask(task);
      setLatestAIResponse(null);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not create task."),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim()) return;
    send.mutate({ content: input.trim(), files: attachments });
  }

  function onFilesSelected(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: File[] = [];
    for (const file of Array.from(files)) {
      const allowed = file.type.startsWith("image/") || ALLOWED_ATTACHMENT_TYPES.includes(file.type);
      if (!allowed) {
        setError("This attachment type is not supported yet.");
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError("This attachment is too large. Maximum size is 5 MB.");
        continue;
      }
      next.push(file);
    }
    setAttachments((current) => [...current, ...next].slice(0, 4));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function toggleMicrophone() {
    setMicError(null);
    if (micState === "recording") {
      setMicState("processing");
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognition = (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition
      || (window as typeof window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicState("error");
      setMicError("Speech recognition is not supported in this browser. You can still type normally.");
      return;
    }
    setMicState("requesting_permission");
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onstart = () => setMicState("recording");
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript).filter(Boolean).join(" ").trim();
      if (transcript) setInput((current) => [current, transcript].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      setMicState("error");
      setMicError(event.error === "not-allowed" ? "Microphone permission was denied. You can still type normally." : "I could not transcribe that audio. Please try again or type your request.");
    };
    recognition.onend = () => setMicState((current) => current === "error" ? "error" : "idle");
    try {
      recognition.start();
    } catch {
      setMicState("error");
      setMicError("Microphone could not start. You can still type normally.");
    }
  }

  const waitingConfirmation = latestAIResponse?.state === "waiting_confirmation" && Boolean(latestAIResponse.proposed_task);

  return (
    <section className="mx-auto grid max-w-4xl gap-5">
      <PageHeader eyebrow="Chat" title="What can I help you get done?" description="Describe the outcome. NOVA will clarify, summarize, and ask before creating a task." />
      <Card className="p-4 sm:p-6">
      <div className="min-h-72 space-y-3 rounded-[1.5rem] bg-mist p-4" aria-live="polite">
        {messages.length === 0 ? (
          <EmptyState title="Start with a natural request" description="Try: Need AC repair in Ariana tomorrow. NOVA will not book or contact anyone without explicit support." />
        ) : (
          messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={message.role === "user" ? "text-right" : "text-left"}>
              <span className={`inline-block max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${message.role === "user" ? "bg-ink text-white" : "bg-white text-ink"}`}>
                {message.content}
              </span>
            </div>
          ))
        )}
        {send.isPending && <p className="text-sm text-gray-600">Understanding your request...</p>}
      </div>
      {waitingConfirmation && !createdTask && (
        <div className="mt-4 rounded-[1.5rem] border border-calm/20 bg-calm/10 p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-calm">I understood</p>
          {latestAIResponse?.proposed_task && (
            <div className="mt-3 grid gap-2 text-sm text-gray-800 sm:grid-cols-3">
              <p className="rounded-2xl bg-white/70 p-3"><span className="block text-xs text-gray-500">Service</span>Service: {categoryLabel(latestAIResponse.proposed_task.category)}</p>
              {latestAIResponse.proposed_task.location && <p className="rounded-2xl bg-white/70 p-3"><span className="block text-xs text-gray-500">Area</span>Area: {latestAIResponse.proposed_task.location}</p>}
              {latestAIResponse.proposed_task.due_date && <p className="rounded-2xl bg-white/70 p-3"><span className="block text-xs text-gray-500">When</span>Date: {latestAIResponse.proposed_task.due_date}</p>}
              <div className="sm:col-span-3">
              {latestAIResponse.proposed_task.suggested_capability === "search_services" && <p>I can search the service options available in NOVA.</p>}
              <p>No booking or provider contact will happen yet.</p>
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => confirm.mutate()} disabled={confirm.isPending}>
              {confirm.isPending ? "Preparing your task..." : latestAIResponse?.proposed_task?.suggested_capability === "search_services" ? "Create task, then search options" : "Confirm and create task"}
            </Button>
            <Button onClick={() => setLatestAIResponse(null)} variant="secondary" type="button">Modify</Button>
          </div>
        </div>
      )}
      {createdTask && <div className="mt-4 rounded-2xl bg-green-50 p-4 text-green-800"><p>Task created: {createdTask.title}</p><LinkButton className="mt-3" href={`/tasks/${createdTask.id}`}>Open task and search options</LinkButton></div>}
      {error && <div className="mt-4"><ErrorState message={error} /></div>}
      {attachments.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{attachments.map((file, index) => <Badge key={`${file.name}-${index}`} className="gap-2 bg-white text-ink">{file.name} <button type="button" className="ml-2 text-gray-500" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</button></Badge>)}</div>}
      {pendingAttachmentMessageId && attachments.length > 0 && <Button className="mt-3" type="button" variant="secondary" onClick={() => retryUpload.mutate()} disabled={retryUpload.isPending}>{retryUpload.isPending ? "Retrying attachments..." : "Retry attachment upload"}</Button>}
      {uploadedAttachments.length > 0 && <p className="mt-3 text-xs text-gray-500">Uploaded: {uploadedAttachments.map((item) => item.file_name).join(", ")}</p>}
      {micError && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{micError}</p>}
      <form onSubmit={onSubmit} className="mt-5 rounded-[1.5rem] border border-gray-200 bg-white p-2 shadow-sm">
        <div className="flex items-end gap-2">
          <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/*,application/pdf,text/plain" onChange={(event) => onFilesSelected(event.target.files)} />
          <Button type="button" variant="ghost" className="min-h-12 px-4" onClick={() => fileInputRef.current?.click()} aria-label="Add attachment">+</Button>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            className="min-h-12 flex-1 rounded-2xl bg-mist px-4 outline-none transition focus:ring-4 focus:ring-calm/10"
            placeholder="Write what you need..."
            aria-label="Write what you need"
          />
          <Button type="button" variant={micState === "recording" ? "primary" : "ghost"} className="min-h-12 px-4" onClick={toggleMicrophone} disabled={micState === "requesting_permission" || micState === "processing"} aria-label="Microphone">
            {micState === "recording" ? "Stop" : micState === "processing" ? "..." : "Mic"}
          </Button>
          <Button className="min-h-12 px-5" disabled={send.isPending || !input.trim()}>{send.isPending ? "Sending..." : "Send"}</Button>
        </div>
      </form>
      </Card>
    </section>
  );
}
