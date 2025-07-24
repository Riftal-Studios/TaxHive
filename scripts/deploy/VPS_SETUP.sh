#!/bin/bash
# VPS Setup Script for GST Hive
# Run this on a fresh Ubuntu 22.04 VPS

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root!"
   print_info "Please run as a regular user with sudo privileges"
   exit 1
fi

print_info "Starting VPS setup for GST Hive..."

# Update system
print_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install required packages
print_info "Installing required packages..."
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    ufw \
    fail2ban \
    unattended-upgrades \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release

# Install Docker
print_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    print_warning "You need to log out and back in for docker group changes to take effect"
else
    print_info "Docker already installed"
fi

# Install Docker Compose
print_info "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    print_info "Docker Compose already installed"
fi

# Configure firewall
print_info "Configuring firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Configure fail2ban
print_info "Configuring fail2ban..."
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Configure automatic security updates
print_info "Configuring automatic security updates..."
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades
sudo systemctl enable unattended-upgrades

# Create deployment directory
print_info "Creating deployment directory..."
mkdir -p ~/gsthive
cd ~/gsthive

# Create docker-compose.yml placeholder
cat > docker-compose.yml << 'EOF'
# This file will be replaced by GitHub Actions deployment
version: '3.8'
services:
  app:
    image: hello-world
EOF

# Set up log rotation
print_info "Setting up log rotation..."
sudo tee /etc/logrotate.d/docker-containers << 'EOF'
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
EOF

# Create systemd service for auto-start
print_info "Creating systemd service..."
sudo tee /etc/systemd/system/gsthive.service << EOF
[Unit]
Description=GST Hive Docker Compose
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/$USER/gsthive
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
User=$USER
Group=docker

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable gsthive

# Set up monitoring
print_info "Setting up basic monitoring..."
cat > ~/gsthive/monitor.sh << 'EOF'
#!/bin/bash
# Simple health check script

HEALTH_URL="http://localhost:3000/api/health"
WEBHOOK_URL=""  # Add your webhook URL for notifications

check_health() {
    response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)
    if [ $response -ne 200 ]; then
        echo "Health check failed with status: $response"
        # Send notification if webhook is configured
        if [ ! -z "$WEBHOOK_URL" ]; then
            curl -X POST $WEBHOOK_URL -H "Content-Type: application/json" \
                -d "{\"text\":\"GST Hive health check failed with status: $response\"}"
        fi
        # Attempt restart
        cd /home/$USER/gsthive && docker-compose restart
    fi
}

check_health
EOF

chmod +x ~/gsthive/monitor.sh

# Add health check to crontab
(crontab -l 2>/dev/null; echo "*/5 * * * * /home/$USER/gsthive/monitor.sh") | crontab -

# Create backup script
print_info "Creating backup script..."
cat > ~/gsthive/backup.sh << 'EOF'
#!/bin/bash
# Database backup script

BACKUP_DIR="/home/$USER/backups"
mkdir -p $BACKUP_DIR

# Create backup
cd /home/$USER/gsthive
timestamp=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U gsthive gsthive > "$BACKUP_DIR/gsthive_backup_$timestamp.sql"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "gsthive_backup_*.sql" -mtime +7 -delete

# Compress backups older than 1 day
find $BACKUP_DIR -name "gsthive_backup_*.sql" -mtime +1 -exec gzip {} \;
EOF

chmod +x ~/gsthive/backup.sh

# Add backup to crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$USER/gsthive/backup.sh") | crontab -

# System information
print_info "System setup complete!"
echo ""
echo "================== SYSTEM INFO =================="
echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker-compose --version)"
echo "UFW Status: $(sudo ufw status)"
echo "Deployment directory: ~/gsthive"
echo ""
echo "================== NEXT STEPS =================="
echo "1. Log out and back in for docker group changes"
echo "2. Add your SSH public key to ~/.ssh/authorized_keys"
echo "3. Configure GitHub secrets with this server's details:"
echo "   - VPS_HOST: $(curl -s ifconfig.me)"
echo "   - VPS_USER: $USER"
echo "   - VPS_PORT: 22"
echo "4. Run GitHub Actions deployment workflow"
echo ""
echo "================== SECURITY NOTES =================="
echo "- Firewall is enabled (SSH, HTTP, HTTPS only)"
echo "- Fail2ban is protecting SSH"
echo "- Automatic security updates are enabled"
echo "- Consider changing SSH port for extra security"
echo "=============================================="