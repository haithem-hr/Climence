FROM node:20-alpine

WORKDIR /app

# Install workspace deps first
COPY package.json package-lock.json* ./
COPY backend/package.json ./backend/package.json
COPY shared/package.json ./shared/package.json

RUN npm install

# Copy sources
COPY shared ./shared
COPY backend ./backend

WORKDIR /app/backend

EXPOSE 3002
EXPOSE 1883

CMD ["npm", "run", "start"]
