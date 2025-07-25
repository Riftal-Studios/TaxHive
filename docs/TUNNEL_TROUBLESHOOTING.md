# Cloudflare Tunnel Troubleshooting

## Common Issues

### 1. "Context Canceled" Errors

If you see repeated "context canceled" errors in the tunnel logs:

```
ERR Failed to serve tunnel connection error="context canceled"
```

**Possible Causes:**

1. **Invalid Token**: The tunnel token might be invalid or corrupted
   - Run `./check-tunnel-token.sh` to validate the token format
   - Ensure the GitHub secret doesn't have extra spaces or newlines

2. **Tunnel Configuration Mismatch**: The tunnel configuration in Cloudflare dashboard doesn't match your setup
   - Check that the tunnel is configured to route to `http://app:3000`
   - Verify the tunnel hasn't been deleted and recreated

3. **Container Health Checks**: Docker might be restarting the container
   - Check restart count: `docker inspect gsthive-tunnel --format='{{.RestartCount}}'`
   - If high, the health check might be failing

4. **Network Issues**: The tunnel can't reach the app container
   - Ensure both containers are on the same network
   - Test connectivity: `docker exec gsthive-tunnel wget -qO- http://app:3000/api/health`

### 2. UDP Buffer Size Warnings

If you see:
```
failed to sufficiently increase receive buffer size
```

This is handled by the sysctls in docker-compose.production.yml but may require host-level changes:

```bash
# On the host system:
sudo sysctl -w net.core.rmem_default=7168000
sudo sysctl -w net.core.rmem_max=7168000
```

### 3. Debugging Steps

1. **Check Container Status**:
   ```bash
   ./debug-production.sh
   ```

2. **Test Token Locally**:
   ```bash
   export CLOUDFLARE_TUNNEL_TOKEN='your-token-here'
   docker run --rm -e TUNNEL_TOKEN=$CLOUDFLARE_TUNNEL_TOKEN cloudflare/cloudflared:latest tunnel --no-autoupdate run
   ```

3. **Verify Tunnel Configuration**:
   - Log into Cloudflare Zero Trust dashboard
   - Navigate to Access > Tunnels
   - Find your tunnel and check:
     - Public hostname: gsthive.com
     - Service: http://app:3000
     - Additional application settings if any

4. **Check GitHub Secrets**:
   - Ensure CLOUDFLARE_TUNNEL_TOKEN is set correctly
   - No extra whitespace or newlines
   - Token hasn't expired or been regenerated

### 4. Working Configuration Reference

The staging environment (stage.gsthive.com) uses the same configuration and works correctly:
- Container depends on app (not app health)
- Standard health check with 40s start period
- No special network configuration

If staging works but production doesn't, the issue is likely:
- Different tunnel token
- Different tunnel configuration in Cloudflare
- Host-specific network/firewall issues