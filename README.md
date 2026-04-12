# Colosseum Fighters

A browser-based survival game built with **Phaser 3** and **ES6 modules**.  
Survive endless waves of enemies, level up your weapons, and compete on a global leaderboard.

## Features

- 18+ weapon types: melee arcs, piercing projectiles, orbital blades, AoE zones
- 18 enemy types across 4 difficulty tiers
- Wave-based spawning with dynamic difficulty scaling
- Debuff system: poison, burn, lightning, armour weaken
- Per-weapon invulnerability frames
- Level-up item & weapon selection
- Global leaderboard backed by MongoDB

---

## Running Locally

### Prerequisites
- Node.js 18+
- A MongoDB instance (local or Atlas)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Dean-Cimatu/webAppProj1.git
cd webAppProj1

# 2. Install server dependencies
npm install

# 3. Create your environment file
cp .env.example .env
# Edit .env and set MONGO_URI to your MongoDB connection string

# 4. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

### Environment Variables

| Variable   | Description                              | Default                               |
|------------|------------------------------------------|---------------------------------------|
| `MONGO_URI` | MongoDB connection string               | `mongodb://localhost:27017/colosseum` |
| `PORT`     | Port the Express server listens on       | `3000`                                |

---

## Project Structure

```
/
├── server.js           Express API server
├── package.json
├── .env.example
├── index.html          Home / main menu
├── html/
│   ├── game.html       Game page (loads Phaser)
│   ├── leaderboard.html
│   ├── login.html
│   └── register.html
├── css/
│   └── style.css
├── js/
│   ├── auth.js         Local account helper (login/register)
│   ├── leaderboard.js  Fetches scores from /api/scores
│   ├── login.js
│   ├── register.js
│   ├── navigation.js
│   └── ui-sound.js
├── scripts/
│   ├── game.js         Main Phaser game (all scenes in one file)
│   ├── data/
│   │   ├── weapons.js
│   │   ├── enemies.js
│   │   └── items.js
│   └── core/
│       ├── enemy.js
│       ├── waves.js
│       ├── behaviors.js
│       └── zones.js
└── assets/             Sprites, audio, fonts
```

---

## API Endpoints

| Method | Path          | Description                        |
|--------|---------------|------------------------------------|
| GET    | `/api/scores` | Returns top 20 scores (JSON)       |
| POST   | `/api/scores` | Submit a score `{ name, score, wave }` |

---

## Deploying to Railway

1. Push the repo to GitHub (already done).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select this repository.
4. Add the following **Environment Variables** in the Railway dashboard:

   | Variable    | Value                                      |
   |-------------|--------------------------------------------|
   | `MONGO_URI` | Your MongoDB Atlas connection string       |
   | `PORT`      | Leave blank — Railway sets this automatically |

5. Railway will run `npm start` automatically.  
   Your game will be live at the URL Railway provides.

### MongoDB Atlas (free tier)

1. Create a free cluster at [cloud.mongodb.com](https://cloud.mongodb.com).
2. Create a database user and allow access from all IPs (`0.0.0.0/0`).
3. Copy the connection string (`mongodb+srv://...`) into the `MONGO_URI` variable on Railway.

---

## Serving the Frontend Separately (optional)

The Express server serves the entire repo as static files, so the frontend and backend are co-located by default.

If you want to host the frontend on **Vercel** or **GitHub Pages** instead:

1. Set the `API_BASE` constant in `js/leaderboard.js` and `scripts/game.js` to your Railway backend URL.
2. Update the CORS origin in `server.js` from `cors()` to `cors({ origin: 'https://your-frontend-domain.com' })`.
3. Deploy the static files (`index.html`, `html/`, `css/`, `js/`, `scripts/`, `assets/`) to Vercel or GitHub Pages.
