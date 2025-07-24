// Email validation functions that are safe to use on the client side

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validateEmails(emails: string | string[]): boolean {
  const emailList = Array.isArray(emails) ? emails : [emails]
  return emailList.every(validateEmail)
}