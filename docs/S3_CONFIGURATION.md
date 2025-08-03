# S3 Configuration Guide

This guide explains how to configure AWS S3 for storing invoice PDFs in GSTHive.

## Prerequisites

1. AWS Account with S3 access
2. IAM user with S3 permissions
3. S3 bucket created

## Environment Variables

Add these to your `.env` file:

```bash
# AWS Credentials (Required)
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# Basic Configuration (Required)
AWS_REGION=us-east-1              # Default AWS region
AWS_S3_BUCKET=gsthive-uploads     # Your S3 bucket name

# Advanced Configuration (Optional)
AWS_S3_REGION=ap-south-1          # Override region for S3 only
AWS_S3_ENDPOINT=                  # Custom endpoint for S3-compatible services
AWS_S3_FORCE_PATH_STYLE=false     # Set to true for MinIO/LocalStack
AWS_S3_PUBLIC_READ=false          # Set to true to make uploads public by default
```

### Configuration Options Explained

- **AWS_S3_REGION**: Use this to override the region specifically for S3 if your bucket is in a different region than your other AWS services
- **AWS_S3_ENDPOINT**: For S3-compatible services like CloudFlare R2, MinIO, or LocalStack
- **AWS_S3_FORCE_PATH_STYLE**: Required for some S3-compatible services that don't support virtual-hosted-style URLs
- **AWS_S3_PUBLIC_READ**: Automatically makes uploaded PDFs publicly accessible (use with caution)

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
AWS_S3_BUCKET=gsthive-uploads
AWS_S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
AWS_S3_REGION=auto  # R2 uses 'auto' as region
```

## Alternative: MinIO (Self-hosted S3)

For local development or self-hosted S3:

```bash
# For MinIO
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_S3_BUCKET=gsthive-uploads
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_FORCE_PATH_STYLE=true  # Required for MinIO
AWS_S3_REGION=us-east-1       # MinIO default
```