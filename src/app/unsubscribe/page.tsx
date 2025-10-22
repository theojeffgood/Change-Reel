import React from 'react'

export const metadata = {
  title: 'Unsubscribe • Change Reel',
  description: 'Manage your Change Reel email preferences.',
}

export default function UnsubscribePage() {
  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="text-2xl font-semibold text-gray-900 mb-4">Unsubscribe</h1>
      <p className="text-gray-700 mb-6">
        Enter your email to unsubscribe from Change Reel notifications.
      </p>
      <form className="space-y-4" action="#" method="post" onSubmit={(e) => e.preventDefault()}>
        <label className="block">
          <span className="block text-sm font-medium text-gray-700 mb-1">Email</span>
          <input
            type="email"
            name="email"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-md bg-gray-900 text-white px-4 py-2 font-medium hover:bg-black"
        >
          Unsubscribe
        </button>
      </form>
      <p className="text-xs text-gray-500 mt-4">
        Note: This is a placeholder page. Hook up backend handling to process unsubscribes.
      </p>
    </main>
  )
}


