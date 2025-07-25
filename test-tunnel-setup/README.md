# Test Cloudflare Tunnel Setup

This is a minimal test to verify the Cloudflare tunnel works with the gsthive.com token.

## To test:

1. Install dependencies:
```bash
cd test-tunnel-setup
npm install
```

2. Run with Docker Compose:
```bash
docker-compose up --build
```

3. Check the logs:
- Look for the test-tunnel container logs
- If it connects successfully, you should see "Connection registered" messages
- Try accessing https://gsthive.com - it should return the JSON response

4. Check logs:
```bash
docker logs test-tunnel
```

## What this tests:
- Basic Express server on port 3000
- Cloudflare tunnel connecting to the app
- The tunnel token for gsthive.com

If this works but production doesn't, the issue is with the production setup specifically.