import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export const colors = {
  bg: "#f5f7fb",
  ink: "#111827",
  calm: "#476a6f",
  mist: "#eef2f7",
  white: "#ffffff",
  amber: "#92400e",
  danger: "#991b1b",
};

export function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "To do",
    NEEDS_INFO: "Needs info",
    PLANNED: "Planned",
    SEARCHING: "Searching",
    WAITING_CONFIRMATION: "Needs confirmation",
    CONFIRMED: "Confirmed",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    FAILED: "Failed",
    PREPARED: "Prepared",
  };
  return labels[status] || status.replaceAll("_", " ");
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "mist" | "amber" }) {
  return <View style={[styles.card, tone === "mist" && styles.mistCard, tone === "amber" && styles.amberCard]}>{children}</View>;
}

export function Button({ children, onPress, variant = "primary", disabled = false }: { children: ReactNode; onPress?: () => void; variant?: "primary" | "secondary"; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.button, variant === "secondary" && styles.secondaryButton, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, variant === "secondary" && styles.secondaryButtonText]}>{children}</Text>
    </Pressable>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <Text style={styles.badge}>{children}</Text>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card tone="mist"><Text style={styles.emptyTitle}>{title}</Text>{description && <Text style={styles.muted}>{description}</Text>}</Card>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, padding: 20, paddingTop: 64, backgroundColor: colors.bg },
  eyebrow: { color: colors.calm, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase" },
  title: { marginTop: 8, fontSize: 34, lineHeight: 40, fontWeight: "800", color: colors.ink },
  subtitle: { marginTop: 10, color: "#4b5563", fontSize: 16, lineHeight: 23 },
  card: { marginTop: 16, padding: 18, borderRadius: 26, backgroundColor: colors.white },
  mistCard: { backgroundColor: colors.mist },
  amberCard: { backgroundColor: "#fef3c7" },
  button: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: colors.ink, paddingHorizontal: 16 },
  secondaryButton: { backgroundColor: colors.white, borderWidth: 1, borderColor: "#e5e7eb" },
  disabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontWeight: "800" },
  secondaryButtonText: { color: colors.ink },
  badge: { alignSelf: "flex-start", overflow: "hidden", borderRadius: 999, backgroundColor: colors.mist, paddingHorizontal: 10, paddingVertical: 5, color: colors.calm, fontSize: 12, fontWeight: "800" },
  emptyTitle: { color: colors.ink, fontWeight: "800" },
  muted: { marginTop: 6, color: "#6b7280", lineHeight: 21 },
  error: { marginTop: 12, color: colors.danger },
});
