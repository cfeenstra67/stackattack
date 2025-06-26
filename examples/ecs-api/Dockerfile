FROM --platform=$BUILDPLATFORM node:20-alpine AS prune

WORKDIR /app

COPY pnpm-lock.yaml package.json pnpm-workspace.yaml .npmrc ./
COPY ./packages/ ./packages/
COPY ./examples/ ./examples/

RUN find packages \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} +
RUN find examples \! -name "package.json" -mindepth 2 -maxdepth 2 -exec rm -rf {} +

FROM --platform=$BUILDPLATFORM node:20-alpine AS builder

RUN npm install -g pnpm@9.5.0

COPY --from=prune /app/ /app/

WORKDIR /app

RUN CI=1 pnpm install --filter @stackattack/ecs-api-example... --frozen-lockfile

COPY ./ ./

RUN pnpm run --filter @stackattack/ecs-api-example... build

FROM node:20-alpine AS prod

RUN npm install -g pnpm@9.5.0

# Set up RDS certificates
RUN wget -q \
	-O /etc/ssl/certs/rds-certificates.crt \
	https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/rds-certificates.crt

COPY --from=prune /app/ /app/

WORKDIR /app

RUN CI=1 pnpm install --filter @stackattack/ecs-api-example... --prod --frozen-lockfile

COPY ./ ./

COPY --from=builder /app/examples/ecs-api/dist/ /app/examples/ecs-api/dist/
COPY --from=builder /app/packages/aws/dist/ /app/packages/aws/dist/

WORKDIR /app/examples/ecs-api

ENTRYPOINT ["./docker-entrypoint.sh"]
