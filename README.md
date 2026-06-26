# BigQuery Release Pulse 🚀

BigQuery Release Pulse is a premium web dashboard that tracks, parses, and enables sharing of official Google Cloud BigQuery release updates. Built with a fast Python Flask backend and a modern vanilla HTML5/CSS3/JavaScript frontend, it visualizes the release stream in a timeline layout with real-time analytics, filtering, and social sharing capabilities.

---

## 🌟 Key Features

*   **📡 Smart Feed Parser**: Fetches Google Cloud's RSS feed and uses `BeautifulSoup4` to slice daily releases into individual change items (Features, Changes, Deprecations, Fixes, and Announcements).
*   **🎨 Premium Dark UI**: Features responsive visual cards with type-specific color highlights (e.g. green for features, cyan for changes) and a glowing sidebar dashboard with stats.
*   **🔍 Instant Search & Filter**: Real-time client-side text filtering through release content, plus category badges displaying count tallies for each update type.
*   **🐦 Share on X (Twitter)**:
    *   **Pre-composed Post Editor**: A high-fidelity dark-themed modal post creator with an SVG circular progress meter and live character limits (0–280 characters).
    *   **Floating Share Tooltip**: Highlight any text within a release card to reveal a floating "Tweet Selection" shortcut that automatically copies the custom text into the post editor.
*   **⚡ Micro-caching**: Implements a 15-minute backend in-memory cache to guarantee sub-millisecond responses, while supporting a force-refresh trigger.

---

## 🛠️ Technology Stack

*   **Backend**: Python 3.x, Flask (REST API), Feedparser, BeautifulSoup4, Requests
*   **Frontend**: HTML5, Vanilla CSS3 (Custom Grid, Variables, Backdrop Filters), Vanilla ES6 JavaScript (Fetch API, DOM Events, Web Selection API)
*   **Deploy Tools**: Git, GitHub CLI (`gh`)

---

## 🚀 Quick Start

### 1. Clone & Set Up Directory
Ensure you are in the workspace root:
```bash
git clone https://github.com/mbd71/antigravity-event-talks-app.git
cd antigravity-event-talks-app
```

### 2. Initialize and Activate Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Run the Application
Start the Flask development server:
```bash
python app.py
```

Open your browser and navigate to **[http://127.0.0.1:8080](http://127.0.0.1:8080)**.

---

## 📂 Project Structure

```text
├── .agents/
│   └── AGENTS.md          # Custom agent rules for project workflow
├── templates/
│   └── index.html         # Main dashboard layout structure
├── static/
│   ├── css/
│   │   └── style.css      # Core styles, gradients, modals, and animations
│   └── js/
│       └── app.js         # Client-side controller, UI rendering, & share tools
├── app.py                 # Flask server, XML parsing, & caching layers
├── requirements.txt       # Python package list
└── README.md              # Project documentation
```
