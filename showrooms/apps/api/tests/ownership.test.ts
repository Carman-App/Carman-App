import { describe, expect, it } from "vitest";
import { PasswordResetToken } from "../src/modules/auth/password-reset-token.model";
import { DealerProfile } from "../src/modules/dealers/dealer-profile.model";
import { Subscription, SubscriptionPlan } from "../src/modules/subscriptions/subscription.model";
import { ensureDefaultPlans } from "../src/modules/subscriptions/plans";
import { User } from "../src/modules/users/user.model";
import { auth, createListing, createUserAndLogin, testApp, uploadPhoto, useFakeServices, useTestDatabase, VEHICLE } from "./helpers";

useTestDatabase();
const fakes = useFakeServices();

describe("vehicle ownership", () => {
  it("never lets another seller touch a listing", async () => {
    const owner = await createUserAndLogin("BROKER");
    const other = await createUserAndLogin("BROKER");
    const id = await createListing(owner.accessToken, fakes.media);
    const as = (t: string) => auth(t);

    expect((await testApp().patch(`/api/v1/vehicles/${id}`).set(as(other.accessToken)).send({ price: 100_000 })).status).toBe(404);
    expect((await testApp().post(`/api/v1/vehicles/${id}/submit`).set(as(other.accessToken))).status).toBe(404);
    expect((await testApp().post(`/api/v1/vehicles/${id}/mark-sold`).set(as(other.accessToken)).send({})).status).toBe(404);
    expect((await testApp().delete(`/api/v1/vehicles/${id}`).set(as(other.accessToken))).status).toBe(404);
    expect((await testApp().get(`/api/v1/vehicles/${id}`).set(as(other.accessToken))).status).toBe(404);
    const sig = await testApp().post("/api/v1/uploads/signature").set(as(other.accessToken)).send({ purpose: "VEHICLE_IMAGE", vehicleId: id, contentType: "image/jpeg", fileSize: 1000 });
    expect(sig.status).toBe(404);
    expect((await testApp().get("/api/v1/vehicles/mine").set(as(other.accessToken))).body.data).toHaveLength(0);
  });

  it("refuses to attach a file uploaded for another listing", async () => {
    const owner = await createUserAndLogin("BROKER");
    const a = await createListing(owner.accessToken, fakes.media);
    const b = (await testApp().post("/api/v1/vehicles").set(auth(owner.accessToken)).send({ make: "Mazda" })).body.data.id;
    const sig = await testApp().post("/api/v1/uploads/signature").set(auth(owner.accessToken)).send({ purpose: "VEHICLE_IMAGE", vehicleId: a, contentType: "image/jpeg", fileSize: 1000 });
    fakes.media.upload(sig.body.data.publicId);
    const res = await testApp().post("/api/v1/uploads/complete").set(auth(owner.accessToken)).send({ purpose: "VEHICLE_IMAGE", vehicleId: b, publicId: sig.body.data.publicId });
    expect(res.status).toBe(403);
  });

  it("re-checks file size with the provider and deletes oversize files", async () => {
    const owner = await createUserAndLogin("BROKER");
    const id = (await testApp().post("/api/v1/vehicles").set(auth(owner.accessToken)).send({})).body.data.id;
    const sig = await testApp().post("/api/v1/uploads/signature").set(auth(owner.accessToken)).send({ purpose: "VEHICLE_IMAGE", vehicleId: id, contentType: "image/jpeg", fileSize: 1000 });
    fakes.media.upload(sig.body.data.publicId, { bytes: 50 * 1024 * 1024 });
    const res = await testApp().post("/api/v1/uploads/complete").set(auth(owner.accessToken)).send({ purpose: "VEHICLE_IMAGE", vehicleId: id, publicId: sig.body.data.publicId });
    expect(res.status).toBe(422);
    expect(fakes.media.deleted).toContain(sig.body.data.publicId);
  });

  it("reorders images (first is primary) and deletes removed ones", async () => {
    const owner = await createUserAndLogin("BROKER");
    const id = await createListing(owner.accessToken, fakes.media);
    const second = await uploadPhoto(owner.accessToken, fakes.media, id);
    const third = await uploadPhoto(owner.accessToken, fakes.media, id);
    const res = await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(owner.accessToken)).send({ imageOrder: [third, second] });
    expect(res.body.data.images.map((i: { publicId: string }) => i.publicId)).toEqual([third, second]);
    expect(fakes.media.deleted).toHaveLength(1);
    expect((await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(owner.accessToken)).send({ imageOrder: ["someone-else/x"] })).status).toBe(400);
  });

  it("keeps buyers and admins from creating listings, and ignores client-sent ownership and status", async () => {
    const buyer = await createUserAndLogin("BUYER");
    expect((await testApp().post("/api/v1/vehicles").set(auth(buyer.accessToken)).send(VEHICLE)).status).toBe(403);
    const broker = await createUserAndLogin("BROKER");
    const res = await testApp().post("/api/v1/vehicles").set(auth(broker.accessToken)).send({ ...VEHICLE, sellerId: String(buyer.user._id), status: "ACTIVE", isFeatured: true, viewCount: 999 });
    expect(res.body.data).toMatchObject({ sellerId: String(broker.user._id), status: "DRAFT", isFeatured: false, stats: { views: 0 } });
  });
});

