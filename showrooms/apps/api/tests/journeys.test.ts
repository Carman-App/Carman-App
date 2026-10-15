import { describe, expect, it } from "vitest";
import { buildWhatsAppShareMessage } from "@showrooms/shared";
import { Notification } from "../src/modules/notifications/notification.model";
import { Vehicle } from "../src/modules/vehicles/vehicle.model";
import { CALLBACK_PATH, PASSWORD, VEHICLE, auth, createListing, createUserAndLogin, publishListing, stkCallback, testApp, useFakeServices, useTestDatabase } from "./helpers";

useTestDatabase();
const fakes = useFakeServices();

/** The 13 end-to-end journeys from the brief, against the real API and database. */
describe("marketplace journeys", () => {
  it("runs buyer, broker and admin through the whole lifecycle", async () => {
    const api = testApp;
    const admin = await createUserAndLogin("ADMIN");

    // 1. Buyer registers and searches.
    const buyerReg = await api().post("/api/v1/auth/register").set("X-Client-Type", "mobile").send({ name: "Wanjiku Kamau", email: "wanjiku@example.com", password: PASSWORD, phone: "0711 222 333" });
    expect(buyerReg.status).toBe(201);
    const buyer = buyerReg.body.data.accessToken as string;
    expect((await api().get("/api/v1/vehicles").query({ make: "toyota" })).body.data).toHaveLength(0);

    // 4. Broker registers (gets a showroom automatically) and creates a listing.
    const brokerReg = await api().post("/api/v1/auth/register").send({ name: "Otieno Motors", email: "otieno@example.com", password: PASSWORD, phone: "0722 000 111", role: "BROKER" });
    const broker = brokerReg.body.data.accessToken as string;
    const showroom = await api().get("/api/v1/brokers/me").set(auth(broker));
    expect(showroom.body.data).toMatchObject({ slug: "otieno-motors", verificationStatus: "UNVERIFIED", entitlements: { planCode: "FREE", listingLimit: 5 } });
    const id = await createListing(broker, fakes.media);

    // 5. Broker submits for review; it is not public yet.
    const submitted = await api().post(`/api/v1/vehicles/${id}/submit`).set(auth(broker));
    expect(submitted.body.data.status).toBe("PENDING_REVIEW");
    expect((await api().get(`/api/v1/vehicles/${id}`)).status).toBe(404);
    expect((await api().get("/api/v1/vehicles")).body.meta.total).toBe(0);

    // 6. Admin approves.
    const pending = await api().get("/api/v1/admin/vehicles?status=PENDING_REVIEW").set(auth(admin.accessToken));
    expect(pending.body.data.map((v: { id: string }) => v.id)).toEqual([id]);
    const approved = await api().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(admin.accessToken)).send({ action: "APPROVE" });
    expect(approved.body.data.status).toBe("ACTIVE");
    expect(await Notification.exists({ type: "LISTING_APPROVED", title: "Your vehicle is listed!" })).toBeTruthy();

    // 7. Listing is publicly visible and searchable, with the seller card.
    const pub = await api().get(`/api/v1/vehicles/${approved.body.data.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ title: "2017 Toyota Fielder", price: 1_450_000, seller: { name: "Otieno Motors", whatsappNumber: "+254722000111", isVerified: false } });
    expect(pub.body.data.stats).toBeUndefined();
    expect(pub.headers["cache-control"]).toMatch(/public/);
    const search = await api().get("/api/v1/vehicles").query({ make: "Toyota", maxPrice: 2_000_000, town: "Nakuru", transmission: "AUTOMATIC" });
    expect(search.body.data.map((v: { id: string }) => v.id)).toEqual([id]);
    expect((await api().get("/api/v1/vehicles").query({ q: "fielder" })).body.meta.total).toBe(1);
    expect((await api().get("/api/v1/vehicles").query({ maxPrice: 1_000_000 })).body.meta.total).toBe(0);

    // 2. Buyer saves the vehicle.
    expect((await api().post(`/api/v1/favorites/${id}`).set(auth(buyer))).status).toBe(201);
    expect((await api().post(`/api/v1/favorites/${id}`).set(auth(buyer))).status).toBe(200);
    const saved = await api().get("/api/v1/favorites").set(auth(buyer));
    expect(saved.body.data.map((v: { id: string }) => v.id)).toEqual([id]);
    expect((await Vehicle.findById(id))!.favoriteCount).toBe(1);

    // 3. Buyer contacts the broker on WhatsApp (counted once per day).
    expect((await api().post(`/api/v1/vehicles/${id}/contact`).set(auth(buyer)).send({ channel: "WHATSAPP" })).body.data.counted).toBe(true);
    expect((await api().post(`/api/v1/vehicles/${id}/contact`).set(auth(buyer)).send({ channel: "WHATSAPP" })).body.data.counted).toBe(false);
    await api().post(`/api/v1/vehicles/${id}/view`).set(auth(buyer));
    await api().post(`/api/v1/vehicles/${id}/view`).set("User-Agent", "anon-phone");

    // 8. Broker shares: the WhatsApp message is built from the public listing.
    const msg = buildWhatsAppShareMessage(pub.body.data, `https://showrooms.co.ke/vehicles/${pub.body.data.slug}`, pub.body.data.seller.name);
    expect(msg).toContain("2017 Toyota Fielder");
    expect(msg).toContain("KES 1,450,000");
    // Posters are a paid feature.
    expect((await api().get(`/api/v1/vehicles/${id}/poster`).set(auth(broker))).status).toBe(403);

    // 9. Buyer requests a viewing; the broker sees the lead.
    const viewing = await api().post(`/api/v1/vehicles/${id}/inquiries`).set(auth(buyer)).send({ type: "VIEWING_REQUEST", message: "Can I see it Saturday?", preferredDate: new Date(Date.now() + 2 * 86_400_000).toISOString() });
    expect(viewing.status).toBe(201);
    expect((await api().post(`/api/v1/vehicles/${id}/inquiries`).set(auth(buyer)).send({ type: "VIEWING_REQUEST" })).status).toBe(409);
    const leads = await api().get("/api/v1/broker/inquiries").set(auth(broker));
    expect(leads.body.data[0]).toMatchObject({ type: "VIEWING_REQUEST", status: "NEW", buyer: { name: "Wanjiku Kamau", phone: "+254711222333" }, vehicle: { id } });
    expect(fakes.email.sent.some((m) => m.subject.startsWith("Viewing request"))).toBe(true);

    // Analytics distinguish views, contact clicks and viewing requests.
    const analytics = await api().get("/api/v1/analytics/seller").set(auth(broker));
    expect(analytics.body.data.totals).toMatchObject({ views: 2, whatsappClicks: 1, callClicks: 0, viewingRequests: 1, favorites: 1 });
    expect(analytics.body.data.advanced).toBe(false);
    expect(analytics.body.data.series).toBeUndefined();

    // 11 + 12. Broker pays for a boost by M-Pesa; only the verified callback activates it.
    const boost = await api().post(`/api/v1/vehicles/${id}/boost`).set(auth(broker)).send({ packageCode: "BOOST_7", phone: "0722000111" });
    expect(boost.status).toBe(201);
    expect(boost.body.data.payment).toMatchObject({ status: "PENDING", amountKes: 300 });
    expect(fakes.mpesa.pushes[0]).toMatchObject({ msisdn: "254722000111", amountKes: 300 });
    expect((await Vehicle.findById(id))!.promotionRank).toBe(0);

    const push = fakes.mpesa.pushes[0]!;
    const cb = await api().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 300, receipt: "RKT1234ABC" }));
    expect(cb.body).toEqual({ ResultCode: 0, ResultDesc: "Accepted" });
    const paid = await api().get(`/api/v1/payments/${boost.body.data.payment.id}`).set(auth(broker));
    expect(paid.body.data).toMatchObject({ status: "SUCCESS", mpesaReceiptNumber: "RKT1234ABC" });
    expect((await Vehicle.findById(id))!.promotionRank).toBe(1);
    expect((await api().get("/api/v1/vehicles").query({ sort: "recommended" })).body.data[0].isBoosted).toBe(true);

    // 10. Broker marks the vehicle as sold: out of search, still viewable for a while.
    const sold = await api().post(`/api/v1/vehicles/${id}/mark-sold`).set(auth(broker)).send({});
    expect(sold.body.data.status).toBe("SOLD");
    expect((await api().get("/api/v1/vehicles")).body.meta.total).toBe(0);
    expect((await api().get(`/api/v1/vehicles/${id}`)).body.data.status).toBe("SOLD");

    // 13. Non-admins are kept out of admin endpoints.
    for (const token of [buyer, broker]) {
      expect((await api().get("/api/v1/admin/overview").set(auth(token))).status).toBe(403);
      expect((await api().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(token)).send({ action: "APPROVE" })).status).toBe(403);
    }
    const overview = await api().get("/api/v1/admin/overview").set(auth(admin.accessToken));
    expect(overview.body.data.totals).toMatchObject({ buyers: 1, brokers: 1, soldVehicles: 1, inquiries: 1, revenueThisMonthKes: 300 });
    expect(overview.body.data.series).toHaveLength(30);
  });
});

