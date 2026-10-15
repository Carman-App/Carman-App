import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { imageUrl, VEHICLE_LIMITS, type Vehicle } from "@showrooms/shared";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/misc";
import { theme } from "@/constants/theme";
import { api, errorMessage } from "@/services/api";
import { uploadAsset, type LocalAsset } from "@/services/uploads";

interface Pending {
  key: string;
  asset: LocalAsset;
  kind: "image" | "video";
  progress: number;
  error?: string;
}

/** Multiple selection, upload progress, retry, ordering and cover photo. */
export function PhotoManager({ vehicle, onChange, ensureVehicle }: { vehicle: Vehicle | null; onChange: (v: Vehicle) => void; ensureVehicle: () => Promise<Vehicle> }) {
  const [pending, setPending] = useState<Pending[]>([]);
  const images = vehicle?.images ?? [];
  const update = (key: string, patch: Partial<Pending>) => setPending((l) => l.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  async function upload(item: Pending, vehicleId: string) {
    update(item.key, { error: undefined, progress: 0 });
    try {
      await uploadAsset(item.asset, item.kind === "image" ? "VEHICLE_IMAGE" : "VEHICLE_VIDEO", { vehicleId, onProgress: (progress) => update(item.key, { progress }) });
      setPending((l) => l.filter((p) => p.key !== item.key));
      onChange(await api<Vehicle>(`/vehicles/${vehicleId}`));
    } catch (err) {
      update(item.key, { error: errorMessage(err) });
    }
  }

  async function pick(kind: "image" | "video", camera = false) {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow access in Settings to add photos.");
    const room = kind === "image" ? VEHICLE_LIMITS.maxImages - images.length - pending.length : VEHICLE_LIMITS.maxVideos - (vehicle?.videos.length ?? 0);
    if (room <= 0) return Alert.alert("Limit reached", `You can add up to ${kind === "image" ? VEHICLE_LIMITS.maxImages : VEHICLE_LIMITS.maxVideos} ${kind}s.`);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: kind === "image" ? ["images"] : ["videos"], allowsMultipleSelection: kind === "image" && !camera, selectionLimit: room, quality: 0.8, videoMaxDuration: 60 };
    const res = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (res.canceled) return;
    const v = await ensureVehicle();
    const items: Pending[] = res.assets.slice(0, room).map((a, i) => ({
      key: `${Date.now()}-${i}`,
      kind,
      progress: 0,
      asset: { uri: a.uri, mimeType: a.mimeType ?? (kind === "image" ? "image/jpeg" : "video/mp4"), fileName: a.fileName ?? `${kind}-${i}.${kind === "image" ? "jpg" : "mp4"}`, fileSize: a.fileSize, width: a.width },
    }));
    setPending((l) => [...l, ...items]);
    // Two at a time: kinder to slow connections.
    const queue = [...items];
    const worker = async () => {
      for (let it = queue.shift(); it; it = queue.shift()) await upload(it, v.id);
    };
    await Promise.all([worker(), worker()]);
  }

  async function reorder(order: string[]) {
    if (!vehicle) return;
    try {
      onChange(await api<Vehicle>(`/vehicles/${vehicle.id}`, { method: "PATCH", body: { imageOrder: order } }));
    } catch (err) {
      Alert.alert("Couldn't update photos", errorMessage(err));
    }
  }
  const ids = images.map((i) => i.publicId);
  const move = (from: number, to: number) => {
    const next = [...ids];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x!);
    reorder(next);
  };

  return (
    <View className="gap-4">
      <View className="flex-row gap-2">
        <Button title="Gallery" icon="images-outline" variant="outline" className="flex-1" onPress={() => pick("image")} />
        <Button title="Camera" icon="camera-outline" variant="outline" className="flex-1" onPress={() => pick("image", true)} />
        <Button title="Video" icon="videocam-outline" variant="outline" className="flex-1" onPress={() => pick("video")} />
      </View>
      <Text className="text-xs text-ink-muted">Add 5–20 clear photos: front, back, both sides, interior, dashboard and engine. The first photo is your cover. Photos are resized on your phone to save data.</Text>
      <View className="flex-row flex-wrap gap-2">
        {images.map((img, i) => (
          <View key={img.publicId} className={`w-[31.5%] overflow-hidden rounded-md border ${i === 0 ? "border-accent" : "border-border"}`}>
            <Image source={{ uri: imageUrl(img.url, { width: 320 }) }} style={{ width: "100%", aspectRatio: 4 / 3 }} contentFit="cover" />
            {i === 0 ? <Text className="absolute left-1 top-1 overflow-hidden rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">Cover</Text> : null}
            <View className="flex-row justify-between px-1 py-1">
              <Pressable accessibilityLabel="Move earlier" disabled={i === 0} onPress={() => move(i, i - 1)} hitSlop={6}><Ionicons name="chevron-back" size={18} color={i === 0 ? theme.border : theme.ink} /></Pressable>
              <Pressable accessibilityLabel="Make cover photo" disabled={i === 0} onPress={() => move(i, 0)} hitSlop={6}><Ionicons name={i === 0 ? "star" : "star-outline"} size={16} color={theme.accent} /></Pressable>
              <Pressable accessibilityLabel="Remove photo" onPress={() => reorder(ids.filter((x) => x !== img.publicId))} hitSlop={6}><Ionicons name="trash-outline" size={16} color={theme.danger} /></Pressable>
              <Pressable accessibilityLabel="Move later" disabled={i === ids.length - 1} onPress={() => move(i, i + 1)} hitSlop={6}><Ionicons name="chevron-forward" size={18} color={i === ids.length - 1 ? theme.border : theme.ink} /></Pressable>
            </View>
          </View>
        ))}
        {pending.map((p) => (
          <View key={p.key} className="w-[31.5%] gap-1 overflow-hidden rounded-md border border-dashed border-border p-1">
            {p.kind === "image" ? <Image source={{ uri: p.asset.uri }} style={{ width: "100%", aspectRatio: 4 / 3, opacity: 0.6 }} contentFit="cover" /> : <View className="aspect-[4/3] items-center justify-center bg-surface"><Ionicons name="videocam" size={22} color={theme.inkMuted} /></View>}
            {p.error ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Retry upload" onPress={() => vehicle && upload(p, vehicle.id)} className="flex-row items-center justify-center gap-1 py-1">
                <Ionicons name="refresh" size={14} color={theme.accent} /><Text className="text-xs font-semibold text-accent">Retry</Text>
              </Pressable>
            ) : (
              <ProgressBar value={p.progress} />
            )}
          </View>
        ))}
      </View>
      {vehicle?.videos.length ? <Text className="text-sm text-ink-muted">{vehicle.videos.length} video(s) attached</Text> : null}
    </View>
  );
}
