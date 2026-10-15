import { describe, expect, it } from "vitest";
import { AuditLog } from "../src/modules/audit/audit-log.model";
import { BrokerProfile } from "../src/modules/brokers/broker-profile.model";
import { Vehicle } from "../src/modules/vehicles/vehicle.model";
import { auth, createListing, createUserAndLogin, publishListing, testApp, useFakeServices, useTestDatabase } from "./helpers";

useTestDatabase();
const fakes = useFakeServices();

describe("listing moderation", () => {
  it("stores rejection reasons, lets the seller fix and resubmit", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const id = await createListing(broker.accessToken, fakes.media);
    await testApp().post(`/api/v1/vehicles/${id}/submit`).set(auth(broker.accessToken));

    expect((await testApp().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(admin.accessToken)).send({ action: "REQUEST_CHANGES" })).status).toBe(422);
    const res = await testApp().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(admin.accessToken)).send({ action: "REQUEST_CHANGES", reason: "Add photos of the interior" });
    expect(res.body.data).toMatchObject({ status: "REJECTED", rejectionReason: "Add photos of the interior" });
    expect(await AuditLog.exists({ action: "vehicle.request_changes", entityId: id })).toBeTruthy();

    const mine = await testApp().get(`/api/v1/vehicles/${id}`).set(auth(broker.accessToken));
    expect(mine.body.data.rejectionReason).toBe("Add photos of the interior");
    expect(mine.body.data.moderationHistory.map((m: { action: string }) => m.action)).toEqual(["SUBMITTED", "REQUEST_CHANGES"]);

    const again = await testApp().post(`/api/v1/vehicles/${id}/submit`).set(auth(broker.accessToken));
    expect(again.body.data.status).toBe("PENDING_REVIEW");
    expect(again.body.data.rejectionReason).toBeUndefined();
  });

  it("refuses incomplete listings at submit", async () => {
    const broker = await createUserAndLogin("BROKER");
    const id = (await testApp().post("/api/v1/vehicles").set(auth(broker.accessToken)).send({ make: "Subaru", model: "Forester" })).body.data.id;
    const res = await testApp().post(`/api/v1/vehicles/${id}/submit`).set(auth(broker.accessToken));
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["year", "price", "location"]));
  });

  it("suspends and reinstates, updating the showroom's public count", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const id = await createListing(broker.accessToken, fakes.media);
    await publishListing(broker.accessToken, admin.accessToken, id);
    expect((await BrokerProfile.findOne({ userId: broker.user._id }))!.activeListingCount).toBe(1);

    await testApp().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(admin.accessToken)).send({ action: "SUSPEND", reason: "Reported as already sold" });
    expect((await testApp().get(`/api/v1/vehicles/${id}`)).status).toBe(404);
    expect((await BrokerProfile.findOne({ userId: broker.user._id }))!.activeListingCount).toBe(0);
    expect((await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(broker.accessToken)).send({ price: 1_000_000 })).status).toBe(409);

    await testApp().post(`/api/v1/admin/vehicles/${id}/moderate`).set(auth(admin.accessToken)).send({ action: "REINSTATE" });
    expect((await testApp().get(`/api/v1/vehicles/${id}`)).status).toBe(200);
  });

  it("sends a live listing back to review when what the car is changes", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const id = await createListing(broker.accessToken, fakes.media);
    await publishListing(broker.accessToken, admin.accessToken, id);
    const priceOnly = await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(broker.accessToken)).send({ price: 1_390_000 });
    expect(priceOnly.body.data.status).toBe("ACTIVE");
    const yearChange = await testApp().patch(`/api/v1/vehicles/${id}`).set(auth(broker.accessToken)).send({ year: 2019 });
    expect(yearChange.body.data.status).toBe("PENDING_REVIEW");
  });

  it("publishes directly when approval is turned off, and auto-approves verified sellers when enabled", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    await testApp().patch("/api/v1/admin/settings").set(auth(admin.accessToken)).send({ autoApproveVerifiedSellers: true });
    await testApp().get("/api/v1/brokers/me").set(auth(broker.accessToken));
    await BrokerProfile.updateOne({ userId: broker.user._id }, { verificationStatus: "VERIFIED" });
    const id = await createListing(broker.accessToken, fakes.media);
    expect((await testApp().post(`/api/v1/vehicles/${id}/submit`).set(auth(broker.accessToken))).body.data.status).toBe("ACTIVE");

    const other = await createUserAndLogin("BROKER");
    const id2 = await createListing(other.accessToken, fakes.media, { model: "Note", make: "Nissan" });
    expect((await testApp().post(`/api/v1/vehicles/${id2}/submit`).set(auth(other.accessToken))).body.data.status).toBe("PENDING_REVIEW");
  });

  it("enforces the plan's active listing limit", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    for (let i = 0; i < 5; i++) {
      const id = await createListing(broker.accessToken, fakes.media, { mileage: 50_000 + i * 10_000 });
      await publishListing(broker.accessToken, admin.accessToken, id);
    }
    const sixth = await createListing(broker.accessToken, fakes.media, { mileage: 200_000 });
    const res = await testApp().post(`/api/v1/vehicles/${sixth}/submit`).set(auth(broker.accessToken));
    expect(res.status).toBe(403);
    expect(res.body.error.details).toMatchObject({ reason: "PLAN_LIMIT", limit: 5 });
  });

  it("flags possible duplicates for review", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const a = await createUserAndLogin("BROKER");
    const b = await createUserAndLogin("BROKER");
    const first = await createListing(a.accessToken, fakes.media);
    await publishListing(a.accessToken, admin.accessToken, first);
    const copy = await createListing(b.accessToken, fakes.media, { mileage: 86_300 });
    await testApp().post(`/api/v1/vehicles/${copy}/submit`).set(auth(b.accessToken));
    const detail = await testApp().get(`/api/v1/admin/vehicles/${copy}`).set(auth(admin.accessToken));
    expect(detail.body.data).toMatchObject({ flagged: true, flagReasons: ["POSSIBLE_DUPLICATE"] });
    expect(detail.body.data.possibleDuplicates[0].id).toBe(first);
  });
});

