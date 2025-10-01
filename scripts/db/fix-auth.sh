#!/bin/bash

echo "Fixing TaxHive authentication issues..."
echo ""

# 1. Clear browser cookies
echo "1. Clear your browser cookies for localhost:3000"
echo "   - Open DevTools (F12)"
echo "   - Go to Application/Storage tab"
echo "   - Clear all cookies for localhost"
echo ""

# 2. Generate new NEXTAUTH_SECRET
echo "2. Generating new NEXTAUTH_SECRET..."
NEW_SECRET=$(openssl rand -base64 32)
echo "   New secret generated: $NEW_SECRET"
echo ""

# 3. Update .env.local
echo "3. Updating .env.local with new secret..."
if [ -f ".env.local" ]; then
    # Check if NEXTAUTH_SECRET exists
    if grep -q "^NEXTAUTH_SECRET=" .env.local; then
        # Update existing
        sed -i.bak "s/^NEXTAUTH_SECRET=.*/NEXTAUTH_SECRET=\"$NEW_SECRET\"/" .env.local
        echo "   ✅ Updated NEXTAUTH_SECRET"
    else
        # Add new
        echo "NEXTAUTH_SECRET=\"$NEW_SECRET\"" >> .env.local
        echo "   ✅ Added NEXTAUTH_SECRET"
    fi
else
    echo "   ❌ .env.local not found!"
    exit 1
fi

# 4. Fix email configuration
echo ""
echo "4. Email configuration options:"
echo ""
echo "Option A: Use console email (recommended for development)"
echo "   Set EMAIL_SERVER=\"\" in .env.local"
echo "   Magic links will appear in the console"
echo ""
echo "Option B: Use Ethereal Email (test SMTP)"
echo "   1. Go to https://ethereal.email/create"
echo "   2. Copy the SMTP credentials"
echo "   3. Update EMAIL_SERVER in .env.local"
echo ""
echo "Option C: Use Gmail with app password"
echo "   1. Enable 2FA on your Google account"
echo "   2. Generate app password: https://myaccount.google.com/apppasswords"
echo "   3. Set EMAIL_SERVER=\"smtp://your-email@gmail.com:app-password@smtp.gmail.com:587\""
echo ""

# 5. Show current email config
echo "Current EMAIL_SERVER configuration:"
grep "^EMAIL_SERVER=" .env.local || echo "EMAIL_SERVER not set"
echo ""

echo "To fix email, edit .env.local and choose one of the options above."
echo ""
echo "After making changes, restart the application with ./start-all.sh"