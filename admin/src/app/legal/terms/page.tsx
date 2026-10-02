import { companyName, supportEmail } from "@/lib/legal";

export const metadata = { title: "Terms of use · Carma" };

export default function TermsPage() {
  const email = supportEmail();
  return (
    <>
      <h1>Terms of use</h1>
      <p className="text-sm text-neutral-500">Last updated 2 October 2026</p>
      <p>These terms apply when you use Carma, provided by {companyName()}. By using Carma you agree to them.</p>

      <h2>Your account</h2>
      <p>You sign in with Apple or Google and are responsible for what happens under your account. Keep your device secure.</p>

      <h2>Your records</h2>
      <p>
        What you record in Carma is yours. You give us permission to store and process it only to provide the service,
        including sharing it with the people you choose. Carma records what was quoted, invoiced and paid; it does not move
        money, and it is not financial, legal or mechanical advice. Check figures before relying on them.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Do not use Carma to break the law, to record information about people without the right to, to upload content you
        do not have the right to share, or to interfere with the service or other people&rsquo;s accounts.
      </p>

      <h2>Plans and the free trial</h2>
      <p>
        New accounts get a free trial with no card. After it ends, your records stay readable; adding more than the free
        plan allows needs a paid plan. Any purchase is made through the App Store or Google Play and is governed by their
        terms, including cancellation and refunds.
      </p>

      <h2>The assistant</h2>
      <p>The assistant answers from your records but can be wrong. Every draft it suggests is shown to you before anything is saved.</p>

      <h2>Ending your use</h2>
      <p>
        You can delete your account at any time in the app. We may suspend accounts that break these terms, and will say why
        where we can.
      </p>

      <h2>Liability</h2>
      <p>
        Carma is provided as is. To the extent the law allows, we are not liable for indirect losses or for decisions made on
        the basis of records in the app. Nothing in these terms limits rights you have under consumer law.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${email}`}>{email}</a>
      </p>
    </>
  );
}