describe("public listing rules", () => {
  it("shows similar vehicles and hides drafts from everyone but the owner", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const a = await createListing(broker.accessToken, fakes.media);
    const b = await createListing(broker.accessToken, fakes.media, { make: "Nissan", model: "Wingroad", color: "White", price: 1_300_000 });
    const draft = await createListing(broker.accessToken, fakes.media, { model: "Premio" });
    await publishListing(broker.accessToken, admin.accessToken, a);
    await publishListing(broker.accessToken, admin.accessToken, b);

    expect((await testApp().get(`/api/v1/vehicles/${draft}`)).status).toBe(404);
    const own = await testApp().get(`/api/v1/vehicles/${draft}`).set(auth(broker.accessToken));
    expect(own.body.data).toMatchObject({ status: "DRAFT", stats: { views: 0 } });

    const similar = await testApp().get(`/api/v1/vehicles/${a}/similar`);
    expect(similar.body.data.map((v: { id: string }) => v.id)).toEqual([b]);
  });

  it("validates search parameters", async () => {
    const res = await testApp().get("/api/v1/vehicles").query({ fuelType: "COAL", limit: 500 });
    expect(res.status).toBe(422);
  });

  it("resolves an old slug through its short id after the title changes", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const id = await createListing(broker.accessToken, fakes.media);
    await publishListing(broker.accessToken, admin.accessToken, id);
    const before = (await Vehicle.findById(id))!.slug;
    await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(broker.accessToken)).send({ price: 1_400_000, model: "Fielder Hybrid" });
    const after = await testApp().get(`/api/v1/vehicles/${before}`).set(auth(broker.accessToken));
    expect(after.body.data.slug).not.toBe(before);
    expect(after.body.data.id).toBe(id);
  });

  it("serves categories with live counts", async () => {
    const { ensureDefaultCategories } = await import("../src/modules/categories/categories.routes");
    await ensureDefaultCategories();
    const res = await testApp().get("/api/v1/categories");
    expect(res.body.data.makes.find((m: { name: string }) => m.name === "Toyota").models).toContain("Fielder");
    expect(res.body.data.bodyTypes).toHaveLength(11);
  });

  it("keeps the vehicle fixture valid", () => {
    expect(VEHICLE.location.town).toBe("Nakuru");
  });
});
