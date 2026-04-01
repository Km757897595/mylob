# Single-Server Docker Compose CI/CD Design

Date: 2026-04-01

## Goal

Design a low-friction CI/CD workflow for deploying LobeHub to a single public cloud server for end-to-end feature validation, with a specific focus on validating the video generation webhook flow from a real public endpoint.

This environment is intentionally a test environment, not a production architecture. It should be easy to trigger manually, easy to roll back, and close enough to a public deployment that external video providers can reach the callback endpoint.

## Scope

In scope:

- Manual deployment from GitHub Actions
- Single-server deployment with Docker Compose
- Public access via `http://<server-ip>:<port>`
- Co-located `lobe`, `postgresql`, `redis`, `rustfs`, `rustfs-init`, and `searxng`
- Image build and push to Docker Hub
- SSH-based remote deployment
- Simple rollback using image tags
- Environment design for validating video generation callbacks

Out of scope:

- Kubernetes
- Auto-deploy on push
- Multi-environment promotion flow
- Blue/green or canary release orchestration
- Production-grade TLS, domain routing, WAF, or CDN
- Long-term HA, backups, and disaster recovery design

## Current Repo Context

The repository already contains most of the necessary building blocks:

- Docker image build workflows in `.github/workflows/pr-build-docker.yml`
- Docker image publish workflow in `.github/workflows/release-docker.yml`
- A deploy-oriented compose file in `docker-compose/deploy/docker-compose.yml`
- Self-hosting documentation for Docker Compose deployment in `docs/self-hosting/platform/docker-compose.zh-CN.mdx`

Because these assets already exist, the recommended approach is to extend the current Docker-based release path instead of inventing a new deployment mechanism.

## Requirements

Functional requirements:

- A maintainer can manually trigger a deployment from GitHub Actions
- The workflow can deploy a chosen branch, ref, or image tag
- The server can pull and run the selected image using Docker Compose
- LobeHub must be reachable from the public internet
- External video providers must be able to call back into the server
- The deployment must preserve database, Redis, and object storage state across restarts

Operational requirements:

- Deployment should not require building on the server
- Rollback should be possible without changing server-side source code
- Secrets should not be committed into the repository
- The server should only expose ports that are necessary for the test environment

## Recommended Approach

### Option A: Build in GitHub Actions, push to Docker Hub, deploy by SSH

Recommended.

Flow:

1. A maintainer manually triggers a GitHub Actions workflow.
2. The workflow checks out the selected ref.
3. It builds a Docker image and pushes it to Docker Hub using a test-specific tag.
4. The workflow opens an SSH session to the server.
5. The server updates its `.env` and compose runtime configuration if needed.
6. The server runs `docker compose pull` and `docker compose up -d`.

Pros:

- Reuses the repo's existing Docker release direction
- Fast deployments after image build
- No build toolchain pressure on the server
- Easy rollback through image tag selection
- Clear separation between build environment and runtime environment

Cons:

- Requires Docker Hub credentials
- Requires SSH access and server bootstrap

### Option B: Build directly on the server

Not recommended for the primary path.

Flow:

1. GitHub Actions SSHes to the server.
2. The server pulls git changes.
3. The server runs `docker compose build` and `docker compose up -d`.

Pros:

- No remote registry dependency

Cons:

- Slower deployments
- More runtime variability
- Higher CPU and disk pressure on the server
- Harder rollback and version traceability

### Option C: Manual server deployment with no CI/CD

Useful only as an emergency fallback.

Pros:

- Fastest path for one-off debugging

Cons:

- Error-prone
- Poor reproducibility
- Not a real CI/CD solution

## Selected Design

Use Option A.

The system consists of:

- GitHub Actions as the deployment entry point
- Docker Hub as the registry
- A single Linux cloud server as the runtime host
- Docker Compose for orchestration
- A dedicated test compose file derived from `docker-compose/deploy/docker-compose.yml`

## Runtime Topology

Single host services:

- `lobe`
  The application container. Publicly accessible.
- `postgresql`
  Persistent relational database. Internal only.
- `redis`
  Queue/cache backing service. Internal only.
- `rustfs`
  S3-compatible object storage for generated assets. Publicly reachable if required by the app and browser flows.
- `rustfs-init`
  One-shot initialization for bucket and bucket policy.
- `searxng`
  Internal service kept for parity with the current deploy compose setup.

Suggested public ports:

- `3210` for LobeHub
- `9000` for RustFS object API
- `9001` optional for RustFS admin UI

Suggested non-public ports:

- `5432` PostgreSQL
- `6379` Redis

## Why This Supports Video Generation Testing

Video generation in this codebase depends on an externally reachable callback URL. The application constructs the callback from `WEBHOOK_PROXY_URL` or `APP_URL`. In a local environment, `APP_URL=http://localhost:3010` is not reachable by external providers, so the async task never converges.

In the test deployment:

- `APP_URL` is set to `http://<public-server-ip>:3210`
- The provider can call back into `/api/webhooks/video/<provider>`
- The app can receive the final success or error webhook
- The async task can move from `Processing` to `Success` or `Error`

This is the primary reason to use a real public test environment instead of local-only development for validating the feature.

## Compose File Strategy

Do not mutate the existing deploy compose file for all users.

Instead, add a test-specific compose file, for example:

- `docker-compose/deploy/docker-compose.test.yml`

This file should stay close to `docker-compose/deploy/docker-compose.yml` but add the minimum changes necessary for CI/CD deployment:

- `lobe.image` should be configurable via `LOBE_IMAGE`
- Unnecessary public port exposure for PostgreSQL and Redis should be removed
- Persistent volumes should remain in place
- `env_file: .env` should remain the main runtime configuration source

