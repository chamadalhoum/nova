import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { apiFetch, ServiceDiscoveryResponse, ServiceRequest, Task } from "@/lib/api";

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "NOVA is preparing this task",
    NEEDS_INFO: "NOVA needs one detail",
    PLANNED: "NOVA has a plan",
    WAITING_CONFIRMATION: "Review and confirm",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Done",
    CANCELLED: "Cancelled",
  };
  return labels[status] || status.replaceAll("_", " ");
}

function nextStep(status: string) {
  if (status === "CONFIRMED") return "Track this task or mark it complete when done.";
  if (status === "COMPLETED") return "No next step. This task is done.";
  if (status === "CANCELLED") return "No next step. This task was cancelled.";
  return "Review the task details.";
}

function taskNextStep(task: Task) {
  if (["COMPLETED", "CANCELLED"].includes(task.status)) return nextStep(task.status);
  const serviceRequest = task.data?.service_request as { status?: string } | undefined;
  if (serviceRequest?.status === "CONFIRMED") return "Request confirmed. Real booking is not connected yet.";
  if (serviceRequest?.status === "PREPARED") return "Service request prepared. Review and confirm it.";
  if (task.data?.next_capability === "search_services") return "Search demo service options. Real booking is not connected yet.";
  return nextStep(task.status);
}

export default function TasksScreen() {
  const queryClient = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["tasks"], queryFn: () => apiFetch<Task[]>("/api/v1/tasks") });
  const search = useMutation({ mutationFn: (taskId: string) => apiFetch<ServiceDiscoveryResponse>(`/api/v1/tasks/${taskId}/search-services`, { method: "POST" }) });
  const selectProvider = useMutation({
    mutationFn: ({ taskId, providerId }: { taskId: string; providerId: string }) => apiFetch<Task>(`/api/v1/tasks/${taskId}/select-provider`, { method: "POST", body: JSON.stringify({ provider_id: providerId }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
  const confirmRequest = useMutation({
    mutationFn: (serviceRequestId: string) => apiFetch<ServiceRequest>(`/api/v1/service-requests/${serviceRequestId}/confirm`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  return <ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Tasks</Text>{error && <Text style={styles.error}>Login first to view tasks.</Text>}{data?.length === 0 && <Text style={styles.empty}>No tasks yet. Tell NOVA what you need to get done.</Text>}{(data ?? []).map((item) => { const serviceRequest = item.data?.service_request as { id?: string; status?: string } | undefined; const selectedProvider = item.data?.selected_provider as { name?: string; location?: string; is_demo?: boolean } | undefined; return <View key={item.id} style={styles.card}><Text style={styles.status}>{statusLabel(item.status)}</Text><Text style={styles.cardTitle}>{item.title}</Text><Text>{item.description}</Text>{item.due_date && <Text style={styles.meta}>Date: {item.due_date}</Text>}{item.data?.entities?.location && <Text style={styles.meta}>Area: {item.data.entities.location}</Text>}<Text style={styles.next}>Next: {taskNextStep(item)}</Text>{selectedProvider && <View style={styles.requestBox}><Text style={styles.sectionTitle}>Provider</Text><Text>{selectedProvider.name ?? "Not provided"}</Text><Text>Location: {selectedProvider.location ?? "Not provided"}</Text><Text>Demo provider: {selectedProvider.is_demo ? "Yes" : "No"}</Text></View>}{serviceRequest && <View style={styles.requestBox}><Text style={styles.sectionTitle}>{serviceRequest.status === "CONFIRMED" ? "Request confirmed" : "Service request prepared"}</Text><Text>Nothing has been booked yet.</Text>{serviceRequest.status === "PREPARED" && serviceRequest.id && <Pressable accessibilityRole="button" style={styles.primary} onPress={() => confirmRequest.mutate(serviceRequest.id!)}><Text style={styles.primaryText}>{confirmRequest.isPending ? "Confirming request..." : "Confirm request"}</Text></Pressable>}</View>}{item.data?.next_capability === "search_services" && <><Text style={styles.demo}>Demo service discovery available. NOVA will not contact or book a provider.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={() => search.mutate(item.id)}><Text style={styles.primaryText}>{search.isPending ? "Searching service options..." : "Search options"}</Text></Pressable></>}{search.data && search.variables === item.id && <View style={styles.results}>{search.data.results.length === 0 && <Text>No demo providers found for this service and location. Your task is still saved.</Text>}{search.data.results.map((provider) => <View key={provider.id} style={styles.providerCard}><Text style={styles.cardTitle}>{provider.name}</Text><Text>{provider.description}</Text><Text style={styles.meta}>Location: {provider.location}</Text><Text style={styles.meta}>Service: {provider.category.replaceAll("_", " ")}</Text><Text style={styles.demo}>Demo information. Not real-time availability.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={() => selectProvider.mutate({ taskId: item.id, providerId: provider.id })}><Text style={styles.primaryText}>{selectProvider.isPending ? "Preparing request..." : "Select"}</Text></Pressable></View>)}</View>}</View>; })}</ScrollView>;
}

const styles = StyleSheet.create({ container: { padding: 20, paddingTop: 64, backgroundColor: "#f5f7fb", minHeight: "100%" }, title: { fontSize: 32, fontWeight: "700" }, empty: { marginTop: 24, padding: 20, borderRadius: 24, backgroundColor: "#fff" }, error: { marginTop: 12, color: "#991b1b" }, card: { marginTop: 14, padding: 18, borderRadius: 24, backgroundColor: "#fff" }, status: { color: "#476a6f", fontWeight: "700" }, cardTitle: { marginTop: 8, fontSize: 20, fontWeight: "700" }, meta: { marginTop: 6, color: "#4b5563" }, next: { marginTop: 10, color: "#111827", fontWeight: "600" }, demo: { marginTop: 8, color: "#92400e" }, primary: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#111827" }, primaryText: { color: "#fff", fontWeight: "700" }, results: { marginTop: 12, gap: 12 }, providerCard: { padding: 14, borderRadius: 20, backgroundColor: "#f8fafc" }, requestBox: { marginTop: 12, padding: 12, borderRadius: 18, backgroundColor: "#fef3c7", gap: 4 }, sectionTitle: { fontWeight: "700" } });
