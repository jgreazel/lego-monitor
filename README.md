# LEGO Monitor

A set of scripts to monitor LEGO sets that are retiring soon from the BrickEconomy website.

## Files

- **`utils.js`** - Shared utility functions used by both scripts
- **`getRetiringSoon.js`** - Fetches the retiring soon page and extracts featured set numbers
- **`fetchSetDetails.js`** - Visits each set's detail page and saves the HTML

## Usage

### Step 1: Get Retiring Soon Sets

First, run the script to fetch the list of retiring sets:

```bash
node getRetiringSoon.js
```

This will create:

- `retiring-soon-pages/retiring-soon-{timestamp}.html` - Full HTML page
- `set-numbers/set-numbers-{timestamp}.txt` - Extracted set numbers with URLs

### Step 2: Fetch Set Detail Pages

Next, run the script to fetch individual set detail pages:

```bash
node fetchSetDetails.js
```

This will:

- Automatically find the most recent file in `set-numbers/` directory
- Visit each set's URL
- Save HTML files to: `set-details/set-details-{timestamp}/`
- Each file will be named: `set-{setNumber}.html`

## Example Output Structure

```
lego-monitor/
├── getRetiringSoon.js
├── fetchSetDetails.js
├── utils.js
├── retiring-soon-pages/
│   └── retiring-soon-2025-11-09T21-46-40-971Z.html
├── set-numbers/
│   └── set-numbers-2025-11-09T21-46-40-971Z.txt
└── set-details/
    └── set-details-2025-11-09T21-50-00-123Z/
        ├── set-75331.html
        ├── set-76178.html
        └── set-76917.html
```

## Features

- **Stealth Mode**: Uses puppeteer-extra with stealth plugin to avoid detection
- **Systematic Extraction**: Reliably extracts set numbers using CSS selectors and regex
- **Timestamped Files**: All output files include timestamps to prevent overwriting
- **Organized Output**: Files are organized into separate directories (retiring-soon-pages, set-numbers, set-details)
- **Progress Feedback**: Console output shows progress and status
- **Error Handling**: Gracefully handles errors and continues processing
- **Rate Limiting**: Includes 1-second delay between requests to be respectful to the server

## Utility Functions (utils.js)

- `initBrowser(headless)` - Initialize Puppeteer with stealth plugin
- `fetchPageContent(page, url)` - Fetch HTML content from a URL
- `saveFile(filename, content, dir)` - Save content to a file
- `getTimestamp()` - Generate timestamp for filenames
- `parseSetNumbersFile(filePath)` - Parse set-numbers txt file
- `findMostRecentFile(pattern, dir)` - Find the most recent file matching a pattern
- `ensureDirectoryExists(dir)` - Ensure a directory exists, create if it doesn't
