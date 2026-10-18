import React, { useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Alert, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useGetAdminDashboard, useGetAdminResults } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { EmptyState, ErrorState, LoadingState, Page, Panel, SectionTitle } from "@/components/learning";
import { useAuth } from "@/store/auth";
import { useColors } from "@/hooks/useColors";
import type { AdminResult, AdminStats } from "@/types/content";
import { apiFetch } from "@/lib/apiFetch";

export default function AdminDashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "scoreboard">("overview");
  const [refreshing, setRefreshing] = useState(false);

  // Profile photo editing
  const [showPhotoEdit, setShowPhotoEdit] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [savingPhoto, setSavingPhoto] = useState(false);

  // Notification panel
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifBody, setNotifBody] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  // @ts-ignore
  const dashboardQuery = useGetAdminDashboard({ query: { staleTime: 0 } });
  // @ts-ignore
  const resultsQuery = useGetAdminResults({ query: { staleTime: 0 } });

  const stats = dashboardQuery.data as unknown as AdminStats | undefined;
  const results = (resultsQuery.data as unknown as { results?: AdminResult[] } | undefined)?.results ?? [];

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/results"] }),
    ]);
    setRefreshing(false);
  }

  const handleSavePhoto = async () => {
    if (!photoUrl.trim()) return;
    setSavingPhoto(true);
    try {
      await apiFetch("/api/admin/profile/photo", { method: "PATCH", body: JSON.stringify({ photoUrl: photoUrl.trim() }) });
      Alert.alert("✅", "Profile photo updated!");
      setShowPhotoEdit(false); setPhotoUrl("");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not update photo.");
    } finally { setSavingPhoto(false); }
  };

  const handleSendNotification = async () => {
    if (!notifTitle.trim() || !notifBody.trim()) return Alert.alert("Error", "Title aur message dono daalo");
    setSendingNotif(true);
    try {
      await apiFetch("/api/admin/notify-all", { method: "POST", body: JSON.stringify({ title: notifTitle.trim(), body: notifBody.trim() }) });
      Alert.alert("✅", "Notification send ho gayi!");
      setNotifTitle(""); setNotifBody(""); setShowNotifPanel(false);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Notification nahi gayi.");
    } finally { setSendingNotif(false); }
  };

  // Group results by test for scoreboard
  const scoreboardByTest = results.reduce<Record<string, AdminResult[]>>((acc, r) => {
    const key = r.testTitle ?? "Unknown Test";
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(r);
    return acc;
  }, {});

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={void onRefresh} tintColor={colors.primary} />}
    >
      {/* Header */}
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={16} color={colors.foreground} />
        <Text style={[styles.backText, { color: colors.foreground }]}>Profile</Text>
      </Pressable>

      {/* Admin Profile Header */}
      <View style={[styles.profileRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => setShowPhotoEdit(!showPhotoEdit)} style={styles.avatarWrap}>
          {(user as any)?.photoUrl ? (
            <Image source={{ uri: (user as any).photoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + "20" }]}>
              <Text style={{ fontSize: 26, fontWeight: "800", color: colors.primary }}>
                {(user?.name ?? "A").slice(0, 1).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.cameraBtn, { backgroundColor: colors.primary }]}>
            <Feather name="camera" size={11} color="#fff" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.adminName, { color: colors.foreground }]}>{user?.name ?? "Admin"}</Text>
          <Text style={[styles.adminEmail, { color: colors.mutedForeground }]}>{user?.email ?? ""}</Text>
          <View style={[styles.adminBadge, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="shield" size={11} color={colors.primary} />
            <Text style={[styles.adminBadgeText, { color: colors.primary }]}>UCI Administrator</Text>
          </View>
        </View>
      </View>

      {/* Profile Photo Edit Panel */}
      {showPhotoEdit && (
        <View style={[styles.notifPanel, { backgroundColor: colors.card, borderColor: "#6366f1" }]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>📷 Profile Photo Update</Text>
          <Text style={[styles.panelHint, { color: colors.mutedForeground }]}>Image URL ya Google Drive link paste karo</Text>
          <TextInput
            value={photoUrl} onChangeText={setPhotoUrl}
            placeholder="https://... ya Google Drive link"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.notifInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            autoCapitalize="none"
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => setShowPhotoEdit(false)}
              style={[styles.panelBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSavePhoto} disabled={savingPhoto}
              style={[styles.panelBtn, { flex: 1, backgroundColor: "#6366f1", opacity: savingPhoto ? 0.7 : 1 }]}>
              {savingPhoto ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Save Photo</Text>}
            </Pressable>
          </View>
        </View>
      )}

      <Text style={[styles.kicker, { color: colors.primary }]}>UCI ADMINISTRATION</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Manage students, content, and test results.</Text>

      {/* Quick Action Buttons */}
      <View style={styles.actionGrid}>
        <ActionCard label="Scheduled Tests" icon="clock" color="#ef4444" onPress={() => router.push("/admin-scheduled-tests")} />
        <ActionCard label="PYQ Papers" icon="layers" color="#10b981" onPress={() => router.push("/admin-pyq")} />
        <ActionCard label="Manage Tests" icon="edit-3" color="#8b5cf6" onPress={() => router.push("/admin-tests")} />
        <ActionCard label="Generate Test" icon="zap" color="#f59e0b" onPress={() => router.push("/admin-generate-test")} />
        <ActionCard label="Offers & Banners" icon="image" color="#ec4899" onPress={() => router.push("/admin-banners")} />
        <ActionCard label="Add Course" icon="book-open" color="#6366f1" onPress={() => router.push("/admin-add-course")} />
        <ActionCard label="Notes Manager" icon="file-text" color="#06b6d4" onPress={() => router.push("/admin-notes")} />
        <ActionCard label="Send Notification" icon="bell" color="#a855f7" onPress={() => setShowNotifPanel(!showNotifPanel)} />
        <ActionCard label="Edit Profile" icon="user" color="#0ea5e9" onPress={() => setShowPhotoEdit(!showPhotoEdit)} />
      </View>

      {/* Notification Panel */}
      {showNotifPanel && (
        <View style={[styles.notifPanel, { backgroundColor: colors.card, borderColor: "#8b5cf6" }]}>
          <Text style={[styles.panelTitle, { color: colors.foreground }]}>🔔 Send Notification to All Users</Text>
          <TextInput
            value={notifTitle} onChangeText={setNotifTitle}
            placeholder="Notification Title"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.notifInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
          />
          <TextInput
            value={notifBody} onChangeText={setNotifBody}
            placeholder="Message likhao..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[styles.notifInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border, minHeight: 70, textAlignVertical: "top" }]}
          />
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => setShowNotifPanel(false)}
              style={[styles.panelBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 13 }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleSendNotification} disabled={sendingNotif}
              style={[styles.panelBtn, { flex: 1, backgroundColor: "#8b5cf6", opacity: sendingNotif ? 0.7 : 1 }]}>
              {sendingNotif ? <ActivityIndicator color="#fff" size="small" /> : (
                <>
                  <Feather name="send" size={14} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>Send</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Stats Grid */}
      {dashboardQuery.isLoading ? <LoadingState label="Loading dashboard stats…" /> : null}
      {dashboardQuery.isError ? <ErrorState onRetry={() => void dashboardQuery.refetch()} label="Dashboard stats unavailable." /> : null}
      {stats ? (
        <View style={styles.statGrid}>
          <Stat label="Students" value={stats.students} icon="users" color="#6366f1" />
          <Stat label="Courses" value={stats.courses} icon="book-open" color="#10b981" />
          <Stat label="Study Notes" value={stats.notes} icon="file-text" color="#f59e0b" />
          <Stat label="Tests" value={stats.tests} icon="check-square" color="#ef4444" />
          <Stat label="Completed Tests" value={stats.attempts} icon="bar-chart-2" color="#8b5cf6" />
        </View>
      ) : null}

      {/* Tab Switcher */}
      <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Pressable onPress={() => setActiveTab("overview")} style={[styles.tab, activeTab === "overview" && { backgroundColor: colors.foreground }]}>
          <Text style={[styles.tabText, { color: activeTab === "overview" ? colors.background : colors.mutedForeground }]}>Recent Results</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab("scoreboard")} style={[styles.tab, activeTab === "scoreboard" && { backgroundColor: colors.foreground }]}>
          <Text style={[styles.tabText, { color: activeTab === "scoreboard" ? colors.background : colors.mutedForeground }]}>Scoreboard</Text>
        </Pressable>
      </View>

      {/* Results Loading/Error */}
      {resultsQuery.isLoading ? <LoadingState label="Loading student results…" /> : null}
      {resultsQuery.isError ? <ErrorState onRetry={() => void resultsQuery.refetch()} label="Student results couldn't load." /> : null}

      {activeTab === "overview" && !resultsQuery.isLoading && !resultsQuery.isError ? (
        <>
          {results.length === 0 ? <EmptyState title="No completed tests yet" description="Submitted test results will appear here." /> : null}
          {results.slice(0, 20).map((result, index) => (
            <Panel key={`${result.email}-${result.submittedAt}-${index}`} style={styles.resultCard}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.accentForeground }]}>{(result.studentName ?? "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.student, { color: colors.foreground }]}>{result.studentName}</Text>
                <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{result.email}</Text>
                <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{result.testTitle} · {result.score}/{result.totalQuestions} correct</Text>
              </View>
              <View style={styles.scoreWrap}>
                <Text style={[styles.score, { color: colors.primary }]}>{result.percentage}%</Text>
                <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>{result.accuracy}% acc</Text>
              </View>
            </Panel>
          ))}
        </>
      ) : null}

      {activeTab === "scoreboard" && !resultsQuery.isLoading && !resultsQuery.isError ? (
        <>
          {Object.keys(scoreboardByTest).length === 0 ? (
            <EmptyState title="No test results yet" description="Student scores will appear here after they take tests." />
          ) : null}
          {Object.entries(scoreboardByTest).map(([testTitle, testResults]) => (
            <View key={testTitle} style={{ marginBottom: 20 }}>
              <Text style={[styles.testGroupTitle, { color: colors.foreground }]}>{testTitle}</Text>
              <View style={[styles.tableHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.tableHead, { flex: 2, color: colors.mutedForeground }]}>Student</Text>
                <Text style={[styles.tableHead, { flex: 1, color: colors.mutedForeground }]}>Score</Text>
                <Text style={[styles.tableHead, { flex: 1, color: colors.mutedForeground }]}>%</Text>
                <Text style={[styles.tableHead, { flex: 1, color: colors.mutedForeground }]}>Acc.</Text>
              </View>
              {testResults.map((r, i) => (
                <View key={`${r.email}-${i}`} style={[styles.tableRow, { borderColor: colors.border, backgroundColor: i % 2 === 0 ? colors.card : colors.background }]}>
                  <View style={{ flex: 2 }}>
                    <Text style={[styles.tableCell, { color: colors.foreground, fontWeight: "700" }]} numberOfLines={1}>{r.studentName}</Text>
                    <Text style={[styles.tableCell, { color: colors.mutedForeground, fontSize: 9 }]} numberOfLines={1}>{r.email}</Text>
                  </View>
                  <Text style={[styles.tableCell, { flex: 1, color: colors.foreground }]}>{r.score}/{r.totalQuestions}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: colors.primary, fontWeight: "700" }]}>{r.percentage}%</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: colors.mutedForeground }]}>{r.accuracy}%</Text>
                </View>
              ))}
            </View>
          ))}
        </>
      ) : null}

      <Panel style={styles.notice}>
        <Feather name="refresh-cw" size={14} color={colors.primary} />
        <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>Pull down to refresh all data.</Text>
      </Panel>
    </ScrollView>
  );
}

