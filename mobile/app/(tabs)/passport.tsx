import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { apiFetch } from "@/lib/api";
import { Badge, Button, Card, EmptyState, colors, styles as uiStyles } from "@/lib/ui";

type Asset = { id: string; name: string; brand?: string | null };

export default function PassportScreen() {
  const assets = useQuery({ queryKey: ["assets"], queryFn: () => apiFetch<Asset[]>("/api/v1/assets") });
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function add() {
    if (!name.trim()) return;
    setError("");
    try {
      await apiFetch("/api/v1/assets", { method: "POST", body: JSON.stringify({ name, type: "appliance" }) });
      setName("");
      assets.refetch();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add this asset.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={uiStyles.eyebrow}>Home memory</Text>
      <Text style={uiStyles.title}>Passport</Text>
      <Text style={uiStyles.subtitle}>Add simple assets so future tasks have better context.</Text>
      <Card>
        <TextInput accessibilityLabel="Asset name" style={styles.input} placeholder="Air conditioner" value={name} onChangeText={setName} />
        <Button onPress={add}>Add asset</Button>
        {error && <Text style={uiStyles.error}>{error}</Text>}
      </Card>
      {assets.data?.length === 0 && <EmptyState title="No assets yet" description="Add an appliance or home item you may need help with later." />}
      {assets.data?.map((asset) => <Card key={asset.id}><Badge>Asset</Badge><Text style={styles.assetName}>{asset.name}</Text>{asset.brand && <Text style={styles.meta}>Brand: {asset.brand}</Text>}</Card>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 64, backgroundColor: colors.bg, minHeight: "100%" },
  input: { minHeight: 52, padding: 14, borderRadius: 22, backgroundColor: colors.bg },
  assetName: { marginTop: 8, color: colors.ink, fontSize: 20, fontWeight: "800" },
  meta: { marginTop: 6, color: "#6b7280" },
});
