# Privacy Policy for Doom Scolder

**Last updated:** November 2026

**Doom Scolder** judges your scrolling habits, not your personal data. We collect nothing.

### 1. Zero Data Collection
Zero PII, zero browsing history, zero analytics, zero external servers. Your embarrassing 2 AM Reddit binges stay strictly between you and your laptop.

### 2. Local Storage (`chrome.storage.local`)
Everything lives locally on your machine:
* **Timers:** Active doomscrolling seconds and daily totals.
* **Preferences:** Limits, scold intervals, Hardcore mode, platform toggles/scopes, and custom domains.
* **Custom Audio:** Any MP3/WAV/OGG/M4A you drop in is converted via `FileReader` and stored locally as Base64. Never uploaded anywhere.

### 3. Permissions
* **`storage` & `unlimitedStorage`**: Saves your limits, timers, and custom scream files locally.
* **`scripting` & Optional Host Permissions**: Only requested when you explicitly add a custom domain in Target Sites.
* **Supported Site Host Permissions**: Used solely to detect active feed scrolling/playback, duck page audio for scolds, and slap a lock screen over your tab when your budget hits zero.

We do **not** read your DMs, passwords, cookies, search queries, or comments.

### 4. Contact
Open an issue at https://github.com/sterrysan/doom-scolder.
