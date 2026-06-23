# Aquilles

Lead outreach system for local businesses in Tijuana that don't have a real website. Scrapes leads from Google Maps, generates personalized landing pages, and creates showcase videos to pitch them.

## How It Works

1. **Import leads** from a Google Places dataset into a SQLite database
2. **Filter targets** — businesses with a phone number but no real website (social media profiles and directory listings don't count)
3. **Generate landing pages** from an HTML template, personalized with each business's name, phone, address, rating, and reviews
4. **Create showcase videos** that scroll through the desktop and mobile versions of the generated site, with optional background music

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

### Import leads

Drop a Google Places crawler dataset JSON file in the project root, then:

```bash
npm run import-leads
```

### Browse leads

```bash
node scripts/leads.js targets   # businesses with phone + no real website
node scripts/leads.js stats     # summary counts by status/warmth
node scripts/leads.js all       # every lead in the DB
```

### Generate landing pages

```bash
npm run generate-sites
```

Outputs static HTML files to `sites/`. Each page includes a hero section, services, Google Maps embed, reviews, and a WhatsApp CTA.

### Generate a showcase video

```bash
node scripts/generate-video.js <site-slug>
```

Uses Playwright to capture full-page screenshots (desktop + mobile), composites them into a laptop/phone mockup, records the scrolling animation, and encodes with ffmpeg. Drop an mp3 at `assets/bgm.mp3` to add background music.

There's also a Remotion-based renderer:

```bash
node scripts/render-video.js <site-slug>
```

Videos are saved to `videos/`.

## Tech Stack

- **SQLite** (better-sqlite3) — lead storage and tracking
- **Playwright** — screenshot capture and video recording
- **Remotion** — programmatic video rendering
- **ffmpeg** — video encoding and audio mixing
