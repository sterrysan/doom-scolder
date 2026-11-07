# Privacy Policy for Doom Scolder - YouTube Shorts Blocker

**Last updated:** November 2026

**Doom Scolder** ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user data and information handling.

---

### 1. Zero Data Collection
Doom Scolder does **not** collect, store, sell, or transmit any personally identifiable information (PII), browsing history, or analytics to any external server or third party.

---

### 2. Local Device Storage
All data used by Doom Scolder is stored **100% locally** on your personal device using Chrome's sandboxed `chrome.storage.local` API:
* **Shorts Counters**: Tracks the number of YouTube Shorts you have viewed during your active session and daily total to enforce your limits.
* **User Preferences**: Your configured block limits, scold thresholds, and audio toggle state.
* **Custom Scold Audio**: Any custom audio files you drag and drop into the extension are processed locally within your browser using `FileReader` and stored on your local disk as Base64 strings. They are never uploaded to any remote server.

---

### 3. Permissions Explained
* **`storage` & `unlimitedStorage`**: Required solely to save your limits, sound choices, and session counters on your computer.
* **Host Permission (`*://www.youtube.com/*`)**: Required exclusively to:
  1. Detect when you navigate between YouTube Shorts.
  2. Display the mindful block overlay when your configured limit is reached.
  3. Play your chosen audio notification to scold you out of doomscrolling.

The extension does **not** read your YouTube account information, search history, playlists, comments, or cookies.

---

### 4. Third-Party Services
Doom Scolder contains zero third-party tracking scripts, zero advertising networks, and zero telemetry SDKs.

---

### 5. Contact
If you have any questions about this Privacy Policy or Doom Scolder, you can contact the developer via the Chrome Web Store support tab or GitHub repository.

