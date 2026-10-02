import { companyName, supportEmail } from "@/lib/legal";

export const metadata = { title: "Privacy policy · Carma" };

export default function PrivacyPage() {
  const email = supportEmail();
  return (
    <>
      <h1>Privacy policy</h1>
      <p className="text-sm text-neutral-500">Last updated 2 October 2026</p>
      <p>
        Carma keeps a record of a vehicle&rsquo;s life: what it costs, how it was serviced and the papers that go with it.
        This policy explains what {companyName()} collects to do that, why, who else handles it, and the choices you have.
        We do not sell your data, show ads, or track you across other apps and websites.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Your account:</strong> your name and email address from Sign in with Apple or Google (Apple may give us a private relay address instead), and the country you choose, which sets your currency and units.</li>
        <li><strong>What you record:</strong> garages and who you share them with, vehicles (make, model, year, plate, VIN, odometer readings), costs such as fuel, service, repairs and insurance with their amounts, dates and places, and reminders.</li>
        <li><strong>Documents and photos you add:</strong> pictures or PDFs of documents such as insurance certificates, logbooks and receipts.</li>
        <li><strong>Workshop records</strong> if you use Carma as a mechanic: jobs, customers&rsquo; names and phone numbers you enter, estimates, invoices and payments recorded.</li>
        <li><strong>Questions you ask the assistant</strong> and its answers.</li>
        <li><strong>Technical data:</strong> when you last used the app, and, if the app crashes, a crash report with your device model, operating system and app version. Crash reports do not include your records.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To provide Carma: keeping your records, totals, insights, reminders and reports.</li>
        <li>To share records with the people you choose: garage members, and workshops you grant access to.</li>
        <li>To answer your questions with the assistant.</li>
        <li>To keep the service secure, prevent abuse, and fix problems.</li>
        <li>To manage your plan and free trial.</li>
      </ul>

      <h2>Who else handles your data</h2>
      <p>We use service providers who process data for us under contract, only to run Carma:</p>
      <ul>
        <li>Cloud hosting and database providers, where your account and records are stored.</li>
        <li>Cloud file storage, for documents and photos you upload.</li>
        <li>Apple and Google, to sign you in.</li>
        <li>Anthropic, to answer assistant questions. When you ask a question, the question and a summary of the relevant records (for example your vehicles and recent costs) are sent to answer it. Anthropic does not use this data to train its models.</li>
        <li>An error-monitoring service, which receives crash reports.</li>
      </ul>
      <p>We share records with other people only when you do: by adding members to a garage, by approving a workshop&rsquo;s access request, or by sending a report or transferring a vehicle.</p>

      <h2>How long we keep it</h2>
      <p>
        We keep your data while your account is open. If you delete your account, you are signed out at once and your
        account and everything in it are permanently removed after 30 days. That window lets us restore an account deleted
        by mistake if you contact us. Backups are overwritten on their normal cycle after that.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>See and correct your records in the app at any time.</li>
        <li>Delete your account in the app: My profile → Delete my account. See <a href="/legal/delete-account">how to delete your account</a>.</li>
        <li>Ask for a copy of your data, or ask any question about it, by writing to <a href={`mailto:${email}`}>{email}</a>.</li>
        <li>If you are in Kenya, you have rights under the Data Protection Act, 2019, including to access, correct and delete your data and to object to its use, and you can complain to the Office of the Data Protection Commissioner.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Data is encrypted in transit. Files are stored privately and shared only through short-lived links after an access
        check. Staff access is limited by role, protected by two-factor sign-in, and every action is logged.
      </p>

      <h2>Children</h2>
      <p>Carma is not intended for children under 16 and we do not knowingly collect their data.</p>

      <h2>Changes and contact</h2>
      <p>
        If we change this policy we will update the date above and, for important changes, tell you in the app. Questions:{" "}
        <a href={`mailto:${email}`}>{email}</a>.
      </p>
    </>
  );
}
