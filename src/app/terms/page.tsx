import React from 'react'

export const metadata = {
  title: 'Terms of Service • Change Reel',
  description: 'The terms and conditions for using Change Reel.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Terms of Service</h1>
      <p className="text-gray-700 mb-4">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      <section className="space-y-4 text-gray-800 leading-relaxed">
        <h2 className="text-lg font-semibold">Acceptance of Terms</h2>
        <p>
          By accessing or using Change Reel, you agree to be bound by these Terms. If you do not agree,
          do not use the service.
        </p>
        <h2 className="text-lg font-semibold mt-6">Use of the Service</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>You are responsible for your account and activity</li>
          <li>Do not misuse the service or attempt to disrupt its operation</li>
          <li>Comply with all applicable laws and third-party terms</li>
        </ul>
        <h2 className="text-lg font-semibold mt-6">Intellectual Property</h2>
        <p>
          Change Reel and its contents are owned by us or our licensors. You may not copy, modify, or
          distribute our content without permission.
        </p>
        <h2 className="text-lg font-semibold mt-6">Disclaimer and Limitation of Liability</h2>
        <p>
          The service is provided "as is" without warranties of any kind. To the fullest extent permitted
          by law, we disclaim all liability for any damages arising from your use of the service.
        </p>
        <h2 className="text-lg font-semibold mt-6">Changes to Terms</h2>
        <p>
          We may update these Terms from time to time. Your continued use of the service after changes
          take effect constitutes acceptance of the updated Terms.
        </p>
        <h2 className="text-lg font-semibold mt-6">Contact</h2>
        <p>
          Questions about these Terms? Contact
          {' '}<a className="underline" href="mailto:legal@changereel.com">legal@changereel.com</a>.
        </p>
      </section>
    </main>
  )
}


