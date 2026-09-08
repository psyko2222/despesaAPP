FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/despesas.db

EXPOSE 3000

CMD ["npm", "start"]