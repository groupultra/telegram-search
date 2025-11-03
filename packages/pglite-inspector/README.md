# @pglite-devtools/plugin

Vue DevTools plugin for PGlite database inspection and query monitoring.

## Features

- **Database Inspector**: Browse tables, view structure and data in Vue DevTools
- **Query Timeline**: Real-time monitoring of all database queries with execution time and results
- **Seamless Integration**: Works with `@electric-sql/pglite-vue` hooks

## Installation

```bash
npm install @pglite-devtools/plugin
```

## Usage

```typescript
import { createApp } from 'vue'
import { PGlite } from '@electric-sql/pglite'
import { setupPGliteDevtools } from '@pglite-devtools/plugin'
import App from './App.vue'

const app = createApp(App)
const db = new PGlite()

// Setup database tables...
await db.exec(`
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    task TEXT NOT NULL,
    done BOOLEAN DEFAULT FALSE
  );
`)

// Provide database to app
app.provide('PGlite', db)

// Setup DevTools plugin
setupPGliteDevtools({ app, db })

app.mount('#app')
```

## DevTools Features

### Database Inspector

Open Vue DevTools and navigate to the "PGlite Database" tab to:
- Browse all tables in your database
- View table structure and column types
- Preview table data (up to 100 rows)

### Query Timeline

The "PGlite Queries" timeline layer shows:
- All executed queries
- Query execution time
- Number of rows returned
- Query parameters
- Error information for failed queries

## Requirements

- Vue 3.x
- @electric-sql/pglite >= 0.3.0
- @vue/devtools-api ^8.0.0

## License

MIT
