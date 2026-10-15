import { describe, expect, it } from "vitest";
import { VehicleBoost } from "../src/modules/boosts/boost.model";
import { Payment } from "../src/modules/payments/payment.model";
import { Subscription } from "../src/modules/subscriptions/subscription.model";
import { ensureDefaultPlans } from "../src/modules/subscriptions/plans";
import { Vehicle } from "../src/modules/vehicles/vehicle.model";
import { runMaintenance } from "../src/jobs";
import { CALLBACK_PATH, auth, createListing, createUserAndLogin, publishListing, stkCallback, testApp, useFakeServices, useTestDatabase } from "./helpers";

useTestDatabase();
const fakes = useFakeServices();

async function liveListing() {
  const admin = await createUserAndLogin("ADMIN");
  const broker = await createUserAndLogin("BROKER");
  const id = await createListing(broker.accessToken, fakes.media);
  await publishListing(broker.accessToken, admin.accessToken, id);
  return { admin, broker, id };
}

async function buyBoost(token: string, id: string, packageCode = "BOOST_7") {
  const res = await testApp().post(`/api/v1/vehicles/${id}/boost`).set(auth(token)).send({ packageCode, phone: "0722000111" });
  const push = fakes.mpesa.pushes.at(-1)!;
  return { res, push };
}

describe("M-Pesa callbacks", () => {
  it("rejects callbacks without the secret token", async () => {
    const { broker, id } = await liveListing();
    const { push } = await buyBoost(broker.accessToken, id);
    const res = await testApp().post("/api/v1/payments/mpesa/callback?token=wrong").send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 300 }));
    expect(res.status).toBe(403);
    expect((await Payment.findOne())!.status).toBe("PENDING");
  });

  it("processes duplicate and concurrent callbacks exactly once", async () => {
    const { broker, id } = await liveListing();
    const { push } = await buyBoost(broker.accessToken, id);
    const body = stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 300, receipt: "RKT0000001" });
    await Promise.all([1, 2, 3].map(() => testApp().post(CALLBACK_PATH).send(body)));
    await testApp().post(CALLBACK_PATH).send(body);

    const payment = await Payment.findOne().select("+callbacks");
    expect(payment).toMatchObject({ status: "SUCCESS", callbackCount: 4, mpesaReceiptNumber: "RKT0000001" });
    const vehicle = await Vehicle.findById(id);
    const days = (vehicle!.boostedUntil!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    expect(await VehicleBoost.countDocuments({ status: "ACTIVE" })).toBe(1);
  });

  it("does not activate when the amount paid is wrong", async () => {
    const { broker, id } = await liveListing();
    const { push } = await buyBoost(broker.accessToken, id);
    await testApp().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 1 }));
    expect((await Payment.findOne())!.status).toBe("FAILED");
    expect((await Vehicle.findById(id))!.promotionRank).toBe(0);
  });

  it("does not trust a success callback that Daraja's status query contradicts", async () => {
    const { broker, id } = await liveListing();
    const { push } = await buyBoost(broker.accessToken, id);
    fakes.mpesa.queryResults.set(push.checkoutRequestId, { resultCode: undefined, resultDesc: "The transaction is being processed" });
    await testApp().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 300 }));
    expect((await Payment.findOne())!.status).toBe("PENDING");
    expect((await Vehicle.findById(id))!.promotionRank).toBe(0);

    // Later, reconciliation confirms it.
    fakes.mpesa.queryResults.set(push.checkoutRequestId, { resultCode: "0", resultDesc: "ok" });
    // Backdate (timestamps make createdAt immutable through the model).
    await Payment.collection.updateOne({}, { $set: { createdAt: new Date(Date.now() - 10 * 60_000) } });
    await runMaintenance();
    expect((await Payment.findOne())!.status).toBe("SUCCESS");
    expect((await Vehicle.findById(id))!.promotionRank).toBe(1);
  });

  it("marks cancelled prompts and lets the seller retry", async () => {
    const { broker, id } = await liveListing();
    const { res, push } = await buyBoost(broker.accessToken, id);
    await testApp().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { resultCode: 1032 }));
    expect((await Payment.findOne())!.status).toBe("CANCELLED");
    expect((await VehicleBoost.findById(res.body.data.boost.id))!.status).toBe("CANCELLED");

    const retry = await testApp().post("/api/v1/payments/mpesa/stk-push").set(auth(broker.accessToken)).send({ purpose: "BOOST", referenceId: res.body.data.boost.id, phone: "0722000111" });
    expect(retry.status).toBe(201);
    expect(retry.body.data).toMatchObject({ status: "PENDING", amountKes: 300 });
  });

  it("records a failed STK push without activating anything", async () => {
    const { broker, id } = await liveListing();
    fakes.mpesa.failNextPush = true;
    const res = await testApp().post(`/api/v1/vehicles/${id}/boost`).set(auth(broker.accessToken)).send({ packageCode: "BOOST_7", phone: "0722000111" });
    expect(res.body.data.payment).toMatchObject({ status: "FAILED" });
    expect(res.body.data.boost.status).toBe("CANCELLED");
  });
});

