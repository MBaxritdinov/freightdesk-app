import { Link } from 'react-router-dom'

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm transition">
            &larr; Back to Login
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-slate-400 text-sm mb-10">Effective date: January 1, 2025</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Overview</h2>
            <p>
              FreightDesk ("we", "us", or "our") is a logistics dispatch and accounting platform built for
              freight companies. This Privacy Policy explains what data we collect, how we use it, and how
              we protect it.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Data We Collect</h2>
            <p className="mb-3">We collect only the data necessary to operate the dispatch platform:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>
                <span className="text-white font-medium">Load data</span> — load numbers, pickup and delivery
                locations, rates, dates, broker information, and driver assignments entered by your team.
              </li>
              <li>
                <span className="text-white font-medium">Email content</span> — if you connect a Gmail inbox,
                we read rate confirmation emails from brokers in your whitelist to automatically create loads.
                Email bodies are processed by an AI model and then discarded; we do not store raw email content.
              </li>
              <li>
                <span className="text-white font-medium">User accounts</span> — names, email addresses, and
                hashed passwords for team members you create in the platform.
              </li>
              <li>
                <span className="text-white font-medium">Usage data</span> — standard server logs including
                IP addresses and request timestamps, retained for 30 days for security purposes.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Data</h2>
            <p className="mb-3">Your data is used exclusively to operate FreightDesk for your company:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>Displaying loads, drivers, brokers, and settlements in the platform</li>
              <li>Generating Bills of Lading, invoices, and settlement reports</li>
              <li>Parsing broker rate confirmation emails into load records</li>
              <li>Sending Telegram notifications to drivers about settlements</li>
              <li>Authenticating team members and enforcing role-based access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Sharing</h2>
            <p className="mb-3">
              We do not sell, rent, or share your data with third parties for marketing or advertising.
              Data is shared only with:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>
                <span className="text-white font-medium">Anthropic</span> — document images and PDFs are
                sent to Claude AI for field extraction. Anthropic's data handling is governed by their
                API privacy policy.
              </li>
              <li>
                <span className="text-white font-medium">Google</span> — if Gmail is connected, we use
                Google's Gmail API under your authorized OAuth credentials.
              </li>
              <li>
                <span className="text-white font-medium">Telegram</span> — if the Telegram bot is configured,
                settlement messages are sent via the Telegram Bot API.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Storage</h2>
            <p>
              All load data, user accounts, and application data are stored in a PostgreSQL database hosted
              on Railway (railway.app). Data is stored in the United States. Railway's infrastructure
              is SOC 2 compliant.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. You may request deletion of your
              account and all associated data at any time by contacting us. After deletion, data is removed
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Security</h2>
            <p>
              Passwords are hashed using bcrypt and never stored in plaintext. All connections use HTTPS.
              JWT tokens are used for session authentication and expire after 8 hours. We do not log
              passwords or authentication tokens.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>Access the data we hold about you</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Export your load data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
            <p>
              For privacy questions or data requests, contact us at{' '}
              <a href="mailto:admin@freightdesk.io" className="text-blue-400 hover:text-blue-300 transition">
                admin@freightdesk.io
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-700 flex gap-6 text-sm text-slate-500">
          <Link to="/privacy" className="hover:text-slate-300 transition">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-slate-300 transition">Terms of Service</Link>
        </div>
      </div>
    </div>
  )
}
