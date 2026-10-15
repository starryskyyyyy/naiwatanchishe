FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json server.js game-rules.js ./
COPY backend/ ./backend/
COPY index.html styles.css game.js snake-renderer.js skin.js leaderboard.js config.js ./
COPY assets/*.png ./assets/
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["node", "server.js"]
