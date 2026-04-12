# Colosseum Fighters

A browser-based survival game. Survive endless waves of enemies, level up your weapons, and submit your score to a global leaderboard.

Built with **Phaser 3** (frontend) and **Express + MongoDB** (backend).

---

## Play it live

> Deploy your own instance in minutes — see the [Deployment](#deployment) section below.

---

## How it works

The Express server (`server/index.js`) does two things:

1. Serves the entire `client/` directory as static files — opening `http://localhost:3000` loads the game
2. Exposes two API endpoints for the leaderboard:
   - `GET /api/scores` — returns the top 20 scores
   - `POST /api/scores` — saves a score entry `{ name, score, wave }`

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

Edit `.env` and set your MongoDB connection string:

```
MONGO_URI=mongodb://localhost:27017/colosseum
PORT=3000
```

```bash
npm start
```

Open **http://localhost:3000** in your browser.

---

## Deployment

The repo includes a `render.yaml` so you can deploy to [Render](https://render.com) in a few clicks. Render's free tier is enough to run the game and leaderboard.

### 1 — Set up MongoDB Atlas (free)

1. Create an account at [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create a free **M0** cluster
3. Under **Database Access**, add a user with a password
4. Under **Network Access**, add `0.0.0.0/0` to allow connections from Render
5. Click **Connect → Drivers** and copy the connection string — it looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/colosseum
   ```

### 2 — Deploy to Render

1. Create an account at [render.com](https://render.com)
2. Click **New → Web Service** and connect your GitHub repo (`Dean-Cimatu/webAppProj1`)
3. Render will detect `render.yaml` automatically — click **Apply**
4. Under **Environment**, add the variable:
   ```
   MONGO_URI = <your Atlas connection string from step 1>
   ```
5. Click **Deploy** — Render will install dependencies and start the server

Your game will be live at `https://colosseum-fighters.onrender.com` (or similar).

---

## Project structure

```
/
├── server/
│   ├── index.js          Entry point — connects DB and starts server
│   ├── app.js            Express setup, middleware, routes
│   ├── routes/
│   │   └── scores.js     GET /api/scores, POST /api/scores
│   └── models/
│       └── Score.js      Mongoose schema
├── client/               Everything served as static files
│   ├── index.html        Home page
│   ├── pages/
│   │   ├── game.html
│   │   ├── leaderboard.html
│   │   ├── login.html
│   │   └── register.html
│   ├── css/
│   │   └── style.css
│   ├── js/               Non-game browser scripts
│   │   ├── auth.js
│   │   ├── leaderboard.js
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── main.js
│   │   ├── navigation.js
│   │   └── ui-sound.js
│   ├── game/             Phaser game (ES modules)
│   │   ├── main.js       Phaser config + scene registry
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
│   │   │   ├── behaviors.js  Weapon attack dispatch
│   │   │   ├── waves.js      Spawn and difficulty logic
│   │   │   └── zones.js      Area-effect zone classes
│   │   └── data/
│   │       ├── weapons.js
│   │       ├── enemies.js
│   │       └── items.js
│   └── assets/           Sprites, audio, fonts
├── render.yaml           One-click Render deployment config
├── package.json
└── .env.example
```

---

## Environment variables

| Variable    | Required | Default                               |
|-------------|----------|---------------------------------------|
| `MONGO_URI` | Yes      | `mongodb://localhost:27017/colosseum` |
| `PORT`      | No       | `3000`                                |
