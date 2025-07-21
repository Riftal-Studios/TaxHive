# Email Configuration for FreelanceHive

## Amazon SES Setup

The application is configured to use Amazon SES for sending magic link emails. Here's the current configuration:

### Environment Variables

```env
EMAIL_SERVER="smtp://SMTP_USERNAME:SMTP_PASSWORD@email-smtp.us-east-1.amazonaws.com:587"
EMAIL_FROM="FreelanceHive <no-reply@freelancehive.app>"
```

### Important Notes

1. **SES Sandbox Mode**: If your AWS account is in SES sandbox mode, you can only send emails to verified email addresses. To send to any email address, you need to request production access.

2. **Verified Domain/Email**: The sender email address (no-reply@freelancehive.app) must be verified in Amazon SES.

3. **AWS Region**: The current configuration uses `us-east-1`. If your SES is in a different region, update the SMTP endpoint accordingly:
   - US East (N. Virginia): `email-smtp.us-east-1.amazonaws.com`
   - US West (Oregon): `email-smtp.us-west-2.amazonaws.com`
   - EU (Ireland): `email-smtp.eu-west-1.amazonaws.com`
   - Asia Pacific (Mumbai): `email-smtp.ap-south-1.amazonaws.com`

### Testing Email Configuration

Run the email test script:
```bash
node scripts/test-email.mjs
```

### Troubleshooting

1. **554 Message rejected**: Email address is not verified. Either verify the recipient email in SES or request production access.

2. **Authentication failed**: Check that your SMTP credentials are correct and active.

3. **Connection timeout**: Ensure port 587 is not blocked by firewall/security groups.

### Security Best Practices

1. **Never commit credentials**: The .env file is gitignored. Never commit actual credentials.

2. **Use environment variables**: In production, set EMAIL_SERVER via environment variables, not files.

3. **Rotate credentials**: Regularly rotate your SMTP credentials.

4. **Monitor usage**: Set up CloudWatch alerts for unusual email sending patterns.

### Production Deployment

For production deployment on services like Fly.io:

```bash
fly secrets set EMAIL_SERVER="smtp://USERNAME:PASSWORD@email-smtp.region.amazonaws.com:587"
fly secrets set EMAIL_FROM="FreelanceHive <no-reply@freelancehive.app>"
```