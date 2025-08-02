# S3 Configuration Guide

This guide explains how to configure AWS S3 for storing invoice PDFs in GSTHive.

## Prerequisites

1. AWS Account with S3 access
2. IAM user with S3 permissions
3. S3 bucket created

## Environment Variables

Add these to your `.env` file:

```bash
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# AWS Configuration
AWS_REGION=us-east-1  # Your AWS region
AWS_S3_BUCKET=gsthive-uploads  # Your S3 bucket name
```

## AWS IAM Policy

Create an IAM user with the following policy for S3 access:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::gsthive-uploads/*",
        "arn:aws:s3:::gsthive-uploads"
      ]
    }
  ]
}
```

## S3 Bucket Configuration

### 1. Create S3 Bucket

```bash
aws s3 mb s3://gsthive-uploads --region us-east-1
```

### 2. Configure CORS (if needed for direct browser uploads)

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "AllowedOrigins": ["https://gsthive.com", "https://dev.gsthive.com"],
      "ExposeHeaders": ["ETag"]
    }
  ]
}
```

### 3. Bucket Policy (Optional - for public read access)

If you want PDFs to be publicly accessible:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::gsthive-uploads/invoices/*"
    }
  ]
}
```

## How It Works

1. **Local Development**: If S3 is not configured, PDFs are saved to `uploads/invoices/` directory
2. **Production**: With S3 configured, PDFs are uploaded to S3 bucket
3. **Fallback**: If S3 upload fails, system falls back to local storage

## File Structure in S3

```
gsthive-uploads/
└── invoices/
    ├── invoice-FY24-25-001.pdf
    ├── invoice-FY24-25-002.pdf
    └── ...
```

## Testing S3 Configuration

1. Set environment variables
2. Restart the application
3. Generate a test invoice PDF
4. Check S3 bucket for the uploaded file

## Security Considerations

1. **Never commit AWS credentials** - Use environment variables
2. **Use IAM roles** in production (EC2/ECS) instead of access keys
3. **Enable S3 versioning** for backup
4. **Enable S3 encryption** for sensitive data
5. **Consider using CloudFront** for faster global access

## Troubleshooting

### Common Issues

1. **Access Denied**: Check IAM permissions
2. **Bucket not found**: Verify bucket name and region
3. **Network timeout**: Check AWS region configuration
4. **CORS errors**: Update bucket CORS configuration

### Debug Mode

Enable AWS SDK debug logging:

```bash
export AWS_SDK_LOAD_CONFIG=1
export AWS_SDK_JS_DEBUG=1
```

## Alternative: CloudFlare R2

GSTHive can also work with CloudFlare R2 (S3-compatible):

```bash
# For R2
AWS_ACCESS_KEY_ID=your-r2-access-key
AWS_SECRET_ACCESS_KEY=your-r2-secret-key
AWS_REGION=auto
AWS_S3_BUCKET=gsthive-uploads
AWS_ENDPOINT_URL=https://your-account-id.r2.cloudflarestorage.com
```

Update the S3 client initialization in `pdf-uploader-s3.ts` to include the endpoint.