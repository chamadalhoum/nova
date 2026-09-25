import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch, clearTokens, saveTokens } from "@/lib/api";

export default function ProfileScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  async function register() { const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ email, password }) }); await saveTokens(tokens); setMessage("Registered and signed in."); }
  async function login() { const tokens = await apiFetch<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }); await saveTokens(tokens); setMessage("Signed in."); }
  async function logout() { await clearTokens(); setMessage("Signed out locally."); }
  return <View style={styles.container}><Text style={styles.title}>Profile</Text><TextInput accessibilityLabel="Email" placeholder="Email" style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" /><TextInput accessibilityLabel="Password" placeholder="Password" style={styles.input} value={password} onChangeText={setPassword} secureTextEntry /><Pressable style={styles.primary} onPress={login}><Text style={styles.primaryText}>Login</Text></Pressable><Pressable style={styles.secondary} onPress={register}><Text>Create account</Text></Pressable><Pressable style={styles.secondary} onPress={logout}><Text>Logout locally</Text></Pressable><Text style={styles.message}>{message}</Text></View>;
}

const styles = StyleSheet.create({ container: { flex: 1, padding: 20, paddingTop: 64, backgroundColor: "#f5f7fb" }, title: { fontSize: 32, fontWeight: "700" }, input: { minHeight: 52, marginTop: 14, padding: 14, borderRadius: 22, backgroundColor: "#fff" }, primary: { minHeight: 48, marginTop: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#111827" }, primaryText: { color: "#fff", fontWeight: "700" }, secondary: { minHeight: 48, marginTop: 10, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#fff" }, message: { marginTop: 14, color: "#476a6f" } });
