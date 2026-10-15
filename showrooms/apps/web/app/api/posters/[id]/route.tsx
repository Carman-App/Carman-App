import { ImageResponse } from "next/og";
import { formatEngine, formatKes, formatMileage, label, POSTER_SIZE, type Vehicle } from "@showrooms/shared";
import { ogFonts, ogImageSrc } from "@/lib/og/fonts";
import { verifyPosterSignature } from "@/lib/og/poster-signature";
import { publicGet } from "@/lib/server-api";
import { SITE_URL } from "@/lib/utils";

/**
 * 1080×1920 WhatsApp Status poster. Only reachable through a short-lived link
 * signed by the API for the listing's owner on a plan that includes posters.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  if (!/^[a-f\d]{24}$/i.test(id) || !verifyPosterSignature(id, url.searchParams.get("exp"), url.searchParams.get("sig"))) {
    return new Response("Poster link expired. Generate a new one from your dashboard.", { status: 403 });
  }
  const v = (await publicGet<Vehicle>(`/vehicles/${id}`, 60))?.data;
  if (!v || v.status !== "ACTIVE") return new Response("Listing not available", { status: 404 });

  const { width, height } = POSTER_SIZE;
  const img = v.images[0] ? ogImageSrc(v.images[0].url, width, 1150) : null;
  const specs = [formatMileage(v.mileage), label("transmission", v.transmission), label("fuelType", v.fuelType), formatEngine(v.engineCapacity)];
  const shortUrl = `${new URL(SITE_URL).host}/vehicles/${v.slug}`;

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#1C1F23", fontFamily: "Jakarta", color: "white" }}>
        <div style={{ display: "flex", position: "relative", width, height: 1150 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img && <img src={img} alt="" width={width} height={1150} style={{ objectFit: "cover" }} />}
          <div style={{ display: "flex", position: "absolute", top: 48, left: 48, background: "rgba(28,31,35,0.85)", padding: "14px 28px", borderRadius: 999, fontSize: 34, fontWeight: 800 }}>Showrooms</div>
          {v.priceNegotiable && <div style={{ display: "flex", position: "absolute", top: 48, right: 48, background: "#C2410C", padding: "14px 28px", borderRadius: 999, fontSize: 30, fontWeight: 800 }}>Negotiable</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: "56px 64px", gap: 22, flex: 1 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.05 }}>{v.title}</div>
          <div style={{ fontSize: 96, fontWeight: 800, color: "#FB923C" }}>{formatKes(v.price)}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {specs.map((s) => (
              <div key={s} style={{ display: "flex", border: "2px solid rgba(255,255,255,0.25)", borderRadius: 16, padding: "10px 22px", fontSize: 34 }}>
                {s}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 38, color: "rgba(255,255,255,0.75)" }}>{`📍 ${[v.location.area, v.location.town].filter(Boolean).join(", ")}`}</div>
          <div style={{ display: "flex", marginTop: "auto", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 40, fontWeight: 800 }}>{v.seller?.name ?? ""}</div>
              <div style={{ fontSize: 30, color: "rgba(255,255,255,0.6)" }}>{shortUrl}</div>
            </div>
            {v.seller?.isVerified && <div style={{ display: "flex", background: "#1D4ED8", padding: "10px 22px", borderRadius: 999, fontSize: 28, fontWeight: 800 }}>Verified seller</div>}
          </div>
        </div>
      </div>
    ),
    { width, height, fonts: await ogFonts(), headers: { "Cache-Control": "private, max-age=300", "Content-Disposition": `inline; filename="${v.slug}-status.png"` } },
  );
}
