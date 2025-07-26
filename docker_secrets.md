# Docker Secrets: A Complete Guide

## What Are Docker Secrets?

A **Docker secret** is a blob of sensitive data—such as a password, SSH private key, or SSL certificate—that you want to manage securely and make available only to specific containers at runtime. Secrets are encrypted in transit and at rest within a Docker Swarm, and are only accessible to services that have been explicitly granted access. This helps prevent accidental exposure of sensitive information in images, logs, or source code [About secrets](https://docs.docker.com/engine/swarm/secrets/#about-secrets).

> **Note:** Docker secrets are only available to Swarm services, not standalone containers. To use secrets, your container must run as a service.

---

## Why Use Docker Secrets?

- **Security:** Secrets are never written to disk unencrypted, nor stored in images or source code.
- **Granular Access:** Only services that need a secret can access it, and only while running.
- **Central Management:** Secrets can be centrally managed and rotated without rebuilding images.

---

## How Docker Manages Secrets

- Secrets are sent to the Swarm manager over a secure TLS connection and stored encrypted in the Raft log.
- When a service is granted access to a secret, it is mounted into the container as an in-memory file (default: `/run/secrets/<secret_name>`).
- When the service stops, the secret is unmounted and flushed from memory.
- You cannot remove a secret that is in use by a running service [How Docker manages secrets](https://docs.docker.com/engine/swarm/secrets/#how-docker-manages-secrets).

---

## Creating and Managing Secrets

### CLI Commands

- **Create a secret:**
  ```sh
  echo "my_password" | docker secret create my_secret_name -
  ```
- **List secrets:**
  ```sh
  docker secret ls
  ```
- **Inspect a secret:**
  ```sh
  docker secret inspect my_secret_name
  ```
- **Remove a secret:**
  ```sh
  docker secret rm my_secret_name
  ```
  > You cannot remove a secret that is currently in use by a service [docker secret](https://docs.docker.com/reference/cli/docker/secret/).

---

## Using Secrets in Services

### Granting Access

Secrets are mounted as files in `/run/secrets/<secret_name>` inside the container. You must explicitly grant each service access to the secrets it needs.

#### Example: Simple Compose File

```yaml
services:
  db:
    image: mysql:latest
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
      MYSQL_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_root_password
      - db_password

secrets:
  db_password:
    file: db_password.txt
  db_root_password:
    file: db_root_password.txt
```
In this example, the MySQL container reads its passwords from files managed by Docker secrets, not from environment variables [Use Secrets in Compose](https://docs.docker.com/engine/swarm/secrets/#use-secrets-in-compose).

---

## Syntax: Short and Long

- **Short syntax:**  
  Mounts the secret as `/run/secrets/<secret_name>`.
  ```yaml
  secrets:
    - my_secret
  ```
- **Long syntax:**  
  Allows specifying the target filename, permissions, and ownership.
  ```yaml
  secrets:
    - source: my_secret
      target: custom_name
      uid: "103"
      gid: "103"
      mode: 0440
  ```
  > Note: `uid`, `gid`, and `mode` are not supported in Docker Compose when the secret source is a file [Compose secrets attribute](https://docs.docker.com/reference/compose-file/services/#secrets).

---

## Using Secrets in Docker Compose

- Define secrets at the top level (`secrets:`).
- Reference them in each service that needs access.
- Secrets are mounted as files in `/run/secrets/` [Manage secrets securely in Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).

---

## Best Practices

- **Never store secrets in images or source code.**
- **Use versioning for secrets** (e.g., `db_password_v2`) to facilitate rotation.
- **Remove secrets from services before deleting them.**
- **Use `_FILE` environment variables** if supported by the image (e.g., MySQL, Postgres) to read secrets from files [Manage secrets securely in Docker Compose](https://docs.docker.com/compose/how-tos/use-secrets/).

---

## Rotating Secrets

1. **Create a new secret** (e.g., `db_password_v2`).
2. **Update services** to use the new secret, possibly granting access to both old and new secrets temporarily.
3. **Update the application/database** to use the new secret.
4. **Remove the old secret** from the service and then from Docker [Example: Rotate a secret](https://docs.docker.com/engine/swarm/secrets/#example-rotate-a-secret).

---

## Build-Time Secrets

- **Build secrets** are used during the image build process and are not persisted in the final image.
- Pass secrets with `docker build --secret id=mysecret,src=secret.txt`.
- Use in Dockerfile:
  ```dockerfile
  RUN --mount=type=secret,id=mysecret cat /run/secrets/mysecret
  ```
  [Build secrets](https://docs.docker.com/build/building/secrets/)

---

## Limitations

- **Swarm-only:** Docker secrets are only available to Swarm services, not standalone containers.
- **Size limit:** Each secret can be up to 500 KB.
- **No update-in-place:** You cannot update a secret; you must create a new one and update services to use it.

---

## Summary

Docker secrets provide a secure, manageable way to handle sensitive data in containerized applications. By mounting secrets as in-memory files, Docker ensures that sensitive information is never written to disk or exposed in images or logs. Use secrets for passwords, certificates, and other confidential data, and follow best practices for rotation and access control.

For more details and advanced usage, refer to the official Docker documentation on [managing secrets](https://docs.docker.com/engine/swarm/secrets/).