FROM node:20

WORKDIR /app
COPY . .

RUN npm install && npm run build

# Usar nginx para servir el build
FROM nginx:alpine
COPY --from=0 /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]