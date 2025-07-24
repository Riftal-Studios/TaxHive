#!/bin/bash
# Production deployment script for gsthive.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.production.yml"
ENV_FILE=".env.production"

# Functions
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f "$ENV_FILE" ]; then
        print_error "Environment file $ENV_FILE not found"
        print_info "Copy .env.example to .env.production and fill in production values"
        exit 1
    fi
    
    # Check required environment variables
    required_vars=(
        "CLOUDFLARE_TUNNEL_TOKEN"
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "NEXTAUTH_SECRET"
        "SMTP_HOST"
        "EXCHANGE_RATE_API_KEY"
    )
    
    source "$ENV_FILE"
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            print_error "Required environment variable $var is not set"
            exit 1
        fi
    done
    
    print_info "All prerequisites met!"
}

# Deploy function
deploy() {
    case "$1" in
        "build")
            print_info "Building Docker images..."
            docker-compose -f "$COMPOSE_FILE" build
            ;;
            
        "up")
            print_info "Starting all services..."
            docker-compose -f "$COMPOSE_FILE" up -d
            print_info "Waiting for services to be healthy..."
            sleep 10
            docker-compose -f "$COMPOSE_FILE" ps
            ;;
            
        "down")
            print_info "Stopping all services..."
            docker-compose -f "$COMPOSE_FILE" down
            ;;
            
        "restart")
            print_info "Restarting all services..."
            docker-compose -f "$COMPOSE_FILE" restart
            ;;
            
        "logs")
            docker-compose -f "$COMPOSE_FILE" logs -f "${2:-}"
            ;;
            
        "migrate")
            print_info "Running database migrations..."
            docker-compose -f "$COMPOSE_FILE" exec app npx prisma migrate deploy
            ;;
            
        "seed")
            print_info "Seeding database with test data..."
            docker-compose -f "$COMPOSE_FILE" exec app npx tsx scripts/seed-test-data.ts
            ;;
            
        "backup")
            print_info "Creating database backup..."
            timestamp=$(date +%Y%m%d_%H%M%S)
            docker-compose -f "$COMPOSE_FILE" exec postgres pg_dump -U gsthive gsthive > "backup_${timestamp}.sql"
            print_info "Backup saved to backup_${timestamp}.sql"
            ;;
            
        "restore")
            if [ -z "$2" ]; then
                print_error "Please provide backup file name"
                exit 1
            fi
            print_info "Restoring database from $2..."
            docker-compose -f "$COMPOSE_FILE" exec -T postgres psql -U gsthive gsthive < "$2"
            ;;
            
        "health")
            print_info "Checking application health..."
            docker-compose -f "$COMPOSE_FILE" exec app wget -qO- http://localhost:3000/api/health | jq .
            ;;
            
        "shell")
            service="${2:-app}"
            print_info "Opening shell in $service container..."
            docker-compose -f "$COMPOSE_FILE" exec "$service" sh
            ;;
            
        "update")
            print_info "Updating application..."
            git pull
            deploy build
            deploy down
            deploy up
            deploy migrate
            ;;
            
        *)
            echo "Usage: $0 {build|up|down|restart|logs|migrate|seed|backup|restore|health|shell|update}"
            echo ""
            echo "Commands:"
            echo "  build     - Build all Docker images"
            echo "  up        - Start all services"
            echo "  down      - Stop all services"
            echo "  restart   - Restart all services"
            echo "  logs      - Show logs (optionally specify service)"
            echo "  migrate   - Run database migrations"
            echo "  seed      - Seed database with test data"
            echo "  backup    - Create database backup"
            echo "  restore   - Restore database from backup"
            echo "  health    - Check application health"
            echo "  shell     - Open shell in container (default: app)"
            echo "  update    - Pull latest code and redeploy"
            exit 1
            ;;
    esac
}

# Main execution
print_info "GST Hive Deployment Script"
print_info "========================="

if [ "$1" != "logs" ] && [ "$1" != "shell" ]; then
    check_prerequisites
fi

deploy "$@"