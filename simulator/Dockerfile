FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY simulator/package.json ./simulator/package.json
COPY shared/package.json ./shared/package.json
RUN npm install
COPY shared ./shared
COPY simulator ./simulator
COPY data ./data
WORKDIR /app/simulator
CMD ["npm", "run", "start"]