# Lango English Center - Infrastructure & Local Environment

This directory manages the local development infrastructure and acts as the foundation for the production VPS deployment.

## Tech Stack
- **Database**: PostgreSQL 16 (Relational data, multi-tenancy schema)
- **Cache/Broker**: Redis 7 (BullMQ async jobs, session caching)
- **Reverse Proxy**: Traefik v3 (Local and production domain routing)

## Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine installed.
- Ensure ports `80`, `443`, `5432`, and `6379` are free on your machine.

## Getting Started

1. **Start the environment:**
   From the project root directory, run:
   ```bash
   docker-compose up -d
   ```

2. **Verify Services:**
   ```bash
   docker-compose ps
   ```
   You should see `lango_postgres`, `lango_redis`, and `lango_traefik` running.

3. **Connection Strings:**
   - **PostgreSQL**: `postgresql://lango_admin:lango_secret_password@localhost:5432/lango_db`
   - **Redis**: `redis://:lango_redis_secret@localhost:6379`
   - **Traefik Dashboard**: [http://localhost:8080](http://localhost:8080)

## Data Persistence
The `docker-compose.yml` configures Docker volumes to ensure your database and cache data persists across restarts. 
- Postgres Volume: `lango_postgres_data`
- Redis Volume: `lango_redis_data`

To completely reset the data (destructive action):
```bash
docker-compose down -v
```

## Production Notes
When deploying to the VPS:
1. Environment variables will be injected via `.env` instead of hardcoded in `docker-compose.yml`.
2. Traefik will be configured with Let's Encrypt for automatic SSL certificate generation.
3. Database ports (`5432`, `6379`) will NOT be exposed externally, only accessible inside the `lango_network`.
