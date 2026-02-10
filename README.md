# HWInfo CSV Dashboard

A lightweight, client-side dashboard for visualizing HWInfo CSV exports. It detects time and numeric columns, groups metrics by category (CPU/GPU/RAM etc...), and generates interactive charts for quick performance analysis.

Live demo: <https://hwinfo-dashboard.vercel.app/>

## Features

- Drag-and-drop CSV upload with automatic format detection
- Smart time detection (date and time pairs, single timestamps, or row index)
- Automatic metric grouping by CPU, GPU, RAM, and other categories
- Interactive charts with legends and tooltips
- 100% client-side processing (no data leaves your machine)
- Dark mode support

Open <http://localhost:3000> in your browser.

## CSV Format Guide

The parser supports flexible CSV formats. Best results with:

**Option 1: Separate Date and Time Columns**

```
Date        | Time         | CPU Usage | GPU Usage
2024-01-15  | 14:30:45.123 | 45.2      | 60.5
```

Column names: contains "date" and "time" (case-insensitive).

**Option 2: Combined Timestamp Column**

```
Timestamp          | CPU Usage | GPU Usage
2024-01-15 14:30:45| 45.2      | 60.5
```

Column names: "timestamp", "recorded", "log time", etc.

**Option 3: Index-Based**

No time column required. The parser uses row index as the x-axis.

### Numeric Column Detection

Columns are detected as numeric when 60% or more values are valid numbers.

## Available Scripts

```bash
pnpm dev        # Start dev server (http://localhost:3000)
pnpm build      # Build for production
pnpm start      # Run production server
pnpm lint       # Lint with Biome
pnpm format     # Format code with Biome
```

## Tech Stack

| Layer        | Technology              |
| ------------ | ----------------------- |
| Framework    | Next.js 16 (App Router) |
| UI Library   | React 19 + shadcn/ui    |
| Styling      | Tailwind CSS 4          |
| Charts       | Recharts 2              |
| CSV Parsing  | Papaparse 5             |
| Type Safety  | TypeScript 5.9          |
| Code Quality | Biome 2.2               |

## Use Cases

- Monitor CPU and GPU performance over time
- Analyze temperature trends across logging sessions
- Detect performance bottlenecks and anomalies
- Quick data exploration without external tools

## Notes

- Runs entirely in the browser
- No data leaves your machine
- No backend or database required
- Supports files up to browser memory limits
