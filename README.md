# Colosseum Fighters

A browser-based survival game. Survive endless waves of enemies, level up your weapons, and submit your score to a global leaderboard.

Built with **Phaser 3** (frontend) and **Express + MongoDB** (backend).

---

## How it works

The Express server (`server.js`) does two things:

1. Serves the entire repo as static files — so opening `http://localhost:3000` loads the game
2. Exposes two API endpoints for the leaderboard:
   - `GET /api/scores` — returns the top 20 scores
   - `POST /api/scores` — saves a score entry `{ name, score, wave }`

The game itself runs entirely in the browser via Phaser 3 loaded from CDN. No build step required.

---

## Running locally

### Requirements

- Node.js 18 or higher
- A MongoDB instance (local or [Atlas free tier](https://cloud.mongodb.com))

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/Dean-Cimatu/webAppProj1.git
cd webAppProj1

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
```

Open `.env` and set your MongoDB connection string:

```
MONGO_URI=mongodb://localhost:27017/colosseum
PORT=3000
```

If you are using MongoDB Atlas, the URI looks like:

```
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/colosseum
```

```bash
# 4. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

---

## Environment variables

| Variable   | Required | Default                               |
|------------|----------|---------------------------------------|
| `MONGO_URI` | Yes     | `mongodb://localhost:27017/colosseum` |
| `PORT`      | No      | `3000`                                |

---

## Project structure

```
/
├── server/
│   ├── index.js          Entry point — connects DB and starts server
│   ├── app.js            Express setup, middleware, routes mounted
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
│   │   ├── auth.js       LocalStorage auth helper
│   │   ├── leaderboard.js
│   │   ├── login.js
│   │   ├── register.js
│   │   ├── main.js       Home page logic
│   │   ├── navigation.js
│   │   └── ui-sound.js
│   ├── game/             Phaser game (ES modules)
│   │   ├── main.js       Phaser config + scene entry point
│   │   ├── entities/
│   │   │   └── Enemy.js
│   │   ├── systems/
│   │   │   ├── behaviors.js  Weapon attack dispatch
│   │   │   ├── waves.js      Spawn and difficulty logic
│   │   │   └── zones.js      Area-effect zone classes
│   │   └── data/
│   │       ├── weapons.js
│   │       ├── enemies.js
│   │       └── items.js
│   └── assets/           Sprites, audio, fonts
├── package.json
├── .env.example
└── README.md
```
