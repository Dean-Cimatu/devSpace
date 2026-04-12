# Colosseum Fighters

A browser-based survival game. Survive endless waves of enemies, level up your weapons, and submit your score to a global leaderboard. Create an account to track your personal stats across sessions.

Built with **Phaser 3** (frontend) and **Express + MongoDB** (backend).

---

## Play it live

> Deploy your own instance in minutes — see the [Deployment](#deployment) section below.

---

## How it works

The Express server (`server/index.js`) does three things:

1. Serves the entire `client/` directory as static files — opening `http://localhost:3000` loads the game
2. Exposes leaderboard API endpoints:
   - `GET /api/scores` — returns the top 20 scores
   - `POST /api/scores` — saves a score entry `{ name, score, wave }`; attaches to the user account if a valid JWT is present
3. Exposes authentication API endpoints:
   - `POST /api/auth/register` — creates a new user account, returns a JWT
   - `POST /api/auth/login` — authenticates and returns a JWT
   - `GET /api/auth/me` — returns the authenticated user's profile (requires JWT)

The game runs entirely in the browser via Phaser 3 loaded from CDN. No build step required.

---

## Running locally

### Requirements

- Node.js 18+
- A MongoDB instance (local or [Atlas free tier](https://cloud.mongodb.com))

### Steps

```bash
git clone https://github.com/Dean-Cimatu/webAppProj1.git
cd webAppProj1
npm install
cp .env.example .env
```

Edit `.env` and fill in your values:

```
MONGO_URI=mongodb://localhost:27017/colosseum
PORT=3000
JWT_SECRET=any_long_random_string
```

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## Deployment

### 1 — Set up MongoDB Atlas (free)

1. Create an account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0** cluster
3. Under **Database Access**, add a user with a password
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from Railway
5. Click **Connect → Drivers** and copy the connection string:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/colosseum
   ```

### 2 — Deploy to Railway

1. Create an account at [railway.app](https://railway.app)
2. Click **New Project → Deploy from GitHub repo** and connect your repo
3. Railway will detect `railway.toml` automatically
4. In the project settings under **Variables**, add:
   ```
   MONGO_URI = <your Atlas connection string>
   JWT_SECRET = <a long random secret>
   ```
5. Click **Deploy** — Railway will install dependencies and start the server

Your game will be live at the Railway-assigned URL (e.g. `https://colosseum-fighters.up.railway.app`).

---

## Project structure

```
/
├── server/
│   ├── index.js              Entry point — connects DB and starts server
│   ├── app.js                Express setup, middleware, routes
│   ├── middleware/
│   │   └── auth.js           JWT middleware (requireAuth / optionalAuth)
│   ├── routes/
│   │   ├── auth.js           POST /register, POST /login, GET /me
│   │   └── scores.js         GET /api/scores, POST /api/scores
│   └── models/
│       ├── User.js           Mongoose user schema
│       └── Score.js          Mongoose score schema
├── client/                   Everything served as static files
│   ├── index.html            Home page
│   ├── pages/
│   │   ├── game.html
│   │   ├── leaderboard.html
│   │   ├── login.html
│   │   └── register.html
│   ├── css/
│   │   └── style.css
│   ├── js/                   Non-game browser scripts
│   │   ├── auth.js           API-backed auth helper (exposes window.auth)
│   │   ├── leaderboard.js
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── main.js
│   │   ├── navigation.js
│   │   └── ui-sound.js
│   ├── game/                 Phaser game (ES modules)
│   │   ├── main.js           Phaser config + scene registry
│   │   ├── config.js         Game constants
│   │   ├── scenes/
│   │   │   ├── PreloadScene.js
│   │   │   └── GameScene.js
│   │   ├── entities/
│   │   │   ├── Entity.js
│   │   │   ├── Player.js
│   │   │   ├── Enemy.js
│   │   │   ├── Projectile.js
│   │   │   └── WeaponEntity.js
│   │   ├── systems/
│   │   │   ├── behaviors.js
│   │   │   ├── waves.js
│   │   │   └── zones.js
│   │   └── data/
│   │       ├── weapons.js
│   │       ├── enemies.js
│   │       └── items.js
│   └── assets/               Sprites, audio, fonts
├── railway.toml              One-click Railway deployment config
├── package.json
└── .env.example
```

---

## Environment variables

| Variable     | Required | Default                                |
|--------------|----------|----------------------------------------|
| `MONGO_URI`  | Yes      | `mongodb://localhost:27017/colosseum`  |
| `JWT_SECRET` | Yes      | `dev_secret_change_in_production`      |
| `PORT`       | No       | `3000`                                 |
