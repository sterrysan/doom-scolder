# Chrome Web Store Listing - Copy & Paste Asset Pack

Use this document to quickly fill out the Chrome Web Store Developer Dashboard.

---

## 1. Store Metadata

* **Name:** `Doom Scolder - YouTube Shorts Blocker`
* **Short Name:** `Doom Scolder`
* **Category:** `Productivity`
* **Language:** `English`
* **Version:** `1.0.0`
* **Homepage URL:** `https://github.com/sterrysan/doom-scolder`
* **Support URL:** `https://github.com/sterrysan/doom-scolder/issues`
* **Summary (Short Description, max 132 characters):**
  ```
  Stop doomscrolling! Block shorts and optionally get an audible scolding after watching too many YouTube Shorts.
  ```

---

## 2. Detailed Description (Paste into "Detailed Description")

```markdown
Break free from the YouTube Shorts rabbit hole with resistance, humor, and tough love.

Ever opened YouTube for a 2-minute tutorial and found yourself 45 minutes deep into endless brain-melting Shorts? Doom Scolder is designed to break the infinite scroll loop before it breaks your day.

🛑 HARD SHORTS BLOCKER
Set your daily limit (e.g., 5 or 10 Shorts). Once you hit your limit, Doom Scolder intercepts the feed and displays a mindful full-screen blocker. No autoplaying, no sneaking in "just one more."

🔊 AUDIBLE SCOLDING
Need an extra wake-up call? Enable Audible Scolding! As you approach your limit, the extension blasts a sharp audio warning (screams, dramatic audio, or motivational shouting) to snap you back into reality.

🎧 DRAG & DROP CUSTOM SOUNDS
Want David Goggins shouting at you? Or your own voice telling you to get back to work? Simply drag and drop any MP3, WAV, OGG, or M4A file into the sound manager. All audio is converted and stored 100% locally on your computer.

🏎️ THE SHAME SLALOM (ANTI-CHEAT SYSTEM)
Think you can just bump your limit from 5 to 20 when addiction kicks in? Think again. 
Attempting to increase your limit activates the Shame Slalom:
• Guide an electric laser wire with your mouse through a narrow obstacle corridor without touching any cards.
• Moving too slow? A realistic thunderstorm rolls in with rain and thunder, dissolving your line in real time!
• Touch a wall? Zapped! Start completely over.
• Try to click the Save button early? It literally dodges your cursor.

🧘 MINDFULNESS RESET TEST
Need to reset your count? You must wait through a 10-second reflection timer, then accurately type a randomized mindful pledge containing tricky leet-speak characters. One single typo and you are sent back to the 10-second penalty box!

🚀 COMING SOON: THINK YOU CAN ESCAPE TO INSTAGRAM REELS ONCE YOUR YOUTUBE SHORTS LOCK UP? NOT FOR LONG.

WE ARE ACTIVELY DEVELOPING INSTAGRAM REELS SUPPORT TO AVENGE REELS DOOMSCROLLERS NEXT. DO NOT CLUTTER YOUR BROWSER WITH MULTIPLE EXTENSIONS - DOOM SCOLDER WILL SOON BECOME YOUR SINGLE, RUTHLESS DOOMSCROLL SLAYER ACROSS MULTIPLE PLATFORMS. KEEP THE EXTENSION INSTALLED; UPDATE INCOMING!

🔒 100% PRIVATE & OFFLINE
• No account required.
• Zero data collection, analytics, or external telemetry.
• Everything runs locally inside your browser.

Reclaim your attention span, kill the dopamine loop, and get back to what actually matters!
```

---

## 3. Privacy Practices Tab (Developer Console)

### Single Purpose Description
> "Helps users overcome short-form video doomscrolling and digital distraction by enforcing viewing limits, delivering mindful blocker overlays when thresholds are reached, and providing anti-cheat friction before limits can be increased."

### Permission Justifications
* **`storage`**:
  > "Used to save user preferences (viewing limits, scold thresholds, audio toggles) and local session video counters privately on the device."
* **`unlimitedStorage`**:
  > "Required to store user-uploaded custom audio alert files locally as offline Base64 data without being restricted by standard Chrome storage quotas."
* **Host Permission (`*://www.youtube.com/*`)**:
  > "Required to detect short-form feed playback, inject the mindful blocker overlay when user limits are reached, and manage audio ducking for alerts on the active video platform."

### Remote Code Declaration
* Select: **No, I am not using Remote code**
* (If justification requested):
  > "All scripts, styles, markup, and audio assets are packaged completely locally within the extension bundle; no remote scripts, external CDNs, or dynamic eval code are fetched or executed."

### Data Usage Declarations
* **Does your extension collect user data?** Select **NO**.
* **Certify**: Check all compliance checkboxes confirming data is not sold, transferred, or used for credit scoring.

---

## 4. Required Image Assets Checklist

Before submitting, prepare these images in the developer console:
1. **Store Icon**: 128x128 PNG (Already generated at `icons/icon128.png`).
2. **Screenshots (At least 1 required, 1280x800 or 640x400 PNG/JPEG)**:
   * Screenshot 1: Dashboard popup showing Shorts Counter & Progress Ring.
   * Screenshot 2: Settings view showing Limits, Steppers & Scold Sound Manager.
   * Screenshot 3: Shame Slalom active obstacle track & storm rain effect.
   * Screenshot 4: Full-screen YouTube Shorts Block Overlay with mindfulness challenge.
3. **Small Promo Tile (Optional, 440x280 PNG)**: Useful for featuring in Chrome Web Store search.

