# GeoVision.AI — PWA do cidadão e painel da Defesa Civil.
#
# O build acontece aqui dentro, não na VPS: assim o servidor não precisa de
# Node instalado e o resultado é idêntico em qualquer máquina.
FROM node:22-alpine AS build

WORKDIR /app

# npm ci (e não install) para respeitar o package-lock.json: um deploy que
# resolve dependências de novo pode publicar versões que nunca foram testadas.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Lê frontend/.env.production — deixe VITE_AI_SERVICE_URL vazio para o app
# falar com a API na mesma origem, via nginx.
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY geovision_proxy.conf /etc/nginx/geovision_proxy.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1/ || exit 1