Example intent:

- `lobe.image=${LOBE_IMAGE}`
- `lobe.ports=${LOBE_PORT}:3210`
- `rustfs.ports=${RUSTFS_PORT}:9000` and optional admin port
- No host port bindings for PostgreSQL and Redis

## Environment Variable Design

The server-side `.env` should be the source of truth for runtime configuration.

Minimum required values:

- `APP_URL=http://<server-ip>:3210`
- `KEY_VAULTS_SECRET=<secure-random-value>`
- `AUTH_SECRET=<secure-random-value>`
- `LOBE_PORT=3210`
- `LOBE_DB_NAME=<db-name>`
- `POSTGRES_PASSWORD=<secure-random-value>`
- `RUSTFS_ACCESS_KEY=<access-key>`
- `RUSTFS_SECRET_KEY=<secret-key>`
- `RUSTFS_PORT=9000`
- `RUSTFS_ADMIN_PORT=9001`
- `S3_ENDPOINT=http://<server-ip>:9000`
- `FEATURE_FLAGS=...` as needed
- model provider keys required for the test, such as the active video provider key

Recommended application values:

- `REDIS_URL=redis://redis:6379`
- `REDIS_PREFIX=lobechat`
- `REDIS_TLS=0`
- `S3_BUCKET=lobe`
- `S3_ENABLE_PATH_STYLE=1`
- `S3_SET_ACL=0`
- `LLM_VISION_IMAGE_USE_BASE64=1`

Optional:

- `WEBHOOK_PROXY_URL`
  Not required in the single-IP design because `APP_URL` already points to a public address. It can be added later if callback routing ever needs to differ from the main application address.

## GitHub Secrets Design

Recommended GitHub Actions secrets:

- `DOCKER_REGISTRY_USER`
- `DOCKER_REGISTRY_PASSWORD`
- `TEST_SERVER_HOST`
- `TEST_SERVER_PORT`
- `TEST_SERVER_USER`
- `TEST_SERVER_SSH_KEY`
- `TEST_SERVER_DEPLOY_PATH`
- `TEST_ENV_FILE`
- optional `TEST_SERVER_KNOWN_HOSTS`

Recommended handling:

- Store the entire runtime `.env` file as a multiline secret in `TEST_ENV_FILE`
- During deployment, write that value to `${TEST_SERVER_DEPLOY_PATH}/.env`
- Avoid scattering runtime env vars across many workflow steps

## Workflow Design

Add a manual workflow, for example:

- `.github/workflows/deploy-test-server.yml`

Trigger:

- `workflow_dispatch`

Inputs:

- `ref`
  Git ref, branch, or commit to deploy
- `image_tag`
  Optional explicit image tag for rollback or redeploy

Recommended behavior:

1. Check out `ref`
2. Resolve a deployment image tag
   - If `image_tag` is provided, use it
   - Otherwise generate `test-<sanitized-branch>-<short-sha>`
3. Log in to Docker Hub
4. Build and push the image
5. SSH to the test server
6. Ensure deploy directory exists
7. Write `.env`
8. Ensure the compose file is present in the deploy directory
9. Run:
   - `docker login`
   - `docker compose pull`
   - `docker compose up -d`
10. Run a lightweight validation step
11. Print deployment URL and image tag

## Rollback Strategy

Rollback should be tag-based, not branch-state-based.

Design:

- Every deployment produces or references a concrete image tag
- The current deployment points at `LOBE_IMAGE=<repo>:<tag>`
- To roll back, trigger the same workflow manually and provide the prior tag

This avoids needing git state on the server and keeps the rollback path simple.

## Verification Plan

After each deployment, verify:

1. `http://<server-ip>:3210` is reachable
2. The `lobe` container is healthy and has completed database migrations
3. RustFS is reachable on `http://<server-ip>:9000`
4. Basic asset upload flows work
5. Video generation reaches a terminal state
6. The webhook endpoint receives provider callbacks successfully

Suggested runtime checks:

- `docker compose ps`
- `docker logs --tail=200 lobehub`
- optional HTTP probe against the app root

Suggested video-specific checks:

- confirm task submission log
- confirm webhook reception log
- confirm video, cover, and thumbnail objects are created in RustFS

## Security Notes

This is a test environment, but some safeguards still matter:

- Do not expose PostgreSQL and Redis directly to the public internet
- Use strong random values for `KEY_VAULTS_SECRET`, `AUTH_SECRET`, and database/object storage credentials
- Restrict SSH access to trusted operators
- Prefer host firewall rules that only expose the intended ports

Known accepted limitations for this design:

- HTTP instead of HTTPS
- IP-based access instead of domain-based routing
- Single-host failure domain
- No automated backups in this design

## Failure Modes and Handling

If the deployment workflow fails before SSH:

- no server-side change occurs

If image push succeeds but SSH deployment fails:

- the image remains available in Docker Hub
- the workflow can be retried without rebuilding if the explicit image tag is reused

If the app starts but video tasks still do not converge:

- inspect `APP_URL`
- verify the server port is reachable from the public internet
- inspect `/api/webhooks/video/<provider>` logs
- inspect provider-side callback delivery logs if available

If browser-side asset access fails:

- inspect `S3_ENDPOINT`
- confirm RustFS is publicly reachable on the configured port
- confirm bucket and anonymous policy initialization succeeded

## Implementation Notes

The design intentionally minimizes changes:

- add a test-specific compose file
- add a manual deployment workflow
- keep secrets outside the repository
- keep the server immutable except for runtime files and persistent data

This provides the shortest path to a real public environment for validating the video generation lifecycle without prematurely introducing production-grade infrastructure complexity.
