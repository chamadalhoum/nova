import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "@/lib/api";

type Asset = { id: string; name: string; brand?: string | null };

export default function PassportScreen() {
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/api/v1/assets") });
  const [name, setName] = useState("");
  async function add() { if (!name.trim()) return; await apiFetch("/api/v1/assets", { method: "POST", body: JSON.stringify({ name, type: "appliance" }) }); setName(""); assets.refetch(); }
  return <View style={styles.container}><Text style={styles.title}>Passport</Text><Text style={styles.note}>Add simple assets for future context.</Text><TextInput style={styles.input} placeholder="Air conditioner" value={name} onChangeText={setName} /><Pressable style={styles.primary} onPress={add}><Text style={styles.primaryText}>Add asset</Text></Pressable>{assets.data?.map((asset) => <Text key={asset.id} style={styles.card}>{asset.name}</Text>)}</View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20, paddingTop: 64, backgroundColor: "#f5f7fb" }, title: { fontSize: 32, fontWeight: "700" }, note: { marginTop: 8, color: "#6b7280" }, input: { minHeight: 52, marginTop: 18, padding: 14, borderRadius: 22, backgroundColor: "#fff" }, primary: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#111827" }, primaryText: { color: "#fff", fontWeight: "700" }, card: { marginTop: 12, padding: 16, borderRadius: 20, backgroundColor: "#fff" } });
