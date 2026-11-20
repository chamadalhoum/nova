import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { apiFetch, Capability, Provider } from "@/lib/api";
import { Badge, Card, EmptyState, Screen, colors, styles as uiStyles } from "@/lib/ui";

export default function DiscoverScreen() {
  const { data } = useQuery({ queryKey: ["providers"], queryFn: () => apiFetch<Provider[]>("/api/v1/providers") });
  const capabilities = useQuery({ queryKey: ["capabilities"], queryFn: () => apiFetch<Capability[]>("/api/v1/capabilities") });
  const active = capabilities.data?.filter((capability) => capability.enabled) ?? [];
  const comingSoon = capabilities.data?.filter((capability) => !capability.enabled) ?? [];

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={<Header active={active} comingSoon={comingSoon} />}
        ListEmptyComponent={<EmptyState title="No providers listed" description="NOVA can still help structure your request." />}
        renderItem={({ item }) => <ProviderCard provider={item} />}
      />
    </Screen>
  );
}

function Header({ active, comingSoon }: { active: Capability[]; comingSoon: Capability[] }) {
  return (
    <View>
      <Text style={uiStyles.eyebrow}>Capabilities</Text>
      <Text style={uiStyles.title}>Discover</Text>
      <Text style={uiStyles.subtitle}>What NOVA can actually help with today. Demo providers are clearly marked.</Text>
      <Card>
        <Text style={styles.sectionTitle}>Available now</Text>
        {active.length === 0 && <Text style={styles.line}>Choose something NOVA can help you with.</Text>}
        {active.map((capability) => <Text key={capability.name} style={styles.line}>- {capability.description}</Text>)}
        <Text style={styles.sectionTitle}>Coming soon</Text>
        {comingSoon.map((capability) => <Text key={capability.name} style={styles.line}>- {capability.description}</Text>)}
      </Card>
      <Card tone="mist">
        <Text style={styles.sectionTitle}>No fake commerce</Text>
        <Text style={styles.line}>No live availability, ratings, prices, reviews, payments, or booking yet.</Text>
      </Card>
    </View>
  );
}

function ProviderCard({ provider }: { provider: Provider }) {
  return (
    <Card>
      <Badge>{provider.demo ? "Demo provider" : "Provider"}</Badge>
      <Text style={styles.cardTitle}>{provider.name}</Text>
      <Text style={styles.line}>{provider.description || "Description not provided"}</Text>
      <Text style={styles.services}>Location: {provider.location || "Not provided"}</Text>
      <Text style={styles.services}>Services: {provider.services.length ? provider.services.join(", ") : "Not provided"}</Text>
      <Text style={styles.services}>Availability: Not provided</Text>
      <Text style={styles.services}>Price: Not provided</Text>
      <Text style={styles.demoNote}>Demo information only. No real booking will be made.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { marginTop: 8, color: colors.ink, fontSize: 18, fontWeight: "800" },
  line: { marginTop: 6, color: "#374151", lineHeight: 20 },
  cardTitle: { marginTop: 8, color: colors.ink, fontSize: 20, fontWeight: "800" },
  services: { marginTop: 8, color: colors.calm },
  demoNote: { marginTop: 8, color: "#6b7280", fontSize: 12 },
});
