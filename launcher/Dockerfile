FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends curl tar gzip python3 make g++ ca-certificates && rm -rf /var/lib/apt/lists/*
COPY launcher/package.json ./
RUN npm install --omit=dev
COPY launcher/src ./src
COPY launcher/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh
COPY themes /app/themes
COPY profiles /app/profiles
COPY demo /opt/demopress/demo-build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["./entrypoint.sh"]
