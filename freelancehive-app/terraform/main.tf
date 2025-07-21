terraform {
  required_version = ">= 1.0"
  
  required_providers {
    fly = {
      source  = "fly-apps/fly"
      version = "~> 0.0.21"
    }
  }
  
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "fly" {
  # Fly.io API token should be set via FLY_API_TOKEN env var
}

# Variables
variable "app_name" {
  description = "Name of the Fly.io application"
  type        = string
  default     = "freelancehive"
}

variable "region" {
  description = "Primary region for deployment"
  type        = string
  default     = "sin" # Singapore for India proximity
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "nextauth_secret" {
  description = "NextAuth secret"
  type        = string
  sensitive   = true
}

variable "email_server" {
  description = "Email server configuration"
  type        = string
  sensitive   = true
}

variable "cron_secret" {
  description = "Secret for cron job authentication"
  type        = string
  sensitive   = true
}

# Create Fly.io app
resource "fly_app" "freelancehive" {
  name = var.app_name
  org  = "personal"
}

# PostgreSQL database
resource "fly_postgres_cluster" "freelancehive_db" {
  name            = "${var.app_name}-db"
  app_id          = fly_app.freelancehive.id
  region          = var.region
  initial_cluster_size = "shared-cpu-1x"
  vm_size         = "shared-cpu-1x"
  volume_size     = 1 # 1GB
  postgres_password = var.postgres_password
}

# Redis instance
resource "fly_machine" "redis" {
  app    = fly_app.freelancehive.id
  region = var.region
  name   = "${var.app_name}-redis"
  image  = "flyio/redis:7"
  
  services = [{
    ports = [{
      port     = 6379
      handlers = ["tcp"]
    }]
    protocol      = "tcp"
    internal_port = 6379
  }]
  
  env = {
    REDIS_PASSWORD = ""
  }
  
  resources = {
    cpu_kind    = "shared"
    cpus        = 1
    memory_mb   = 256
  }
}

# Main application
resource "fly_machine" "app" {
  app    = fly_app.freelancehive.id
  region = var.region
  name   = "${var.app_name}-app"
  image  = "registry.fly.io/${var.app_name}:latest"
  
  services = [{
    ports = [{
      port     = 443
      handlers = ["http", "tls"]
    }, {
      port     = 80
      handlers = ["http"]
    }]
    protocol      = "tcp"
    internal_port = 3000
    
    concurrency = {
      type       = "requests"
      soft_limit = 200
      hard_limit = 250
    }
  }]
  
  env = {
    NODE_ENV         = "production"
    PORT             = "3000"
    DATABASE_URL     = fly_postgres_cluster.freelancehive_db.connection_string
    REDIS_URL        = "redis://${fly_machine.redis.privateip}:6379"
    NEXTAUTH_URL     = "https://${var.app_name}.fly.dev"
    NEXTAUTH_SECRET  = var.nextauth_secret
    EMAIL_SERVER     = var.email_server
    EMAIL_FROM       = "noreply@${var.app_name}.fly.dev"
    CRON_SECRET      = var.cron_secret
  }
  
  resources = {
    cpu_kind    = "shared"
    cpus        = 1
    memory_mb   = 512
  }
  
  depends_on = [
    fly_postgres_cluster.freelancehive_db,
    fly_machine.redis
  ]
}

# Outputs
output "app_url" {
  value = "https://${var.app_name}.fly.dev"
}

output "postgres_connection_string" {
  value     = fly_postgres_cluster.freelancehive_db.connection_string
  sensitive = true
}

output "redis_internal_address" {
  value = "${fly_machine.redis.privateip}:6379"
}