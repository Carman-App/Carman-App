import { companyName, supportEmail } from "@/lib/legal";

export const metadata = { title: "Delete your Carma account" };

export default function DeleteAccountPage() {
  const email = supportEmail();
  return (
    <>
      <h1>Delete your Carma account</h1>
      <p>You can delete your {companyName()} account and its data at any time.</p>

      <h2>In the app</h2>
      <ul>
        <li>Open Carma and go to <strong>My profile</strong>.</li>
        <li>Tap <strong>Delete my account</strong>, then confirm.</li>
      </ul>
      <p>You are signed out on every device at once.</p>

      <h2>Without the app</h2>
      <p>
        Email <a href={`mailto:${email}?subject=Delete%20my%20Carma%20account`}>{email}</a> from the address you sign in
        with, asking us to delete your account. We confirm by email before acting.
      </p>

      <h2>What is deleted, and when</h2>
      <ul>
        <li>Your account, your garages and their vehicles, records, documents and photos, reminders, and workshops you own with their jobs and customers.</li>
        <li>Everything is permanently removed 30 days after you delete. Until then we can restore the account if you ask, for example after a mistake.</li>
        <li>Records you added to a garage someone else owns stay with that garage, shown with the name you entered.</li>
      </ul>
    </>
  );
}
