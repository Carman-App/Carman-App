import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Text, View } from "react-native";
import { ID_TYPES, VERIFICATION_EXPLAINER } from "@showrooms/shared";
import { Screen } from "@/components/layout/screen";
import { Button } from "@/components/ui/button";
import { Input, SelectField } from "@/components/ui/field";
import { Badge, Card, Loading } from "@/components/ui/misc";
import { api, errorMessage } from "@/services/api";
import { uploadAsset } from "@/services/uploads";
import { useAuth } from "@/stores/auth";

type Doc = { publicId: string; kind: "ID_FRONT" | "ID_BACK" | "SELFIE" };

export default function Verification() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const kind = user?.role === "DEALER" ? "dealers" : "brokers";
  const me = useQuery({ queryKey: ["verification", kind], queryFn: () => api<{ status: string; latest?: { reviewNotes?: string } }>(`/${kind}/verification`) });
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [idType, setIdType] = useState("NATIONAL_ID");
  const [idNumber, setIdNumber] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function addDoc(docKind: Doc["kind"]) {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setBusy(docKind);
    try {
      const out = await uploadAsset<{ publicId: string }>({ uri: a.uri, mimeType: a.mimeType ?? "image/jpeg", fileName: a.fileName ?? "id.jpg", fileSize: a.fileSize, width: a.width }, "VERIFICATION_DOC");
      setDocs((d) => [...d.filter((x) => x.kind !== docKind), { publicId: out.publicId, kind: docKind }]);
    } catch (err) {
      Alert.alert("Upload failed", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function submit() {
    setBusy("submit");
    try {
      await api(`/${kind}/verification`, { method: "POST", body: { fullName, idType, idNumber, documents: docs } });
      qc.invalidateQueries({ queryKey: ["verification"] });
      qc.invalidateQueries({ queryKey: ["seller-profile"] });
      Alert.alert("Submitted", "We'll review your documents within 1–2 business days.");
    } catch (err) {
      Alert.alert("Couldn't submit", errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (!me.data) return <Loading />;
  const open = ["UNVERIFIED", "REJECTED", "INFO_REQUESTED"].includes(me.data.status);
  return (
    <Screen edges={["bottom"]} className="gap-4 pt-4">
      <Badge label={me.data.status.replace("_", " ").toLowerCase()} tone={me.data.status === "VERIFIED" ? "success" : "info"} />
      <Text className="text-sm text-ink-muted">{VERIFICATION_EXPLAINER.broker} Documents are stored privately; only our verification team can see them.</Text>
      {me.data.latest?.reviewNotes && me.data.status !== "VERIFIED" ? <Card className="bg-warning-soft"><Text className="text-sm">Reviewer note: {me.data.latest.reviewNotes}</Text></Card> : null}
      {open ? (
        <View className="gap-4">
          <Input label="Full name (as on ID)" value={fullName} onChangeText={setFullName} />
          <SelectField label="ID type" value={idType} options={ID_TYPES.map((t) => ({ value: t, label: t.replace("_", " ").toLowerCase() }))} onChange={(v) => setIdType(v ?? "NATIONAL_ID")} />
          <Input label="ID number" value={idNumber} onChangeText={setIdNumber} autoCapitalize="characters" />
          {(["ID_FRONT", "ID_BACK", "SELFIE"] as const).map((k) => (
            <Button key={k} title={`${docs.some((d) => d.kind === k) ? "✓ " : ""}${k === "ID_FRONT" ? "ID front" : k === "ID_BACK" ? "ID back" : "Selfie holding ID"}`} variant="outline" icon="document-attach-outline" loading={busy === k} onPress={() => addDoc(k)} />
          ))}
          <Button title="Submit for verification" size="lg" loading={busy === "submit"} disabled={!docs.some((d) => d.kind === "ID_FRONT") || idNumber.length < 5} onPress={submit} />
        </View>
      ) : (
        <Text className="text-ink">{me.data.status === "VERIFIED" ? "You're verified." : "Your documents are being reviewed."}</Text>
      )}
    </Screen>
  );
}
