import type { Metadata } from "next";
import { VERIFICATION_EXPLAINER } from "@showrooms/shared";
import { SafetyNotice } from "@/components/vehicles/safety-notice";

export const metadata: Metadata = { title: "How Showrooms works", description: "How buying and selling works on Showrooms, what verification means, and how to stay safe." };

export default function HowItWorksPage() {
  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-3xl font-extrabold tracking-tight">How Showrooms works</h1>
      <div className="prose mt-8 space-y-8 text-ink">
        <section>
          <h2 className="text-xl font-bold">For buyers</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-muted">
            <li>Search by make, model, price and town. Every price is in Kenyan shillings.</li>
            <li>Save cars you like and follow showrooms to hear about new stock.</li>
            <li>WhatsApp or call the seller directly, or request a viewing.</li>
            <li>Inspect the car, check the logbook and run an NTSA search before paying anything.</li>
          </ol>
        </section>
        <section>
          <h2 className="text-xl font-bold">For sellers</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-muted">
            <li>Register as a broker or dealer and set up your showroom.</li>
            <li>Add a car: photos, specs, price and location. Our team reviews new listings.</li>
            <li>Once it&apos;s live, share it to WhatsApp chats, groups and your Status.</li>
            <li>Answer buyers, track viewing requests, and mark the car sold when it goes.</li>
          </ol>
        </section>
        <section id="verification">
          <h2 className="text-xl font-bold">What &ldquo;verified&rdquo; means</h2>
          <div className="mt-3 space-y-3 text-ink-muted">
            <p><strong className="text-ink">Verified seller.</strong> {VERIFICATION_EXPLAINER.broker}</p>
            <p><strong className="text-ink">Verified listing.</strong> {VERIFICATION_EXPLAINER.vehicle}</p>
            <p>Showrooms does not hold money, sell cars or guarantee any vehicle&apos;s condition, ownership or authenticity.</p>
          </div>
        </section>
        <SafetyNotice />
      </div>
    </div>
  );
}