describe("dealer staff", () => {
  it("lets staff manage the dealership's inventory, and nothing else", async () => {
    await ensureDefaultPlans();
    const owner = await createUserAndLogin("DEALER");
    await testApp().get("/api/v1/dealers/me").set(auth(owner.accessToken));

    // Staff accounts need the Dealer plan.
    expect((await testApp().post("/api/v1/dealers/me/staff").set(auth(owner.accessToken)).send({ name: "Amina Hassan", email: "amina@coastauto.co.ke" })).status).toBe(403);
    const plan = await SubscriptionPlan.findOne({ code: "DEALER" });
    await Subscription.create({ userId: owner.user._id, planId: plan!._id, planCode: "DEALER", planName: "Dealer", priceKes: 5000, periodDays: 30, status: "ACTIVE", startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000) });

    const added = await testApp().post("/api/v1/dealers/me/staff").set(auth(owner.accessToken)).send({ name: "Amina Hassan", email: "amina@coastauto.co.ke", staffRole: "SALES" });
    expect(added.status).toBe(201);
    expect(fakes.email.sent.at(-1)!.subject).toContain("added to");
    const staffUser = await User.findOne({ email: "amina@coastauto.co.ke" });
    expect(staffUser!.role).toBe("DEALER");
    expect(await PasswordResetToken.exists({ userId: staffUser!._id })).toBeTruthy();

    // Staff signs in (simulate having set a password).
    const { hashPassword } = await import("../src/modules/auth/password");
    staffUser!.passwordHash = await hashPassword("Mombasa2026");
    await staffUser!.save();
    const staffLogin = await testApp().post("/api/v1/auth/login").set("X-Client-Type", "mobile").send({ email: "amina@coastauto.co.ke", password: "Mombasa2026" });
    const staff = staffLogin.body.data.accessToken;

    const me = await testApp().get("/api/v1/dealers/me").set(auth(staff));
    expect(me.body.data).toMatchObject({ dealerRole: "SALES", entitlements: { planCode: "DEALER" } });

    // Listing created by staff belongs to the dealership; the owner can manage it.
    const id = await createListing(staff, fakes.media);
    const dealer = await DealerProfile.findOne({ ownerId: owner.user._id });
    const ownerView = await testApp().get(`/api/v1/vehicles/${id}`).set(auth(owner.accessToken));
    expect(ownerView.body.data).toMatchObject({ dealerId: String(dealer!._id), status: "DRAFT" });

    // Staff can't edit the dealership, manage staff or billing.
    expect((await testApp().patch("/api/v1/dealers/me").set(auth(staff)).send({ businessName: "Hijacked" })).status).toBe(403);
    expect((await testApp().get("/api/v1/dealers/me/staff").set(auth(staff))).status).toBe(403);
    expect((await testApp().post("/api/v1/subscriptions").set(auth(staff)).send({ planCode: "DEALER", phone: "0712345678" })).status).toBe(403);

    // Another dealer can't touch it.
    const rival = await createUserAndLogin("DEALER");
    expect((await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(rival.accessToken)).send({ price: 10_000 })).status).toBe(404);

    // Removing staff deactivates the login immediately.
    await testApp().delete(`/api/v1/dealers/me/staff/${staffUser!._id}`).set(auth(owner.accessToken));
    expect((await testApp().get("/api/v1/vehicles/mine").set(auth(staff))).status).toBe(403);
  });
});
