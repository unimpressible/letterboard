# Letterboard

Design your whole Steam profile in one place: every Points Shop background, mini-profile, animated avatar, avatar frame, emoticon and sticker, every trading card, and every letter, number and symbol achievement icon, previewed exactly as Steam shows it.

- **Profile builder** – background, avatar, frame, name, level, summary with emoticons, mini-profile, and showcases (achievements, items, custom info box, favorite game, artwork). Saves in your browser; "Copy share link" gives anyone your exact design.
- **Catalog** – search and filter every item by name or game, then set it on your profile or add it to a showcase in one click.
- **Letters** – spell a word in the 7-slot achievement showcase, choose each letter's style from every icon that exists, and see which games and achievements to unlock.

## How the data stays current

Nothing is stored by hand. A GitHub Action (`.github/workflows/publish.yml`) runs daily and on every push:

| Script | Source (public, no key) | Output |
|---|---|---|
| `scripts/fetch-achievements.mjs` | `IPlayerService/GetGameAchievements` for each game in `data/games.json` | `data/achievements/` |
| `scripts/fetch-points-shop.mjs` | `ILoyaltyRewardsService/QueryRewardItems` | `data/items/`, `data/apps.json` |
| `scripts/fetch-cards.mjs` | Community Market search, one game at a time | `data/cards/` |

The Market only allows a slow request rate, so trading cards fill in over several daily runs and then keep refreshing the oldest games first. Images are never copied: the site loads them straight from Steam's image servers.

## Setup (one time)

1. **Settings → Pages → Source: GitHub Actions.**
2. **Actions → Update and publish → Run workflow.**

The site goes live at `https://<your-username>.github.io/letterboard/`.

## Adding a letter game

Add a line to `data/games.json` with the game's app ID (the number in its Steam store URL) and push. The next run picks up every icon it has.

## Running locally

Any static file server works, for example `python3 -m http.server`, then open http://localhost:8000. To refresh data locally: `node scripts/fetch-achievements.mjs`, `node scripts/fetch-points-shop.mjs`, `node scripts/fetch-cards.mjs --minutes 10` (Node 18+, no dependencies).
