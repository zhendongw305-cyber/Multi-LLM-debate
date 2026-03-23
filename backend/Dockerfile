FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

ARG DATABASE_URL=mysql://veritas:veritas@db:3306/appdb
ENV DATABASE_URL=${DATABASE_URL}

RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start:prod"]