describe("reports", () => {
  it("auto-flags a listing after enough reports and lets admins resolve them", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const id = await createListing(broker.accessToken, fakes.media);
    await publishListing(broker.accessToken, admin.accessToken, id);

    for (let i = 0; i < 3; i++) {
      const buyer = await createUserAndLogin("BUYER");
      const r = await testApp().post(`/api/v1/vehicles/${id}/reports`).set(auth(buyer.accessToken)).send({ reason: "SCAM", details: "Asked for a deposit before viewing" });
      expect(r.status).toBe(201);
      if (i === 0) expect((await testApp().post(`/api/v1/vehicles/${id}/reports`).set(auth(buyer.accessToken)).send({ reason: "SCAM" })).status).toBe(409);
    }
    expect((await Vehicle.findById(id))!.flagged).toBe(true);

    const reports = await testApp().get("/api/v1/admin/reports?status=OPEN").set(auth(admin.accessToken));
    expect(reports.body.data).toHaveLength(3);
    await testApp().patch(`/api/v1/admin/reports/${reports.body.data[0].id}`).set(auth(admin.accessToken)).send({ status: "RESOLVED", resolution: "Confirmed scam", suspendVehicle: true });
    expect((await Vehicle.findById(id))!.status).toBe("SUSPENDED");
    expect((await testApp().get("/api/v1/admin/reports?status=OPEN").set(auth(admin.accessToken))).body.data).toHaveLength(2);
  });
});

