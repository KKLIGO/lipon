FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM python:3.12-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY serve.py .
EXPOSE 8080
CMD ["python", "serve.py", "8080"]
