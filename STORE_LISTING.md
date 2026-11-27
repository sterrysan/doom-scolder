# Chrome Web Store Listing — Doom Scolder v2.0.0

---

## 1. Store Metadata

* **Name:** `Doom Scolder`
* **Short Name:** `Doom Scolder`
* **Category:** `Productivity`
* **Language:** `English`
* **Version:** `2.0.0`
* **Homepage URL:** `https://github.com/sterrysan/doom-scolder`
* **Support URL:** `https://github.com/sterrysan/doom-scolder/issues`
* **Privacy Policy URL:** `https://github.com/sterrysan/doom-scolder/blob/main/PRIVACY_POLICY.md`
* **Summary (Short Description, max 132 chars):**
  ```
  Stop doomscrolling! One global daily budget across YouTube, Reddit, IG, X, TikTok & more—with audible scolds & anti-cheat.
  ```

---

## 2. Detailed Description

```markdown
Your attention span called. It wants a restraining order.

Opened YouTube for a 2-minute tutorial and woke up 90 minutes later on X, Reddit, and Instagram Reels? Doom Scolder puts all of them under ONE shared daily budget so switching tabs won't save you.

🌐 ONE GLOBAL DOOM POOL
One timer across YouTube, Facebook, Instagram, Reddit, X/Twitter, TikTok, LinkedIn, Pinterest, Threads, Bluesky, Discord Web (opt-in), and your own custom domains.

🎯 SMART ROUTE SCOPING (FEEDS ONLY BY DEFAULT)
• YouTube: Home, Shorts & Feeds — spares /watch tutorials unless you opt into Full Site.
• Reddit: Front page & subreddit feeds — spares /comments/ debugging threads.
• LinkedIn: /feed/* — spares /jobs and /messaging.

🔊 AUDIBLE SCOLDING + MOMENTUM TRAPS
Blasts local audio alerts on time intervals AND whenever you panic-scroll 5 screens in 12s or rapid-swipe Shorts/Reels/TikToks. Drag & drop your own MP3, WAV, OGG, or M4A files.

⚡ ANGRY ICON & BROKEN-ELECTRONIC SPARKS
Your toolbar icon turns from calm olive → amber warning → short-circuiting crimson rage as your budget burns down.

🏎️ THE SHAME SLALOM (ASYMMETRIC ANTI-CHEAT)
Tightening limits is instant. Trying to raise limits, disable a site, or turn off Hardcore mode forces you to steer a laser wire through a thunderstorm without touching any cards.

🧘 MIDNIGHT RESET + MINDFULNESS OVERRIDE
Auto-resets at midnight (or lock it down with Hardcore: Manual Reset Only). Want an early unlock? Wait 10 seconds and type a leet-speak confession without a single typo.

🔒 100% PRIVATE & OFFLINE
Zero accounts. Zero telemetry. Zero servers. Just pure digital tough love.
```

---

## 3. Privacy Practices Tab (Developer Console)

### Single Purpose Description
> "Enforces a global daily active-time budget across user-selected social feeds and doomscrolling sites, delivering audible alerts, full-screen blocking overlays, and anti-cheat friction before protections can be weakened."

### Permission Justifications
* **`storage`**: Saves daily limits, scold intervals, platform scopes, and active-time counters locally.
* **`unlimitedStorage`**: Stores user-uploaded custom scold audio files locally as Base64 without hitting standard storage caps.
* **`scripting` & Optional Host Permissions (`*://*/*`)**: Requests per-domain access only when a user manually adds a custom domain in Target Sites.
* **Host Permissions (Built-in Platforms)**: Measures active feed scrolling/playback, ducks page media for scold alerts, and renders the block overlay when the daily budget is exhausted.

### Remote Code & Data Usage
* **Remote code:** No (all JS, CSS, HTML, icons, and audio are bundled locally).
* **Collects user data:** No.
