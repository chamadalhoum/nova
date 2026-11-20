import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, clearTokens, saveTokens } from "@/lib/api";
import { Button, Card, Screen, colors, styles as uiStyles } from "@/lib/ui";

export default function ProfileScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function authenticate(path: "/api/v1/auth/login" | "/api/v1/auth/register", successMessage: string) {
    setPending(true);
    setError("");
    try {
      const tokens = await apiFetch<{ access_token: string; refresh_token: string }>(path, { method: "POST", body: JSON.stringify({ email, password }) });
      await saveTokens(tokens);
      setMessage(successMessage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Authentication failed.");
    } finally {
      setPending(false);
    }
  }

  async function logout() {
    await clearTokens();
    setMessage("Signed out locally.");
    setError("");
  }

  return (
    <Screen>
      <Text style={uiStyles.eyebrow}>Account</Text>
      <Text style={uiStyles.title}>Profile</Text>
      <Text style={uiStyles.subtitle}>Sign in to sync tasks, assets, and service request state.</Text>
      <Card>
        <TextInput accessibilityLabel="Email" placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput accessibilityLabel="Password" placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry />
        <Button onPress={() => authenticate("/api/v1/auth/login", "Signed in.")} disabled={pending}>{pending ? "Please wait..." : "Login"}</Button>
        <Button variant="secondary" onPress={() => authenticate("/api/v1/auth/register", "Registered and signed in.")} disabled={pending}>Create account</Button>
        <Button variant="secondary" onPress={logout}>Logout locally</Button>
        {message && <Text style={styles.message}>{message}</Text>}
        {error && <Text style={uiStyles.error}>{error}</Text>}
      </Card>
      <Card tone="mist"><Text style={styles.note}>NOVA stores tokens locally on this device through Expo SecureStore.</Text></Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 52, marginTop: 12, padding: 14, borderRadius: 22, backgroundColor: colors.bg },
  message: { marginTop: 14, color: colors.calm, fontWeight: "700" },
  note: { color: "#4b5563", lineHeight: 21 },
});
