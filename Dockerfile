FROM node:24-alpine
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY package*.json LICENSE ./
RUN npm ci --omit=dev
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/start.js"]
