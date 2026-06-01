# NEAEA Vault

**Every past paper. Every subject. Offline, always.**

NEAEA Vault is an offline-first Progressive Web App (PWA) exam simulator designed for Ethiopian NEAEA/ESSLCE students. No login, no API, no backend — all question data lives in local JSON files and is cached by the service worker for full offline functionality.

## Features

- **6 Subjects**: Biology, Chemistry, Mathematics, Physics, English, Scholastic Aptitude
- **Exam Mode**: One question at a time with instant answer feedback and explanations
- **Optional Timer**: Toggle a countdown timer (1.5 min per question) for timed practice
- **Score Tracking**: Personal best scores and last 10 attempts stored in localStorage
- **Review Mode**: Scroll through all questions with your answers vs. correct answers
- **PWA Installable**: Add to home screen for app-like experience
- **Full Offline**: Works completely offline after first load
- **Premium Design**: Deep Space Glassmorphism aesthetic — dark navy, frosted glass, blue/purple glows

## App Flow

```
Home → Subject Select → Paper Select → Exam → Results → Review
```

## JSON Schema — Question Files

Every question file follows this schema:

```json
{
  "subject": "Biology",
  "year": "2015 E.C",
  "paper": 1,
  "questions": [
    {
      "id": 1,
      "question": "Question text here",
      "image": "./images/2015_p1_q1.png",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "B",
      "explanation": "Explanation text here"
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `subject` | string | Yes | Display name of the subject |
| `year` | string | Yes | Year in Ethiopian Calendar (e.g., "2015 E.C") |
| `paper` | number | Yes | Paper number (1 or 2) |
| `questions` | array | Yes | Array of question objects |
| `questions[].id` | number | Yes | Question number (1-indexed) |
| `questions[].question` | string | Yes | The question text |
| `questions[].image` | string | No | Relative path to diagram image |
| `questions[].options` | array | Yes | Array of 4 option strings |
| `questions[].answer` | string | Yes | Correct answer letter: "A", "B", "C", or "D" |
| `questions[].explanation` | string | Yes | Explanation shown after answering |

**Note:** The `image` field is optional. Only include it when a question has a diagram. Images are referenced by relative path and cached by the service worker.

## How to Add New Papers

1. **Create the JSON file** in the appropriate subject folder:

   ```
   data/{subject}/{year}_p{paper_number}.json
   ```

   For example: `data/biology/2016_p1.json`

2. **Follow the JSON schema** above. Make sure:
   - `id` numbers are sequential starting from 1
   - `answer` is a single letter: "A", "B", "C", or "D"
   - `options` always has exactly 4 items
   - `explanation` is provided for every question

3. **Add images** (if any) to the subject's `images/` folder:

   ```
   data/biology/images/2016_p1_q5.png
   ```

   Reference them in the JSON as: `"image": "./images/2016_p1_q5.png"`

4. **Register the paper** in `app.js` — find the `SUBJECTS` array and add the paper ID:

   ```javascript
   { id: 'biology', name: 'Biology', icon: '🧬', papers: ['2015_p1', '2016_p1'] },
   ```

5. **Cache the file** in `service-worker.js` — add the new JSON path to the `DATA_FILES` array:

   ```javascript
   '/data/biology/2016_p1.json',
   ```

6. **Bump the cache version** in `service-worker.js`:

   ```javascript
   const CACHE_NAME = 'neaea-vault-v2'; // Increment version
   ```

## How to Add a New Subject

1. Create a new folder under `data/` (e.g., `data/civics/`)
2. Add JSON question files following the schema
3. Add an `images/` subfolder if needed
4. Add the subject to the `SUBJECTS` array in `app.js`
5. Add the data files to `service-worker.js`
6. Bump the cache version

## GitHub Pages Deployment

1. **Create a GitHub repository** and push the code:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: NEAEA Vault"
   git remote add origin https://github.com/YOUR_USERNAME/neaea-vault.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: `main` / `/ (root)`
   - Click Save

3. **Your app will be live at**:
   ```
   https://YOUR_USERNAME.github.io/neaea-vault/
   ```

4. **Important**: If deploying to a subpath (not root), update:
   - `start_url` and icon paths in `manifest.json`
   - Service worker cache paths in `service-worker.js`
   - Data file fetch paths in `app.js`

## Score Tracking

Scores are stored in `localStorage` with the key format:

```
vault_{subject}_{paperId}
```

Example:

```json
{
  "best": 38,
  "attempts": [
    { "date": "2026-06-01", "score": 38, "total": 45 },
    { "date": "2026-05-28", "score": 32, "total": 45 }
  ]
}
```

- Last 10 attempts are stored per paper
- Personal best is shown on the paper selection card
- Pass threshold: 50%

## Tech Stack

- **Vanilla** HTML, CSS, JavaScript — no frameworks
- **Service Worker** for offline caching
- **localStorage** for score persistence
- **Web App Manifest** for PWA installability

## Contributing

Contributions are welcome! Especially:

- Adding more past papers (follow the JSON schema)
- Fixing errors in existing questions
- Improving UI/UX
- Adding new features

Please open an issue or submit a pull request.

## License

MIT License — see [LICENSE](LICENSE) file.
