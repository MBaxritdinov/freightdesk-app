import { Link } from 'react-router-dom'

export default function Terms() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="mb-8">
          <Link to="/login" className="text-blue-400 hover:text-blue-300 text-sm transition">
            &larr; Back to Login
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-slate-400 text-sm mb-10">Effective date: January 1, 2025</p>

        <div className="space-y-8 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using FreightDesk ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree, do not use the Service. These terms apply to all users,
              including dispatchers, accountants, and administrators.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              FreightDesk is a dispatch and accounting platform for freight and trucking companies. It
              provides tools for load management, document parsing, driver settlements, broker management,
              and reporting. Access is provided on a software-as-a-service basis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Service Provided As-Is</h2>
            <p className="mb-3">
              The Service is provided <strong className="text-white">"as is"</strong> and{' '}
              <strong className="text-white">"as available"</strong> without warranties of any kind, either
              express or implied. FreightDesk does not warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>The Service will be uninterrupted, error-free, or secure at all times</li>
              <li>AI-parsed document data will be accurate or complete</li>
              <li>Distance and ETA calculations will be exact</li>
              <li>Calculated rates, settlements, or reports are free of errors</li>
            </ul>
            <p className="mt-3">
              You are responsible for verifying all data before using it for business decisions, payments,
              or legal documents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. User Responsibilities</h2>
            <p className="mb-3">You agree that:</p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>You are responsible for all data you enter into the platform</li>
              <li>You will not use the platform for any unlawful purpose</li>
              <li>You will keep your login credentials secure and not share them</li>
              <li>You are solely responsible for trucking decisions made using the platform</li>
              <li>
                You will not attempt to reverse-engineer, scrape, or disrupt the Service
              </li>
              <li>
                You are responsible for ensuring the data you upload (rate confirmations, documents)
                does not violate any third-party confidentiality agreements
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Limitation of Liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by applicable law, FreightDesk and its operators shall not
              be liable for any:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-300">
              <li>Indirect, incidental, or consequential damages</li>
              <li>Loss of revenue, profits, or business opportunities</li>
              <li>Trucking decisions, route choices, or load acceptances made using the platform</li>
              <li>Errors in AI-extracted document data used for contracts or invoices</li>
              <li>Data loss due to infrastructure outages or force majeure events</li>
            </ul>
            <p className="mt-3">
              FreightDesk is a tool to assist your operations — final decisions and their consequences
              remain with your company.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate accounts that violate these terms, engage in
              abuse of the Service, or create legal risk for FreightDesk. Upon termination, you may
              request an export of your data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Changes to Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use of the Service after changes
              are posted constitutes acceptance of the revised Terms. We will notify active users of
              material changes via email.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the United States. Any disputes shall be resolved
              through binding arbitration, except where prohibited by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{' '}
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
