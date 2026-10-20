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

type Section = { id: number; name: string; icon: string };
type Exam    = { id: number; sectionId: number; name: string; icon: string };
type Subject = { id: number; examId: number; name: string };
type ExamNote = { id: number; examId: number; examName: string; subjectName: string | null; title: string; pdfUrl: string; isPublished: boolean };

function LabelInput({ label, value, onChange, placeholder, hint }: any) {
  const c = useColors();
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 4, textTransform: "uppercase" }}>{label}</Text>
      {hint ? <Text style={{ fontSize: 11, color: c.mutedForeground, marginBottom: 4 }}>{hint}</Text> : null}
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        style={{ borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: c.foreground, backgroundColor: c.card, borderColor: c.border }} />
    </View>
  );
}

function PillList({ items, selectedId, onSelect, color }: { items: { id: number; name: string; icon?: string }[]; selectedId: number | null; onSelect: (id: number) => void; color: string }) {
  const c = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
      {items.map(i => (
        <Pressable key={i.id} onPress={() => onSelect(i.id)}
          style={{ borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8,
            backgroundColor: selectedId === i.id ? color + "20" : "transparent",
            borderColor: selectedId === i.id ? color : c.border }}>
          <Text style={{ fontSize: 12, fontWeight: "700", color: selectedId === i.id ? color : c.foreground }}>
            {i.icon ? `${i.icon} ` : ""}{i.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function AdminNotesScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth() as any;
  const tok = token ?? "";

  // Step: 0=section, 1=exam, 2=subject, 3=notes
  const [step, setStep] = useState(0);
  const [migrated, setMigrated] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const [sections, setSections] = useState<Section[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allNotes, setAllNotes] = useState<ExamNote[]>([]);

  const [selSection, setSelSection] = useState<Section | null>(null);
  const [selExam, setSelExam] = useState<Exam | null>(null);
  const [selSubject, setSelSubject] = useState<Subject | null>(null);

  // Create new forms
  const [newSecName, setNewSecName] = useState("");
  const [newSecIcon, setNewSecIcon] = useState("📚");
  const [newExName, setNewExName] = useState("");
  const [newExIcon, setNewExIcon] = useState("📝");
  const [newSubName, setNewSubName] = useState("");
  const [noteTitle, setNoteTitle] = useState("");
  const [notePdfUrl, setNotePdfUrl] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [notePublished, setNotePublished] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSections = useCallback(async () => {
    try { const d = await apiFetch("/notes/sections", tok); setSections(d.sections ?? []); } catch {}
  }, [tok]);

  const loadExams = useCallback(async (sectionId: number) => {
    try { const d = await apiFetch(`/notes/exams?sectionId=${sectionId}`, tok); setExams(d.exams ?? []); } catch {}
  }, [tok]);

  const loadSubjects = useCallback(async (examId: number) => {
    try { const d = await apiFetch(`/notes/subjects?examId=${examId}`, tok); setSubjects(d.subjects ?? []); } catch {}
  }, [tok]);

  const loadNotes = useCallback(async (examId: number) => {
    try { const d = await apiFetch(`/notes/exam-notes?examId=${examId}`, tok); setAllNotes(d.examNotes ?? []); } catch {}
  }, [tok]);

  useEffect(() => { loadSections(); }, [loadSections]);

  const runMigration = async () => {
    setMigrating(true);
    try { await apiFetch("/migrate-notes", tok, "POST"); setMigrated(true); loadSections(); Alert.alert("✅ Done", "Tables ready!"); }
    catch (e: any) { Alert.alert("Error", e.message); }
    finally { setMigrating(false); }
  };

  const goToStep = (n: number) => setStep(n);

  const handleSelectSection = (s: Section) => {
    setSelSection(s); setSelExam(null); setSelSubject(null);
    loadExams(s.id); setStep(1);
  };

  const handleSelectExam = (e: Exam) => {
    setSelExam(e); setSelSubject(null);
    loadSubjects(e.id); loadNotes(e.id); setStep(2);
  };

  const handleSelectSubject = (s: Subject) => {
    setSelSubject(s); setStep(3);
  };

  const addSection = async () => {
    if (!newSecName) return Alert.alert("Error", "Name required");
    setSaving(true);
    try {
      await apiFetch("/notes/sections", tok, "POST", { name: newSecName, icon: newSecIcon });
      setNewSecName(""); setNewSecIcon("📚"); loadSections();
      Alert.alert("✅", "Section added!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const addExam = async () => {
    if (!selSection || !newExName) return Alert.alert("Error", "Select section and enter exam name");
    setSaving(true);
    try {
      await apiFetch("/notes/exams", tok, "POST", { sectionId: selSection.id, name: newExName, icon: newExIcon });
      setNewExName(""); setNewExIcon("📝"); loadExams(selSection.id);
      Alert.alert("✅", "Exam added!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const addSubject = async () => {
    if (!selExam || !newSubName) return Alert.alert("Error", "Select exam and enter subject name");
    setSaving(true);
    try {
      await apiFetch("/notes/subjects", tok, "POST", { examId: selExam.id, name: newSubName });
      setNewSubName(""); loadSubjects(selExam.id);
      Alert.alert("✅", "Subject added!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const saveNote = async () => {
    if (!selExam || !noteTitle || !notePdfUrl) return Alert.alert("Error", "Exam, title aur PDF/Drive link zaroori hai");
    setSaving(true);
    try {
      await apiFetch("/notes/exam-notes", tok, "POST", {
        examId: selExam.id,
        subjectId: selSubject ? selSubject.id : null,
        title: noteTitle, description: noteDesc, pdfUrl: notePdfUrl,
        isPublished: notePublished,
      });
      setNoteTitle(""); setNotePdfUrl(""); setNoteDesc(""); setNotePublished(true);
      loadNotes(selExam.id);
      Alert.alert("✅", "Note saved!");
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setSaving(false); }
  };

  const pt = Platform.OS === "web" ? 60 : insets.top + 8;
  const pb = Platform.OS === "web" ? 100 : Math.max(100, insets.bottom + 80);

  const STEPS = ["📂 Section", "📋 Exam", "📖 Subject", "📄 Notes"];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: pt, paddingBottom: pb }}>

      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={c.foreground} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: "800", color: c.foreground }}>Notes Manager</Text>
      </View>
      <Text style={{ fontSize: 12, color: c.mutedForeground, marginBottom: 16 }}>
        Section → Exam → Subject → Note — ek form mein sabkuch
      </Text>

      {/* Migration */}
      {!migrated && (
        <View style={{ backgroundColor: "#FEF3C7", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <Text style={{ color: "#92400e", fontSize: 12, flex: 1 }}>First time? DB tables create karo</Text>
          {migrating ? <ActivityIndicator color="#D97706" /> : (
            <Pressable onPress={runMigration} style={{ backgroundColor: "#D97706", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "800" }}>Run Migration</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Step Indicator */}
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <Pressable key={i} onPress={() => i < step ? goToStep(i) : null}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
              backgroundColor: step === i ? "#D97706" : i < step ? "#D9770630" : c.card,
              borderWidth: 1, borderColor: step === i ? "#D97706" : c.border }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: step === i ? "#fff" : i < step ? "#D97706" : c.mutedForeground }}>
              {s}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* ── STEP 0: SECTION ── */}
      {step === 0 && (
        <View>
          <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground, marginBottom: 12 }}>📂 Section चुनें या बनाएं</Text>

          {sections.length > 0 && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 8, textTransform: "uppercase" }}>Existing Sections</Text>
              {sections.map(s => (
                <Pressable key={s.id} onPress={() => handleSelectSection(s)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5,
                    padding: 14, marginBottom: 8, backgroundColor: c.card, borderColor: c.border }}>
                  <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: c.foreground }}>{s.name}</Text>
                  <Feather name="chevron-right" size={18} color="#D97706" />
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />
            </>
          )}

          <Text style={{ fontSize: 13, fontWeight: "800", color: c.foreground, marginBottom: 12 }}>+ New Section</Text>
          <LabelInput label="Section Name *" value={newSecName} onChange={setNewSecName} placeholder="e.g. SSC, Banking, Railway" />
          <LabelInput label="Icon (Emoji)" value={newSecIcon} onChange={setNewSecIcon} placeholder="📚" />
          <Pressable onPress={addSection} disabled={saving}
            style={{ backgroundColor: "#D97706", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{saving ? "Saving..." : "Add Section"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── STEP 1: EXAM ── */}
      {step === 1 && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 22 }}>{selSection?.icon}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground }}>{selSection?.name} → Exam</Text>
          </View>

          {exams.length > 0 && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 8, textTransform: "uppercase" }}>Existing Exams</Text>
              {exams.map(e => (
                <Pressable key={e.id} onPress={() => handleSelectExam(e)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5,
                    padding: 14, marginBottom: 8, backgroundColor: c.card, borderColor: c.border }}>
                  <Text style={{ fontSize: 20 }}>{e.icon}</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: c.foreground }}>{e.name}</Text>
                  <Feather name="chevron-right" size={18} color="#6366f1" />
                </Pressable>
              ))}
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />
            </>
          )}

          <Text style={{ fontSize: 13, fontWeight: "800", color: c.foreground, marginBottom: 12 }}>+ New Exam</Text>
          <LabelInput label="Exam Name *" value={newExName} onChange={setNewExName} placeholder="e.g. SSC CGL, IBPS PO" />
          <LabelInput label="Icon (Emoji)" value={newExIcon} onChange={setNewExIcon} placeholder="📝" />
          <Pressable onPress={addExam} disabled={saving}
            style={{ backgroundColor: "#6366f1", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{saving ? "Saving..." : "Add Exam"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── STEP 2: SUBJECT ── */}
      {step === 2 && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Text style={{ fontSize: 20 }}>{selExam?.icon}</Text>
            <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground }}>{selExam?.name} → Subject</Text>
          </View>

          {subjects.length > 0 && (
            <>
              <Text style={{ fontSize: 11, fontWeight: "700", color: c.mutedForeground, marginBottom: 8, textTransform: "uppercase" }}>Existing Subjects</Text>
              {subjects.map(s => (
                <Pressable key={s.id} onPress={() => handleSelectSubject(s)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5,
                    padding: 14, marginBottom: 8, backgroundColor: c.card, borderColor: c.border }}>
                  <Text style={{ fontSize: 20 }}>📖</Text>
                  <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: c.foreground }}>{s.name}</Text>
                  <Feather name="chevron-right" size={18} color="#10b981" />
                </Pressable>
              ))}
              {/* Skip subject option */}
              <Pressable onPress={() => { setSelSubject(null); setStep(3); }}
                style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#10b981", marginBottom: 8, backgroundColor: "#10b98110" }}>
                <Feather name="skip-forward" size={16} color="#10b981" />
                <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 13 }}>Skip — Subject ke bina note add karo</Text>
              </Pressable>
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 16 }} />
            </>
          )}

          <Text style={{ fontSize: 13, fontWeight: "800", color: c.foreground, marginBottom: 12 }}>+ New Subject</Text>
          <LabelInput label="Subject Name *" value={newSubName} onChange={setNewSubName} placeholder="e.g. Reasoning, Mathematics" />
          <Pressable onPress={addSubject} disabled={saving}
            style={{ backgroundColor: "#10b981", borderRadius: 12, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1 }}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>{saving ? "Saving..." : "Add Subject"}</Text>
          </Pressable>
        </View>
      )}

      {/* ── STEP 3: NOTES ── */}
      {step === 3 && (
        <View>
          {/* Breadcrumb */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
            <Text style={{ fontSize: 12, color: "#D97706", fontWeight: "700" }}>{selSection?.icon} {selSection?.name}</Text>
            <Feather name="chevron-right" size={12} color={c.mutedForeground} />
            <Text style={{ fontSize: 12, color: "#6366f1", fontWeight: "700" }}>{selExam?.icon} {selExam?.name}</Text>
            {selSubject && <>
              <Feather name="chevron-right" size={12} color={c.mutedForeground} />
              <Text style={{ fontSize: 12, color: "#10b981", fontWeight: "700" }}>📖 {selSubject.name}</Text>
            </>}
          </View>

          <Text style={{ fontSize: 15, fontWeight: "800", color: c.foreground, marginBottom: 16 }}>📄 Note Add Karo</Text>
          <LabelInput label="Note Title *" value={noteTitle} onChange={setNoteTitle} placeholder="e.g. Reasoning Chapter 1" />
          <LabelInput
            label="PDF / Google Drive Link *"
            value={notePdfUrl}
            onChange={setNotePdfUrl}
            placeholder="https://drive.google.com/file/d/... ya PDF link"
            hint="💡 Google Drive share link paste karo — app mein khulega"
          />
          <LabelInput label="Description (optional)" value={noteDesc} onChange={setNoteDesc} placeholder="Is note mein kya covered hai..." />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Switch value={notePublished} onValueChange={setNotePublished} trackColor={{ true: "#f59e0b" }} />
            <Text style={{ fontSize: 13, color: c.foreground, fontWeight: "700" }}>Publish immediately</Text>
          </View>

          <Pressable onPress={saveNote} disabled={saving}
            style={{ backgroundColor: "#f59e0b", borderRadius: 14, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: saving ? 0.7 : 1, marginBottom: 24 }}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Feather name="save" size={16} color="#fff" />}
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>{saving ? "Saving..." : "Save Note"}</Text>
          </Pressable>

          {/* Existing Notes for this exam */}
          {allNotes.length > 0 && (
            <>
              <Text style={{ fontSize: 13, fontWeight: "800", color: c.foreground, marginBottom: 10 }}>
                📋 Notes in {selExam?.name} ({allNotes.length})
              </Text>
              {allNotes.map(n => (
                <View key={n.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 8, backgroundColor: c.card, borderColor: c.border }}>
                  <Feather name="file-text" size={20} color="#f59e0b" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: c.foreground }} numberOfLines={1}>{n.title}</Text>
                    <Text style={{ fontSize: 10, color: c.mutedForeground, marginTop: 2 }}>
                      {n.subjectName ?? "No subject"} · {n.isPublished ? "✅ Published" : "⏸ Draft"}
                    </Text>
                  </View>
                  <Switch value={n.isPublished} onValueChange={async (v) => {
                    try { await apiFetch(`/notes/exam-notes/${n.id}`, tok, "PATCH", { isPublished: v }); loadNotes(selExam!.id); } catch {}
                  }} trackColor={{ true: "#f59e0b" }} />
                  <Pressable onPress={() => {
                    const msg = "Delete this note?";
                    if (Platform.OS === "web") { if (window.confirm(msg)) apiFetch(`/notes/exam-notes/${n.id}`, tok, "DELETE").then(() => loadNotes(selExam!.id)).catch(() => {}); }
                    else Alert.alert("Confirm", msg, [{ text: "Cancel" }, { text: "Delete", style: "destructive", onPress: () => apiFetch(`/notes/exam-notes/${n.id}`, tok, "DELETE").then(() => loadNotes(selExam!.id)).catch(() => {}) }]);
                  }} hitSlop={8}>
                    <Feather name="trash-2" size={16} color="#ef4444" />
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}
