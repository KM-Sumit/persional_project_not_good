import React, { useState, useEffect, useCallback } from "react";
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View, Switch, Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/store/auth";

const API = process.env.EXPO_PUBLIC_DOMAIN ?? "http://localhost:5000";

async function apiFetch(path: string, token: string, method = "GET", body?: object) {
  const r = await fetch(`${API}/api/admin${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.message ?? `Error ${r.status}`);
  return data;
}

function useList<T>(path: string, token: string, deps: any[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refetch = useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await apiFetch(path, token); setItems(Object.values(d)[0] as T[]); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [path, token, ...deps]);
  useEffect(() => { refetch(); }, [refetch]);
  return { items, loading, error, refetch };
}

// ── Generic field row ──
function Row({ label, value, onChange, placeholder, multiline }: any) {
  const colors = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[f.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground} multiline={multiline}
        style={[f.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border, height: multiline ? 80 : 44 }]} />
    </View>
  );
}
const f = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "700", marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 },
  input: { borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
});

function Btn({ label, color, onPress, icon }: { label: string; color: string; onPress: () => void; icon?: any }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [bt.btn, { backgroundColor: color, opacity: pressed ? 0.85 : 1 }]}>
      {icon && <Feather name={icon} size={14} color="#fff" />}
      <Text style={bt.txt}>{label}</Text>
    </Pressable>
  );
}
const bt = StyleSheet.create({
  btn: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 },
  txt: { color: "#fff", fontSize: 12, fontWeight: "800" },
});

type Section = { id: number; name: string; icon: string; description: string; isActive: boolean; displayOrder: number };
type Exam    = { id: number; sectionId: number; sectionName: string; name: string; icon: string; description: string; isActive: boolean; displayOrder: number };
type Subject = { id: number; examId: number; examName: string; name: string; description: string; isActive: boolean; displayOrder: number };
type ExamNote = { id: number; examId: number; examName: string; subjectId: number | null; subjectName: string | null; title: string; description: string; pdfUrl: string; isPublished: boolean; createdAt: string };

type Tab = "sections" | "exams" | "subjects" | "notes";

export default function AdminNotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth() as any;
  const tok = token ?? "";

  const [tab, setTab] = useState<Tab>("sections");
  const [migrated, setMigrated] = useState(false);
  const [migrating, setMigrating] = useState(false);

  // ── Sections ──
  const secQ = useList<Section>("/notes/sections", tok);
  const [newSec, setNewSec] = useState({ name: "", icon: "📚", description: "" });
  const [savingSec, setSavingSec] = useState(false);

  // ── Exams ──
  const [selSectionId, setSelSectionId] = useState<number | null>(null);
  const exQ = useList<Exam>(`/notes/exams${selSectionId ? `?sectionId=${selSectionId}` : ""}`, tok, [selSectionId]);
  const [newEx, setNewEx] = useState({ sectionId: "", name: "", icon: "📝", description: "" });
  const [savingEx, setSavingEx] = useState(false);

  // ── Subjects ──
  const [selExamId, setSelExamId] = useState<number | null>(null);
  const subQ = useList<Subject>(`/notes/subjects${selExamId ? `?examId=${selExamId}` : ""}`, tok, [selExamId]);
  const [newSub, setNewSub] = useState({ examId: "", name: "", description: "" });
  const [savingSub, setSavingSub] = useState(false);

  // ── Notes ──
  const [selExamIdN, setSelExamIdN] = useState<number | null>(null);
  const noteQ = useList<ExamNote>(`/notes/exam-notes${selExamIdN ? `?examId=${selExamIdN}` : ""}`, tok, [selExamIdN]);
  const [newNote, setNewNote] = useState({ examId: "", subjectId: "", title: "", description: "", pdfUrl: "", tags: "", isPublished: false });
  const [savingNote, setSavingNote] = useState(false);

  // ── Migration ──
  const runMigration = async () => {
    setMigrating(true);
    try {
      await apiFetch("/migrate-notes", tok, "POST");
      setMigrated(true);
      Alert.alert("✅ Success", "Tables created! Refresh the lists.");
      secQ.refetch();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally { setMigrating(false); }
  };

  const confirm = (msg: string, onOk: () => void) => {
    if (Platform.OS === "web") { if (window.confirm(msg)) onOk(); }
    else Alert.alert("Confirm", msg, [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: onOk }]);
  };

  const paddingTop = Platform.OS === "web" ? 60 : insets.top + 8;
  const paddingBottom = Platform.OS === "web" ? 100 : Math.max(100, insets.bottom + 80);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop, paddingBottom }}>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </Pressable>
        <Text style={[pg.title, { color: colors.foreground }]}>Manage Notes</Text>
      </View>
      <Text style={[pg.sub, { color: colors.mutedForeground }]}>Sections → Exams → Subjects → PDF Notes</Text>

      {/* Migration Banner */}
      {!migrated && (
        <View style={[pg.migBanner]}>
          <Text style={{ color: "#92400e", fontSize: 12, flex: 1 }}>Run DB migration to create notes tables (first time only)</Text>
          {migrating ? <ActivityIndicator color="#D97706" /> : <Btn label="Run Migration" color="#D97706" onPress={runMigration} icon="database" />}
        </View>
      )}

      {/* Tabs */}
      <View style={pg.tabs}>
        {(["sections", "exams", "subjects", "notes"] as Tab[]).map(t => (
          <Pressable key={t} onPress={() => setTab(t)} style={[pg.tab, { backgroundColor: tab === t ? "#D97706" : colors.card, borderColor: colors.border }]}>
            <Text style={[pg.tabTxt, { color: tab === t ? "#fff" : colors.mutedForeground }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </Pressable>
        ))}
      </View>

      {/* ── SECTIONS TAB ── */}
      {tab === "sections" && (
        <View>
          <Text style={[pg.sectionHd, { color: colors.foreground }]}>Add Exam Section</Text>
          <Row label="Section Name" value={newSec.name} onChange={(v: string) => setNewSec(p => ({ ...p, name: v }))} placeholder="e.g. SSC, Banking, Railway" />
          <Row label="Icon (emoji)" value={newSec.icon} onChange={(v: string) => setNewSec(p => ({ ...p, icon: v }))} placeholder="📚" />
          <Row label="Description (optional)" value={newSec.description} onChange={(v: string) => setNewSec(p => ({ ...p, description: v }))} placeholder="Short description..." multiline />
          <Btn label={savingSec ? "Saving..." : "Add Section"} color="#D97706" icon="plus" onPress={async () => {
            if (!newSec.name) return Alert.alert("Error", "Name required");
            setSavingSec(true);
            try { await apiFetch("/notes/sections", tok, "POST", newSec); setNewSec({ name: "", icon: "📚", description: "" }); secQ.refetch(); }
            catch (e: any) { Alert.alert("Error", e.message); }
            finally { setSavingSec(false); }
          }} />
          <Text style={[pg.sectionHd, { color: colors.foreground, marginTop: 20 }]}>All Sections ({secQ.items.length})</Text>
          {secQ.loading && <ActivityIndicator color="#D97706" style={{ marginTop: 10 }} />}
          {secQ.items.map(s => (
            <View key={s.id} style={[pg.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>{s.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[pg.itemTitle, { color: colors.foreground }]}>{s.name}</Text>
                <Text style={[pg.itemSub, { color: colors.mutedForeground }]}>{s.description || "No description"}</Text>
              </View>
              <Switch value={s.isActive} onValueChange={async (v) => {
                await apiFetch(`/notes/sections/${s.id}`, tok, "PATCH", { isActive: v }).catch(() => {});
                secQ.refetch();
              }} trackColor={{ true: "#D97706" }} />
              <Pressable onPress={() => confirm("Delete this section and all its exams/notes?", async () => {
                await apiFetch(`/notes/sections/${s.id}`, tok, "DELETE").catch(() => {});
                secQ.refetch();
              })} hitSlop={8}><Feather name="trash-2" size={16} color="#ef4444" /></Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ── EXAMS TAB ── */}
      {tab === "exams" && (
        <View>
          <Text style={[pg.sectionHd, { color: colors.foreground }]}>Add Exam</Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={[f.label, { color: colors.mutedForeground }]}>Select Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {secQ.items.map(s => (
                <Pressable key={s.id} onPress={() => { setNewEx(p => ({ ...p, sectionId: String(s.id) })); setSelSectionId(s.id); }}
                  style={[pg.pill, { backgroundColor: String(s.id) === newEx.sectionId ? "#D97706" : colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: String(s.id) === newEx.sectionId ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>{s.icon} {s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Row label="Exam Name" value={newEx.name} onChange={(v: string) => setNewEx(p => ({ ...p, name: v }))} placeholder="e.g. SSC CGL, IBPS PO" />
          <Row label="Icon (emoji)" value={newEx.icon} onChange={(v: string) => setNewEx(p => ({ ...p, icon: v }))} placeholder="📝" />
          <Row label="Description (optional)" value={newEx.description} onChange={(v: string) => setNewEx(p => ({ ...p, description: v }))} placeholder="Short description..." multiline />
          <Btn label={savingEx ? "Saving..." : "Add Exam"} color="#6366f1" icon="plus" onPress={async () => {
            if (!newEx.sectionId || !newEx.name) return Alert.alert("Error", "Select section and enter name");
            setSavingEx(true);
            try { await apiFetch("/notes/exams", tok, "POST", { ...newEx, sectionId: Number(newEx.sectionId) }); setNewEx(p => ({ ...p, name: "", description: "" })); exQ.refetch(); }
            catch (e: any) { Alert.alert("Error", e.message); }
            finally { setSavingEx(false); }
          }} />
          <Text style={[pg.sectionHd, { color: colors.foreground, marginTop: 20 }]}>All Exams ({exQ.items.length})</Text>
          {exQ.loading && <ActivityIndicator color="#6366f1" style={{ marginTop: 10 }} />}
          {exQ.items.map(e => (
            <View key={e.id} style={[pg.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20 }}>{e.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[pg.itemTitle, { color: colors.foreground }]}>{e.name}</Text>
                <Text style={[pg.itemSub, { color: colors.mutedForeground }]}>{e.sectionName}</Text>
              </View>
              <Switch value={e.isActive} onValueChange={async (v) => {
                await apiFetch(`/notes/exams/${e.id}`, tok, "PATCH", { isActive: v }).catch(() => {});
                exQ.refetch();
              }} trackColor={{ true: "#6366f1" }} />
              <Pressable onPress={() => confirm("Delete this exam and all its notes?", async () => {
                await apiFetch(`/notes/exams/${e.id}`, tok, "DELETE").catch(() => {});
                exQ.refetch();
              })} hitSlop={8}><Feather name="trash-2" size={16} color="#ef4444" /></Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ── SUBJECTS TAB ── */}
      {tab === "subjects" && (
        <View>
          <Text style={[pg.sectionHd, { color: colors.foreground }]}>Add Subject</Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={[f.label, { color: colors.mutedForeground }]}>Select Exam</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {exQ.items.map(e => (
                <Pressable key={e.id} onPress={() => { setNewSub(p => ({ ...p, examId: String(e.id) })); setSelExamId(e.id); }}
                  style={[pg.pill, { backgroundColor: String(e.id) === newSub.examId ? "#10b981" : colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: String(e.id) === newSub.examId ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>{e.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <Row label="Subject Name" value={newSub.name} onChange={(v: string) => setNewSub(p => ({ ...p, name: v }))} placeholder="e.g. Reasoning, Mathematics" />
          <Row label="Description (optional)" value={newSub.description} onChange={(v: string) => setNewSub(p => ({ ...p, description: v }))} placeholder="Short description..." multiline />
          <Btn label={savingSub ? "Saving..." : "Add Subject"} color="#10b981" icon="plus" onPress={async () => {
            if (!newSub.examId || !newSub.name) return Alert.alert("Error", "Select exam and enter subject name");
            setSavingSub(true);
            try { await apiFetch("/notes/subjects", tok, "POST", { ...newSub, examId: Number(newSub.examId) }); setNewSub(p => ({ ...p, name: "", description: "" })); subQ.refetch(); }
            catch (e: any) { Alert.alert("Error", e.message); }
            finally { setSavingSub(false); }
          }} />
          <Text style={[pg.sectionHd, { color: colors.foreground, marginTop: 20 }]}>All Subjects ({subQ.items.length})</Text>
          {subQ.loading && <ActivityIndicator color="#10b981" style={{ marginTop: 10 }} />}
          {subQ.items.map(s => (
            <View key={s.id} style={[pg.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={{ fontSize: 20 }}>📖</Text>
              <View style={{ flex: 1 }}>
                <Text style={[pg.itemTitle, { color: colors.foreground }]}>{s.name}</Text>
                <Text style={[pg.itemSub, { color: colors.mutedForeground }]}>{s.examName}</Text>
              </View>
              <Switch value={s.isActive} onValueChange={async (v) => {
                await apiFetch(`/notes/subjects/${s.id}`, tok, "PATCH", { isActive: v }).catch(() => {});
                subQ.refetch();
              }} trackColor={{ true: "#10b981" }} />
              <Pressable onPress={() => confirm("Delete this subject?", async () => {
                await apiFetch(`/notes/subjects/${s.id}`, tok, "DELETE").catch(() => {});
                subQ.refetch();
              })} hitSlop={8}><Feather name="trash-2" size={16} color="#ef4444" /></Pressable>
            </View>
          ))}
        </View>
      )}

      {/* ── NOTES TAB ── */}
      {tab === "notes" && (
        <View>
          <Text style={[pg.sectionHd, { color: colors.foreground }]}>Upload PDF Note</Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={[f.label, { color: colors.mutedForeground }]}>Select Exam</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {exQ.items.map(e => (
                <Pressable key={e.id} onPress={() => { setNewNote(p => ({ ...p, examId: String(e.id), subjectId: "" })); setSelExamIdN(e.id); }}
                  style={[pg.pill, { backgroundColor: String(e.id) === newNote.examId ? "#f59e0b" : colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: String(e.id) === newNote.examId ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>{e.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          {newNote.examId && subQ.items.filter(s => s.examId === Number(newNote.examId)).length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <Text style={[f.label, { color: colors.mutedForeground }]}>Subject (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={() => setNewNote(p => ({ ...p, subjectId: "" }))}
                  style={[pg.pill, { backgroundColor: !newNote.subjectId ? "#f59e0b" : colors.card, borderColor: colors.border }]}>
                  <Text style={{ color: !newNote.subjectId ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>All Subjects</Text>
                </Pressable>
                {subQ.items.filter(s => String(s.examId) === newNote.examId).map(s => (
                  <Pressable key={s.id} onPress={() => setNewNote(p => ({ ...p, subjectId: String(s.id) }))}
                    style={[pg.pill, { backgroundColor: String(s.id) === newNote.subjectId ? "#f59e0b" : colors.card, borderColor: colors.border }]}>
                    <Text style={{ color: String(s.id) === newNote.subjectId ? "#fff" : colors.foreground, fontSize: 12, fontWeight: "700" }}>{s.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          <Row label="Note Title" value={newNote.title} onChange={(v: string) => setNewNote(p => ({ ...p, title: v }))} placeholder="e.g. Reasoning Chapter 1 Notes" />
          <Row label="PDF URL (Google Drive / S3 / etc.)" value={newNote.pdfUrl} onChange={(v: string) => setNewNote(p => ({ ...p, pdfUrl: v }))} placeholder="https://..." />
          <Row label="Description (optional)" value={newNote.description} onChange={(v: string) => setNewNote(p => ({ ...p, description: v }))} placeholder="What is covered in these notes..." multiline />
          <Row label="Tags (optional, comma separated)" value={newNote.tags} onChange={(v: string) => setNewNote(p => ({ ...p, tags: v }))} placeholder="reasoning, chapter-1, shortcuts" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Switch value={newNote.isPublished} onValueChange={(v) => setNewNote(p => ({ ...p, isPublished: v }))} trackColor={{ true: "#f59e0b" }} />
            <Text style={[f.label, { color: colors.mutedForeground, marginBottom: 0 }]}>Publish immediately</Text>
          </View>
          <Btn label={savingNote ? "Saving..." : "Save Note"} color="#f59e0b" icon="save" onPress={async () => {
            if (!newNote.examId || !newNote.title || !newNote.pdfUrl) return Alert.alert("Error", "Exam, title and PDF URL are required");
            setSavingNote(true);
            try {
              await apiFetch("/notes/exam-notes", tok, "POST", {
                examId: Number(newNote.examId),
                subjectId: newNote.subjectId ? Number(newNote.subjectId) : null,
                title: newNote.title, description: newNote.description,
                pdfUrl: newNote.pdfUrl, tags: newNote.tags,
                isPublished: newNote.isPublished,
              });
              setNewNote(p => ({ ...p, title: "", description: "", pdfUrl: "", tags: "", isPublished: false }));
              noteQ.refetch();
            } catch (e: any) { Alert.alert("Error", e.message); }
            finally { setSavingNote(false); }
          }} />
          <Text style={[pg.sectionHd, { color: colors.foreground, marginTop: 20 }]}>All Notes ({noteQ.items.length})</Text>
          {noteQ.loading && <ActivityIndicator color="#f59e0b" style={{ marginTop: 10 }} />}
          {noteQ.items.map(n => (
            <View key={n.id} style={[pg.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="file-text" size={20} color="#f59e0b" />
              <View style={{ flex: 1 }}>
                <Text style={[pg.itemTitle, { color: colors.foreground }]} numberOfLines={1}>{n.title}</Text>
                <Text style={[pg.itemSub, { color: colors.mutedForeground }]}>{n.examName}{n.subjectName ? ` › ${n.subjectName}` : ""}</Text>
              </View>
              <Switch value={n.isPublished} onValueChange={async (v) => {
                await apiFetch(`/notes/exam-notes/${n.id}`, tok, "PATCH", { isPublished: v }).catch(() => {});
                noteQ.refetch();
              }} trackColor={{ true: "#f59e0b" }} />
              <Pressable onPress={() => confirm("Delete this note?", async () => {
                await apiFetch(`/notes/exam-notes/${n.id}`, tok, "DELETE").catch(() => {});
                noteQ.refetch();
              })} hitSlop={8}><Feather name="trash-2" size={16} color="#ef4444" /></Pressable>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const pg = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800" },
  sub: { fontSize: 12, marginBottom: 16 },
  migBanner: { backgroundColor: "#FEF3C7", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tab: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  tabTxt: { fontSize: 11, fontWeight: "800" },
  sectionHd: { fontSize: 15, fontWeight: "800", marginBottom: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8 },
  itemTitle: { fontSize: 13, fontWeight: "700" },
  itemSub: { fontSize: 10, marginTop: 2 },
  pill: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7, marginRight: 8 },
});
