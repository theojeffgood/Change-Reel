import React from 'react'

export const metadata = {
  title: 'Privacy Policy • Change Reel',
  description: 'How Change Reel collects, uses, and protects your data.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Privacy Policy</h1>
      <p className="text-gray-700 mb-4">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      <section className="space-y-4 text-gray-800 leading-relaxed">
        <p>
          This Privacy Policy explains how Change Reel ("we", "us", or "our") collects, uses, and
          protects your information when you use our services.
        </p>
        <h2 className="text-lg font-semibold mt-6">Information We Collect</h2>
        <p>
          We may collect account information, repository metadata, and operational logs necessary to
          provide commit summaries, release notes, and related functionality.
        </p>
        <h2 className="text-lg font-semibold mt-6">How We Use Information</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Provide and improve the Change Reel service</li>
          <li>Generate commit summaries and notifications you request</li>
          <li>Communicate important updates and service notifications</li>
          <li>Maintain security, prevent abuse, and comply with legal obligations</li>
        </ul>
        <h2 className="text-lg font-semibold mt-6">Data Sharing</h2>
        <p>
          We do not sell your personal data. We may share data with service providers who process it on
          our behalf under appropriate safeguards, or when required by law.
        </p>
        <h2 className="text-lg font-semibold mt-6">Data Retention</h2>
        <p>
          We retain information only for as long as necessary to provide our services and meet legal or
          operational requirements.
        </p>
        <h2 className="text-lg font-semibold mt-6">Your Choices</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Manage email preferences or unsubscribe from notifications at any time</li>
          <li>Contact us to request access, correction, or deletion where applicable</li>
        </ul>
        <h2 className="text-lg font-semibold mt-6">Contact</h2>
        <p>
          If you have questions about this Privacy Policy, contact us at
          {' '}<a className="underline" href="mailto:support@changereel.com">support@changereel.com</a>.
        </p>
      </section>
    </main>
  )
}


