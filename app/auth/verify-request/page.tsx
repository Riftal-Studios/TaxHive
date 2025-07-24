export default function VerifyRequest() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-4">
          <div className="text-6xl">📧</div>
          <h1 className="text-3xl font-bold">Check your email</h1>
          <p className="text-gray-600">
            A sign in link has been sent to your email address. Click the link to sign in to your account.
          </p>
          <p className="text-sm text-gray-500">
            If you don&apos;t see the email, check your spam folder.
          </p>
        </div>
      </div>
    </div>
  )
}