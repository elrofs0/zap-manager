FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "node src/migrations/001_initial.js && node src/seeds/seed.js && node src/index.js"]