describe("subscriptions", () => {
  it("upgrades to Pro only after a verified payment, and is idempotent per key", async () => {
    await ensureDefaultPlans();
    const broker = await createUserAndLogin("BROKER");
    const plans = await testApp().get("/api/v1/subscriptions/plans?audience=BROKER");
    expect(plans.body.data.map((p: { code: string }) => p.code)).toEqual(["FREE", "PRO"]);

    const key = "sub-attempt-0001";
    const first = await testApp().post("/api/v1/subscriptions").set(auth(broker.accessToken)).set("Idempotency-Key", key).send({ planCode: "PRO", phone: "0712345678" });
    const again = await testApp().post("/api/v1/subscriptions").set(auth(broker.accessToken)).set("Idempotency-Key", key).send({ planCode: "PRO", phone: "0712345678" });
    expect(first.status).toBe(201);
    expect(again.body.data.payment.id).toBe(first.body.data.payment.id);
    expect(fakes.mpesa.pushes).toHaveLength(1);
    expect(await Subscription.countDocuments()).toBe(1);
    expect(first.body.data.payment.amountKes).toBe(1500);

    // The client can't make itself Pro; until the callback, entitlements stay Free.
    expect((await testApp().get("/api/v1/subscriptions/me").set(auth(broker.accessToken))).body.data.entitlements.planCode).toBe("FREE");

    const push = fakes.mpesa.pushes[0]!;
    await testApp().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 1500 }));
    const me = await testApp().get("/api/v1/subscriptions/me").set(auth(broker.accessToken));
    expect(me.body.data.entitlements).toMatchObject({ planCode: "PRO", listingLimit: 50, features: { statusPosters: true, advancedAnalytics: true } });

    // Paid features unlock.
    const analytics = await testApp().get("/api/v1/analytics/seller?days=7").set(auth(broker.accessToken));
    expect(analytics.body.data.series).toHaveLength(7);
  });

  it("follows admin price changes for new purchases", async () => {
    await ensureDefaultPlans();
    const admin = await createUserAndLogin("ADMIN");
    const broker = await createUserAndLogin("BROKER");
    const pro = (await testApp().get("/api/v1/admin/plans").set(auth(admin.accessToken))).body.data.find((p: { code: string }) => p.code === "PRO");
    await testApp().patch(`/api/v1/admin/plans/${pro.id}`).set(auth(admin.accessToken)).send({ priceKes: 1200 });
    const res = await testApp().post("/api/v1/subscriptions").set(auth(broker.accessToken)).send({ planCode: "PRO", phone: "0712345678" });
    expect(res.body.data.payment.amountKes).toBe(1200);
  });

  it("expires subscriptions after their period", async () => {
    await ensureDefaultPlans();
    const broker = await createUserAndLogin("BROKER");
    await testApp().post("/api/v1/subscriptions").set(auth(broker.accessToken)).send({ planCode: "PRO", phone: "0712345678" });
    const push = fakes.mpesa.pushes[0]!;
    await testApp().post(CALLBACK_PATH).send(stkCallback(push.checkoutRequestId, push.merchantRequestId, { amount: 1500 }));
    await Subscription.updateOne({ status: "ACTIVE" }, { endsAt: new Date(Date.now() - 1000) });
    await runMaintenance();
    expect((await testApp().get("/api/v1/subscriptions/me").set(auth(broker.accessToken))).body.data.entitlements.planCode).toBe("FREE");
  });
});
