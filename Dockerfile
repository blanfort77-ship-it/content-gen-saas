FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/api/package.json packages/api/package.json
RUN npm install

COPY packages/core packages/core
COPY packages/api packages/api

RUN npm run build --workspace=@content-gen/core
RUN npm exec --workspace=@content-gen/api prisma generate
RUN npm run build --workspace=@content-gen/api

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/core/dist packages/core/dist
COPY --from=build /app/packages/core/package.json packages/core/package.json
COPY --from=build /app/packages/api/dist packages/api/dist
COPY --from=build /app/packages/api/package.json packages/api/package.json
COPY --from=build /app/packages/api/prisma packages/api/prisma
COPY --from=build /app/node_modules/.prisma node_modules/.prisma

EXPOSE 3000
CMD ["sh", "-c", "npm exec --workspace=@content-gen/api prisma migrate deploy && node packages/api/dist/server.js"]
