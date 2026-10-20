import { useEffect } from "react";
import { useRouter } from "expo-router";

// This screen is now merged into the unified Notes Manager
export default function AdminAddNoteScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-notes");
  }, []);
  return null;
}