function ActionCard({ label, icon, color, onPress }: { label: string; icon: any; color: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} style={[styles.actionCard, { backgroundColor: color + "15", borderColor: color + "30" }]}>
      <View style={[styles.actionIcon, { backgroundColor: color + "25" }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]}>{label}</Text>
    </Pressable>
  );
}

function Stat({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  const colors = useColors();
  return (
    <Panel style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon} size={15} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </Panel>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingVertical: 24, paddingBottom: 40 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 21 },
  backText: { fontSize: 13, fontWeight: "700" },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, borderRadius: 20, borderWidth: 1, padding: 14, marginBottom: 20 },
  avatarWrap: { position: "relative", width: 60, height: 60 },
  avatarImg: { width: 60, height: 60, borderRadius: 18 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  cameraBtn: { position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  adminName: { fontSize: 16, fontWeight: "800" },
  adminEmail: { fontSize: 11, marginTop: 2 },
  adminBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginTop: 6 },
  adminBadgeText: { fontSize: 10, fontWeight: "700" },
  kicker: { fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 5 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.8 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 16 },
  actionGrid: { flexDirection: "row", gap: 10, marginBottom: 18, flexWrap: "wrap" },
  actionCard: { width: "30%", alignItems: "center", borderRadius: 18, borderWidth: 1, paddingVertical: 16, gap: 8 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 10, fontWeight: "700", textAlign: "center" },
  notifPanel: { borderRadius: 18, borderWidth: 1.5, padding: 16, marginBottom: 18, gap: 10 },
  panelTitle: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  panelHint: { fontSize: 11, marginBottom: 4 },
  notifInput: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  panelBtn: { borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  statGrid: { flexDirection: "row", gap: 9, flexWrap: "wrap", marginBottom: 20 },
  stat: { width: "48%", padding: 13, minHeight: 100 },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 21, fontWeight: "800", marginTop: 9 },
  statLabel: { fontSize: 10, marginTop: 2 },
  tabRow: { flexDirection: "row", borderRadius: 14, borderWidth: 1, padding: 4, marginBottom: 16, gap: 4 },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 11, alignItems: "center" },
  tabText: { fontSize: 12, fontWeight: "700" },
  resultCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "800" },
  student: { fontSize: 12, fontWeight: "800" },
  resultMeta: { fontSize: 10, marginTop: 2 },
  scoreWrap: { alignItems: "flex-end" },
  score: { fontSize: 17, fontWeight: "800" },
  testGroupTitle: { fontSize: 13, fontWeight: "800", marginBottom: 8, marginTop: 4 },
  tableHeader: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginBottom: 2 },
  tableHead: { fontSize: 9, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  tableRow: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, alignItems: "center" },
  tableCell: { fontSize: 11 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  noticeText: { flex: 1, fontSize: 11, lineHeight: 17 },
});