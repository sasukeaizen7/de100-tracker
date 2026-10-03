export default function Privacy() {
  return (
    <article className="card prose">
      <h1>Privacy policy</h1>
      <p className="muted small">Last updated 27 September 2026. Replace the contact details below before publishing.</p>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account:</strong> your email address and, if you use Google sign-in, your name.</li>
        <li><strong>Progress:</strong> which program days you mark done, your notes, and a percentage per course.</li>
        <li><strong>Devices:</strong> a name for each connected Chrome extension and when it last synced.</li>
      </ul>

      <h2>What the Chrome extension does</h2>
      <p>
        When you press Sync (or at most once an hour if you turn on auto-sync), the extension reads the list of
        Udemy courses you're enrolled in from your open Udemy session, and sends only each course's title and
        completion percentage to this app. It never reads or stores your Udemy password or cookies, and it has
        no access to other websites.
      </p>

      <h2>Why (legal basis)</h2>
      <p>We process this data to provide the tracker you signed up for (performance of a contract, GDPR art. 6(1)(b)). We don't sell it, share it, or use it for advertising.</p>

      <h2>Where it's stored</h2>
      <p>Data is stored in a PostgreSQL database run by [your hosting provider] in [region; choose the EU]. The API only ever returns an account's own data. Passwords and sign-in tokens are stored only as one-way hashes, never in plain text.</p>

      <h2>How long</h2>
      <p>Until you delete your account. Deleting it removes all your data immediately; backups expire within the provider's retention window.</p>

      <h2>Your rights</h2>
      <p>
        You can export all your data or delete your account at any time from the Account page. You can also
        request access, correction or erasure, or complain to the CNIL (cnil.fr).
      </p>

      <h2>Contact</h2>
      <p>Controller: [your name], [your contact email].</p>
    </article>
  );
}
