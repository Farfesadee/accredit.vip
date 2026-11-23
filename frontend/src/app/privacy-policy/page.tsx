import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Accredit Interactive",
  description: "Accredit Interactive privacy policy covering data collection, usage, and your rights.",
};

export default function PrivacyPolicy() {
  const lastUpdated = "23 November 2026";

  return (
    <main className="min-h-screen bg-white dark:bg-gray-950 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto prose prose-gray dark:prose-invert">
        <h1>Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: {lastUpdated}</p>

        <section>
          <h2>1. Who we are</h2>
          <p>
            Accredit Interactive ("we", "us", "our") operates the Accredit.vip event management platform.
            Our registered address is Lagos, Nigeria. Contact: <a href="mailto:info@accredit.vip">info@accredit.vip</a>.
          </p>
        </section>

        <section>
          <h2>2. Data we collect</h2>
          <h3>2.1 From event organisers (our customers)</h3>
          <ul>
            <li>Account details: name, email, password hash, phone number</li>
            <li>Event data: titles, dates, venues, descriptions, images</li>
            <li>Guest lists uploaded by organisers: names, emails, phone numbers, custom fields</li>
            <li>Payment data (via Paystack): transaction references, amounts, timestamps</li>
          </ul>
          <h3>2.2 From event guests (end users)</h3>
          <ul>
            <li>RSVP responses: name, email, phone, attendance choice, custom answers</li>
            <li>QR check-in data: timestamp, device info (scanner only)</li>
            <li>WhatsApp opt-in status when messages are sent via Meta Cloud API</li>
          </ul>
        </section>

        <section>
          <h2>3. How we use data</h2>
          <ul>
            <li>Deliver event invitations, reminders, QR codes via email, SMS, WhatsApp</li>
            <li>Enable accreditation scanning and fraud detection</li>
            <li>Process ticket payments and wallet top-ups via Paystack</li>
            <li>Send transactional WhatsApp messages (templates approved by Meta)</li>
            <li>Analytics for organisers: open rates, delivery status, check-in stats</li>
          </ul>
        </section>

        <section>
          <h2>4. Legal basis (GDPR / NDPR)</h2>
          <ul>
            <li><strong>Contract</strong>: processing guest data to fulfil the organiser's event contract</li>
            <li><strong>Legitimate interest</strong>: platform analytics, fraud prevention, service improvement</li>
            <li><strong>Consent</strong>: WhatsApp promotional templates (guests can opt out anytime)</li>
          </ul>
        </section>

        <section>
          <h2>5. Data sharing</h2>
          <ul>
            <li><strong>Paystack</strong>: payment processing (PCI-DSS compliant)</li>
            <li><strong>Meta (WhatsApp Cloud API)</strong>: template message delivery</li>
            <li><strong>Twilio</strong>: fallback SMS/WhatsApp delivery</li>
            <li><strong>SendGrid / Resend</strong>: transactional email delivery</li>
            <li>No data sold to third parties. Sub-processors listed above.</li>
          </ul>
        </section>

        <section>
          <h2>6. Retention</h2>
          <ul>
            <li>Organiser accounts: until deletion request</li>
            <li>Event data & guest lists: 2 years after event end, then anonymised</li>
            <li>Payment records: 7 years (tax compliance)</li>
            <li>WhatsApp message logs: 90 days</li>
          </ul>
        </section>

        <section>
          <h2>7. Your rights</h2>
          <p>Under GDPR and Nigeria Data Protection Regulation (NDPR) you may:</p>
          <ul>
            <li>Request access, correction, or deletion of your data</li>
            <li>Object to processing or request restriction</li>
            <li>Withdraw WhatsApp consent (reply STOP to any message)</li>
            <li>Lodge a complaint with NDPC (Nigeria) or your EU supervisory authority</li>
          </ul>
          <p>Contact <a href="mailto:privacy@accredit.vip">privacy@accredit.vip</a> to exercise rights.</p>
        </section>

        <section>
          <h2>8. Security</h2>
          <ul>
            <li>TLS 1.2+ in transit, AES-256 at rest</li>
            <li>bcrypt password hashing, JWT with short expiry + rotation</li>
            <li>Rate limiting, CSRF, CSP headers, HSTS</li>
            <li>VPS firewall, fail2ban, automated security updates</li>
          </ul>
        </section>

        <section>
          <h2>9. International transfers</h2>
          <p>Data may be processed in the EU (Meta, SendGrid) and US (Resend). Standard Contractual Clauses apply.</p>
        </section>

        <section>
          <h2>10. Changes</h2>
          <p>We will notify organisers by email of material changes. Continued use constitutes acceptance.</p>
        </section>

        <section>
          <h2>11. Contact</h2>
          <address className="not-italic">
            Accredit Interactive<br />
            Lagos, Nigeria<br />
            Email: <a href="mailto:privacy@accredit.vip">privacy@accredit.vip</a><br />
            DPO: <a href="mailto:dpo@accredit.vip">dpo@accredit.vip</a>
          </address>
        </section>
      </div>
    </main>
  );
}