describe("broker verification", () => {
  it("keeps ID numbers encrypted, shows them only to admins, and records the decision", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const sig = await testApp().post("/api/v1/uploads/signature").set(auth(broker.accessToken)).send({ purpose: "VERIFICATION_DOC", contentType: "application/pdf", fileSize: 200_000 });
    expect(sig.body.data.publicId).toMatch(/^showrooms\/private\/verification\//);
    fakes.media.upload(sig.body.data.publicId, { format: "pdf" });
    await testApp().post("/api/v1/uploads/complete").set(auth(broker.accessToken)).send({ purpose: "VERIFICATION_DOC", publicId: sig.body.data.publicId });

    // Can't reference someone else's upload path.
    const bad = await testApp().post("/api/v1/brokers/verification").set(auth(broker.accessToken)).send({ fullName: "Otieno Ouma", idType: "NATIONAL_ID", idNumber: "12345678", documents: [{ publicId: "showrooms/private/verification/other/x", kind: "ID_FRONT" }] });
    expect(bad.status).toBe(400);

    const submitted = await testApp().post("/api/v1/brokers/verification").set(auth(broker.accessToken)).send({ fullName: "Otieno Ouma", idType: "NATIONAL_ID", idNumber: "12345678", kraPin: "a123456789b", documents: [{ publicId: sig.body.data.publicId, kind: "ID_FRONT" }] });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.latest.idNumber).toBe("*****678");
    expect(JSON.stringify(submitted.body)).not.toContain("12345678");

    const { BrokerVerification } = await import("../src/modules/brokers/verification.model");
    const raw = await BrokerVerification.findOne().select("+idNumberEncrypted").lean();
    expect(raw!.idNumberEncrypted).not.toContain("12345678");

    const queue = await testApp().get("/api/v1/admin/verifications?status=PENDING").set(auth(admin.accessToken));
    expect(JSON.stringify(queue.body)).not.toContain("12345678");
    const detail = await testApp().get(`/api/v1/admin/verifications/${queue.body.data[0].id}`).set(auth(admin.accessToken));
    expect(detail.body.data).toMatchObject({ idNumber: "12345678", kraPin: "A123456789B" });
    expect(detail.body.data.documents[0].url).toContain("expires=600");
    expect(await AuditLog.exists({ action: "verification.viewed" })).toBeTruthy();

    // Brokers can't reach the admin view.
    expect((await testApp().get(`/api/v1/admin/verifications/${queue.body.data[0].id}`).set(auth(broker.accessToken))).status).toBe(403);

    await testApp().post(`/api/v1/admin/verifications/${queue.body.data[0].id}/decision`).set(auth(admin.accessToken)).send({ decision: "APPROVE" });
    const profile = await testApp().get("/api/v1/brokers/me").set(auth(broker.accessToken));
    expect(profile.body.data.verificationStatus).toBe("VERIFIED");
  });
});

describe("reviews", () => {
  it("only lets buyers who contacted the seller review them, once", async () => {
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const buyer = await createUserAndLogin("BUYER");
    const id = await createListing(broker.accessToken, fakes.media);
    await publishListing(broker.accessToken, admin.accessToken, id);
    const slug = (await BrokerProfile.findOne({ userId: broker.user._id }))!.slug;

    expect((await testApp().post(`/api/v1/brokers/${slug}/reviews`).set(auth(buyer.accessToken)).send({ rating: 5 })).status).toBe(403);

    const inq = await testApp().post(`/api/v1/vehicles/${id}/inquiries`).set(auth(buyer.accessToken)).send({ type: "QUESTION", message: "Is the price negotiable?" });
    expect((await testApp().post(`/api/v1/brokers/${slug}/reviews`).set(auth(buyer.accessToken)).send({ rating: 5 })).status).toBe(403);

    // Seller engages with the lead (lead tracking needs a paid plan, so do it directly).
    const { VehicleInquiry } = await import("../src/modules/inquiries/inquiry.model");
    await VehicleInquiry.updateOne({ _id: inq.body.data.id }, { status: "CONTACTED" });
    const review = await testApp().post(`/api/v1/brokers/${slug}/reviews`).set(auth(buyer.accessToken)).send({ rating: 4, comment: "Honest about the car" });
    expect(review.status).toBe(201);
    expect((await testApp().post(`/api/v1/brokers/${slug}/reviews`).set(auth(buyer.accessToken)).send({ rating: 1 })).status).toBe(409);
    expect((await BrokerProfile.findOne({ slug }))!).toMatchObject({ ratingAvg: 4, ratingCount: 1 });
    const list = await testApp().get(`/api/v1/brokers/${slug}/reviews`);
    expect(list.body.data[0]).toMatchObject({ rating: 4, buyer: { name: "BUYER u." } });
  });
});
