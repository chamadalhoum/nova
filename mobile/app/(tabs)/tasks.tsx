import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch, ServiceDiscoveryResponse, ServiceRequest, Task } from "@/lib/api";
import { Badge, Button, Card, EmptyState, colors, statusLabel, styles as uiStyles } from "@/lib/ui";

function nextStep(task: Task) {
  if (task.status === "COMPLETED") return "No next step. This task is done.";
  if (task.status === "CANCELLED") return "No next step. This task was cancelled.";
  const serviceRequest = task.data?.service_request as { status?: string } | undefined;
  if (serviceRequest?.status === "CONFIRMED") return "Request confirmed. Real booking is not connected yet.";
  if (serviceRequest?.status === "PREPARED") return "Service request prepared. Review and confirm it.";
  if (task.data?.next_capability === "search_services") return "Search demo service options. Real booking is not connected yet.";
  return "Review the task details.";
}

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const [searchResults, setSearchResults] = useState<{ taskId: string; results: ServiceDiscoveryResponse["results"] } | null>(null);
  const { data, error } = useQuery({ queryKey: ["tasks"], queryFn: () => apiFetch<Task[]>("/api/v1/tasks") });
  const search = useMutation({
    mutationFn: (taskId: string) => apiFetch<ServiceDiscoveryResponse>(`/api/v1/tasks/${taskId}/search-services`, { method: "POST" }),
    onMutate: () => setSearchResults(null),
    onSuccess: (response, taskId) => setSearchResults({ taskId, results: response.results }),
  });
  const selectProvider = useMutation({
    mutationFn: ({ taskId, providerId }: { taskId: string; providerId: string }) => apiFetch<Task>(`/api/v1/tasks/${taskId}/select-provider`, { method: "POST", body: JSON.stringify({ provider_id: providerId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const confirmRequest = useMutation({
    mutationFn: (serviceRequestId: string) => apiFetch<ServiceRequest>(`/api/v1/service-requests/${serviceRequestId}/confirm`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={uiStyles.eyebrow}>Work queue</Text>
      <Text style={uiStyles.title}>Tasks</Text>
      <Text style={uiStyles.subtitle}>Track what NOVA understood, what needs review, and what is ready to confirm.</Text>
      {error && <Text style={uiStyles.error}>Login first to view tasks.</Text>}
      {data?.length === 0 && <EmptyState title="No tasks yet" description="Tell NOVA what you need to get done from the Home tab." />}
      {(data ?? []).map((item) => (
        <TaskCard key={item.id} task={item} search={search} selectProvider={selectProvider} confirmRequest={confirmRequest} searchResults={searchResults} />
      ))}
    </ScrollView>
  );
}

function TaskCard({ task, search, selectProvider, confirmRequest, searchResults }: { task: Task; search: ReturnType<typeof useMutation<ServiceDiscoveryResponse, Error, string>>; selectProvider: ReturnType<typeof useMutation<Task, Error, { taskId: string; providerId: string }>>; confirmRequest: ReturnType<typeof useMutation<ServiceRequest, Error, string>>; searchResults: { taskId: string; results: ServiceDiscoveryResponse["results"] } | null }) {
  const serviceRequest = task.data?.service_request as { id?: string; status?: string } | undefined;
  const selectedProvider = task.data?.selected_provider as { name?: string; location?: string; is_demo?: boolean } | undefined;
  const results = searchResults?.taskId === task.id ? searchResults.results : [];
  return (
    <Card>
      <Badge>{statusLabel(task.status)}</Badge>
      <Text style={styles.cardTitle}>{task.title}</Text>
      <Text style={styles.description}>{task.description}</Text>
      {task.due_date && <Text style={styles.meta}>Date: {task.due_date}</Text>}
      {task.data?.entities?.location && <Text style={styles.meta}>Area: {String(task.data.entities.location)}</Text>}
      <Text style={styles.next}>Next: {nextStep(task)}</Text>
      {selectedProvider && <Card tone="mist"><Text style={styles.sectionTitle}>Provider</Text><Text>{selectedProvider.name ?? "Not provided"}</Text><Text>Location: {selectedProvider.location ?? "Not provided"}</Text><Text>Demo provider: {selectedProvider.is_demo ? "Yes" : "No"}</Text></Card>}
      {serviceRequest && <Card tone="amber"><Text style={styles.sectionTitle}>{serviceRequest.status === "CONFIRMED" ? "Request confirmed" : "Service request prepared"}</Text><Text>Nothing has been booked yet.</Text>{serviceRequest.status === "PREPARED" && serviceRequest.id && <Button onPress={() => confirmRequest.mutate(serviceRequest.id!)} disabled={confirmRequest.isPending}>{confirmRequest.isPending ? "Confirming request..." : "Confirm request"}</Button>}</Card>}
      {task.data?.next_capability === "search_services" && <Text style={styles.demo}>Demo service discovery available. NOVA will not contact or book a provider.</Text>}
      {task.data?.next_capability === "search_services" && <Button onPress={() => search.mutate(task.id)} disabled={search.isPending}>{search.isPending ? "Searching options..." : "Search options"}</Button>}
      {results.length > 0 && <View style={styles.results}>{results.map((provider) => <Card key={provider.id} tone="mist"><Text style={styles.sectionTitle}>{provider.name}</Text><Text>{provider.location || "Location not provided"}</Text><Text>{provider.description}</Text><Text style={styles.demo}>Demo information only.</Text><Button variant="secondary" onPress={() => selectProvider.mutate({ taskId: task.id, providerId: provider.id })}>Select provider</Button></Card>)}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, backgroundColor: colors.bg, minHeight: "100%" },
  cardTitle: { marginTop: 10, color: colors.ink, fontSize: 20, fontWeight: "800" },
  description: { marginTop: 6, color: "#374151", lineHeight: 21 },
  meta: { marginTop: 6, color: "#4b5563" },
  next: { marginTop: 12, color: colors.ink, fontWeight: "700" },
  demo: { marginTop: 10, color: colors.amber },
  results: { marginTop: 4 },
  sectionTitle: { marginBottom: 4, color: colors.ink, fontWeight: "800" },
});
