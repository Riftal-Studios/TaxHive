import { createTransport } from 'nodemailer'
import type { SendVerificationRequestParams } from 'next-auth/providers/email'

export async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: SendVerificationRequestParams) {
  const { server, from } = provider
  const transport = createTransport(server)
  const result = await transport.sendMail({
    to: email,
    from,
    subject: 'Sign in to FreelanceHive',
    text: text({ url, email }),
    html: html({ url, email }),
  })
  const failed = result.rejected.filter(Boolean)
  if (failed.length) {
    throw new Error(`Email(s) (${failed.join(', ')}) could not be sent`)
  }
}

function html({ url, email }: { url: string; email: string }) {
  // Only escape dots in the displayed email, not in the URL
  const escapedEmail = `${email.replace(/\./g, '&#8203;.')}`
  
  return `
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #f9fafb; padding: 40px 0;">
      <table width="100%" border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" border="0" cellspacing="0" cellpadding="0" style="background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
              <tr>
                <td style="padding: 40px;">
                  <h1 style="color: #1f2937; font-size: 24px; font-weight: bold; margin: 0 0 24px;">Sign in to FreelanceHive</h1>
                  <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                    Hello ${escapedEmail},
                  </p>
                  <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin: 0 0 32px;">
                    Click the button below to sign in to your FreelanceHive account. This link will expire in 24 hours.
                  </p>
                  <table border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td align="center" style="border-radius: 6px; background: #4f46e5;">
                        <a href="${url}" target="_blank" style="display: inline-block; padding: 12px 24px; font-size: 16px; color: white; text-decoration: none; border-radius: 6px;">
                          Sign in to FreelanceHive
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="color: #6b7280; font-size: 14px; line-height: 20px; margin: 32px 0 0;">
                    If you didn't request this email, you can safely ignore it.
                  </p>
                  <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
                  <p style="color: #9ca3af; font-size: 12px; line-height: 16px; margin: 0;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <a href="${url}" style="color: #6b7280; text-decoration: none;">${url}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  `
}

function text({ url, email }: { url: string; email: string }) {
  return `Sign in to FreelanceHive

Hello ${email},

Click the link below to sign in to your FreelanceHive account:

${url}

This link will expire in 24 hours.

If you didn't request this email, you can safely ignore it.

FreelanceHive - GST-Compliant Invoice Management for Indian Freelancers
`
}