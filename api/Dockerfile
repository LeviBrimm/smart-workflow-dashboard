FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json tsconfig.json ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
RUN npm run build

EXPOSE 4000
CMD ["node", "dist/app.js"]
