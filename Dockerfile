FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
# This intentionally fails to build until the approved BFF application is merged.
# Never substitute a public static demo for the authenticated production application.
COPY --chown=node:node src/bff/ ./src/bff/
COPY --chown=node:node scripts/production-config.mjs scripts/start-production.mjs ./scripts/
USER node
EXPOSE 3000
CMD ["node", "scripts/start-production.mjs"]
