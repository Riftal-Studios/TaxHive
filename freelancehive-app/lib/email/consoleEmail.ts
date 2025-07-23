import { SendVerificationRequestParams } from 'next-auth/providers/email'

export async function sendVerificationRequestConsole({
  identifier: email,
  url,
  provider,
}: SendVerificationRequestParams) {
  
  console.log('\n' + '='.repeat(80))
  console.log('🔐 GSTHIVE MAGIC LINK GENERATED')
  console.log('='.repeat(80))
  console.log(`To: ${email}`)
  console.log(`From: ${provider.from}`)
  console.log('\nClick the link below to sign in to GSTHive:')
  console.log(`\n${url}\n`)
  console.log('This link will expire in 24 hours.')
  console.log('='.repeat(80) + '\n')
}