# LEGO Monitor

A set of scripts to monitor LEGO sets that are retiring soon from the BrickEconomy website.

## Files

- **`utils.js`** - Shared utility functions used by all scripts
- **`SetRegistry.js`** - Registry management for tracking unique sets over time
- **`getRetiringSoon.js`** - Fetches the retiring soon page and maintains set registry
- **`fetchSetDetails.js`** - Fetches detail pages for all sets in the registry
- **`analyzeSetDetails.js`** - Analyzes set HTML files and extracts pricing, predictions, and details

## Usage

### Step 1: Discover Retiring Soon Sets

First, run the script to fetch the retiring soon page and update the registry:

```bash
node getRetiringSoon.js
```

This will:

- Fetch the current retiring soon featured sets
- Update `data/set-registry.json` with any new sets found
- Save HTML snapshot to `data/retiring-soon-pages/retiring-soon-{timestamp}.html`
- Track first seen date, last seen date, and times found for each set

### Step 2: Fetch Set Detail Pages

Next, fetch current details for ALL sets in your registry:

```bash
node fetchSetDetails.js
```

This will:

- Read all sets from `data/set-registry.json`
- Fetch current detail pages for every set
- Save HTML files to: `data/set-details/{timestamp}/set-{setNumber}.html`
- Creates a timestamped snapshot of all set details

### Step 3: Analyze Set Details

Finally, analyze the most recent fetch to extract structured data:

```bash
node analyzeSetDetails.js
```

This will:

- Find the most recent `data/set-details/{timestamp}/` directory
- Parse each HTML file to extract:
  - Set information (name, theme, pieces, minifigs, ratings)
  - Pricing data (retail, market, current value)
  - Retirement predictions (expected date, growth rate, future value)
- Save to `data/set-analysis/{timestamp}/`:
  - Individual set analysis: `set-{setNumber}-analysis.txt`
  - Summary report: `_summary.txt`
  - JSON data for historical tracking: `analysis-data.json`

### Historical Tracking Workflow

Run all three scripts periodically (daily, weekly, etc.) to build historical data:

```bash
# Daily monitoring workflow
node getRetiringSoon.js    # Update registry with latest featured sets
node fetchSetDetails.js    # Fetch current prices for all tracked sets
node analyzeSetDetails.js  # Extract and save structured data
```

Each run creates timestamped snapshots, allowing you to:

- Track price changes over time
- Monitor retirement date predictions
- Identify optimal selling times
- Compare market trends

## Directory Structure

```
lego-monitor/
├── getRetiringSoon.js
├── fetchSetDetails.js
├── analyzeSetDetails.js
├── SetRegistry.js
├── utils.js
├── package.json
└── data/                                    # All data lives here
    ├── set-registry.json                    # Master registry of all sets
    ├── retiring-soon-pages/                 # Historical snapshots
    │   ├── retiring-soon-2025-11-09T10-00-00-000Z.html
    │   └── retiring-soon-2025-11-10T10-00-00-000Z.html
    ├── set-details/                         # Timestamped detail fetches
    │   ├── 2025-11-09T10-30-00-000Z/
    │   │   ├── set-75331.html
    │   │   ├── set-76178.html
    │   │   └── set-76917.html
    │   └── 2025-11-10T10-30-00-000Z/
    │       ├── set-75331.html
    │       ├── set-76178.html
    │       └── set-76917.html
    └── set-analysis/                        # Timestamped analyses
        ├── 2025-11-09T10-30-00-000Z/
        │   ├── _summary.txt
        │   ├── analysis-data.json           # JSON for programmatic access
        │   ├── set-75331-analysis.txt
        │   ├── set-76178-analysis.txt
        │   └── set-76917-analysis.txt
        └── 2025-11-10T10-30-00-000Z/
            ├── _summary.txt
            ├── analysis-data.json
            └── ...
```

## Features

- **Set Registry**: Maintains a persistent registry of all discovered sets
- **Historical Tracking**: Timestamped snapshots allow tracking changes over time
- **Stealth Mode**: Uses puppeteer-extra with stealth plugin to avoid detection
- **Systematic Extraction**: Reliably extracts set numbers using CSS selectors and h4 headers
- **Comprehensive Analysis**: Extracts pricing, predictions, retirement data, and set details
- **Scalable Architecture**: Designed for monitoring market rates over time to identify selling opportunities
- **JSON Export**: Structured data in JSON format for programmatic analysis
- **Progress Feedback**: Console output shows progress and status
- **Error Handling**: Gracefully handles errors and continues processing
- **Rate Limiting**: Includes 1-second delay between requests to be respectful to the server
- **Summary Reports**: Creates individual analysis files plus summary and JSON data

## Utility Functions (utils.js)

- `initBrowser(headless)` - Initialize Puppeteer with stealth plugin
- `fetchPageContent(page, url)` - Fetch HTML content from a URL
- `saveFile(filename, content, dir)` - Save content to a file
- `getTimestamp()` - Generate timestamp for filenames
- `parseSetNumbersFile(filePath)` - Parse set-numbers txt file
- `findMostRecentFile(pattern, dir)` - Find the most recent file matching a pattern
- `ensureDirectoryExists(dir)` - Ensure a directory exists, create if it doesn't

## Data Extracted

The analysis script extracts the following information from each set:

**Set Information:**

- Set number, name, and theme
- Piece count and minifigure count
- Minifigure estimated value
- Price per piece (PPP)
- User ratings and review count
- Availability status

**Pricing Data:**

- Retail price (MSRP)
- Current market price
- Market price change percentage
- Current value (new/sealed and used)

**Retirement & Predictions:**

- Expected retirement date
- Predicted annual growth rate after retirement
- Expected value range after retirement
- Retirement risk assessment
