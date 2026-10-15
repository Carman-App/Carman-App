import { ImageResponse } from "next/og";
import { formatKes, formatMileage, label, type Vehicle } from "@showrooms/shared";
import { ogFonts, ogImageSrc } from "@/lib/og/fonts";
import { publicGet } from "@/lib/server-api";

export const alt = "Vehicle for sale on Showrooms";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const v = (await publicGet<Vehicle>(`/vehicles/${encodeURIComponent(slug)}`, 300))?.data;
  const fonts = await ogFonts();
  if (!v) {
    return new ImageResponse(<div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#1C1F23", color: "white", fontSize: 64, fontFamily: "Jakarta", fontWeight: 800 }}>Showrooms</div>, { ...size, fonts });
  }
  const img = v.images[0] ? ogImageSrc(v.images[0].url, 720, 630) : null;
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "white", fontFamily: "Jakarta" }}>
        {img && <img src={img} alt="" width={720} height={630} style={{ objectFit: "cover" }} />}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 48, flex: 1 }}>
          <div style={{ display: "flex", fontSize: 28, fontWeight: 800, color: "#1C1F23" }}>Showrooms</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: "#1C1F23", lineHeight: 1.1 }}>{v.title}</div>
            <div style={{ fontSize: 48, fontWeight: 800, color: "#C2410C" }}>{formatKes(v.price)}</div>
            <div style={{ fontSize: 24, color: "#5B6068" }}>{`${formatMileage(v.mileage)} · ${label("transmission", v.transmission)} · ${v.location.town}`}</div>
          </div>
          <div style={{ fontSize: 22, color: "#8A8F96" }}>{v.seller?.name ?? ""}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
