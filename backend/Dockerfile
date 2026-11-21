FROM node:22-alpine
# Dependencias nativas que necesitan algunos paquetes de Strapi (sharp, etc.)
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev git
ENV NODE_ENV=development
WORKDIR /opt/app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 1337
CMD ["npm", "run", "develop"]
