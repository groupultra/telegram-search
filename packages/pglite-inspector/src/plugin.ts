import type { PGlite } from '@electric-sql/pglite'
import type { App } from 'vue'

import { setupDevToolsPlugin } from '@vue/devtools-kit'

export interface PGliteDevtoolsOptions {
  app: App
  db: PGlite
}

const INSPECTOR_ID = 'pglite-inspector'
const TIMELINE_LAYER_ID = 'pglite-queries'

export function setupPGliteDevtools({ app, db }: PGliteDevtoolsOptions) {
  setupDevToolsPlugin(
    {
      id: 'dev.pglite',
      label: 'PGlite',
      packageName: '@electric-sql/pglite',
      homepage: 'https://pglite.dev',
      logo: 'https://pglite.dev/img/logo.svg',
      app,
      enableEarlyProxy: true,
    },
    (api: any) => {
      api.addInspector({
        id: INSPECTOR_ID,
        label: 'PGlite Database',
        icon: 'storage',
        treeFilterPlaceholder: 'Search tables...',
      })

      api.addTimelineLayer({
        id: TIMELINE_LAYER_ID,
        label: 'PGlite Queries',
        color: 0x42B883,
      })

      api.on.getInspectorTree(async (payload: any) => {
        if (payload.inspectorId === INSPECTOR_ID) {
          try {
            const tables = await db.query<{ tablename: string }>(
              `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`,
            )

            payload.rootNodes = [
              {
                id: 'database',
                label: 'Database',
                children: tables.rows.map(table => ({
                  id: `table:${table.tablename}`,
                  label: table.tablename,
                  tags: [
                    {
                      label: 'table',
                      textColor: 0x000000,
                      backgroundColor: 0x42B883,
                    },
                  ],
                })),
              },
            ]
          }
          catch (error) {
            console.error('Failed to get inspector tree:', error)
          }
        }
      })

      api.on.getInspectorState(async (payload: any) => {
        if (payload.inspectorId === INSPECTOR_ID && payload.nodeId.startsWith('table:')) {
          const tableName = payload.nodeId.replace('table:', '')

          try {
            const result = await db.query(
              `SELECT * FROM ${tableName} LIMIT 100`,
            )

            const columns = await db.query<{ column_name: string, data_type: string }>(
              `SELECT column_name, data_type
               FROM information_schema.columns
               WHERE table_name = $1 AND table_schema = 'public'
               ORDER BY ordinal_position`,
              [tableName],
            )

            payload.state = {
              'Table Info': [
                {
                  key: 'name',
                  value: tableName,
                },
                {
                  key: 'rows',
                  value: result.rows.length,
                },
              ],
              'Columns': columns.rows.map(col => ({
                key: col.column_name,
                value: col.data_type,
              })),
              'Data Preview': result.rows.map((row, index) => ({
                key: `row ${index + 1}`,
                value: row,
                editable: false,
              })),
            }
          }
          catch (error) {
            payload.state = {
              Error: [
                {
                  key: 'message',
                  value: error instanceof Error ? error.message : String(error),
                },
              ],
            }
          }
        }
      })

      const originalExec = db.exec.bind(db)
      db.exec = async function (query: string, options?: any) {
        const startTime = Date.now()

        try {
          const result = await originalExec(query, options)
          const duration = Date.now() - startTime

          api.addTimelineEvent({
            layerId: TIMELINE_LAYER_ID,
            event: {
              time: api.now(),
              data: {
                query,
                duration: `${duration}ms`,
                rowCount: result[0]?.rows?.length || 0,
              },
              title: 'Query Executed',
              subtitle: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
            },
          })

          return result
        }
        catch (error) {
          const duration = Date.now() - startTime

          api.addTimelineEvent({
            layerId: TIMELINE_LAYER_ID,
            event: {
              time: api.now(),
              data: {
                query,
                duration: `${duration}ms`,
                error: error instanceof Error ? error.message : String(error),
              },
              title: 'Query Failed',
              subtitle: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
              logType: 'error',
            },
          })

          throw error
        }
      }

      const originalQuery = db.query.bind(db)
      db.query = async function (query: string, params?: any[], options?: any): Promise<any> {
        const startTime = Date.now()

        try {
          const result = await originalQuery(query, params, options)
          const duration = Date.now() - startTime

          api.addTimelineEvent({
            layerId: TIMELINE_LAYER_ID,
            event: {
              time: api.now(),
              data: {
                query,
                params,
                duration: `${duration}ms`,
                rowCount: result.rows?.length || 0,
              },
              title: 'Query Executed',
              subtitle: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
            },
          })

          return result
        }
        catch (error) {
          const duration = Date.now() - startTime

          api.addTimelineEvent({
            layerId: TIMELINE_LAYER_ID,
            event: {
              time: api.now(),
              data: {
                query,
                params,
                duration: `${duration}ms`,
                error: error instanceof Error ? error.message : String(error),
              },
              title: 'Query Failed',
              subtitle: query.substring(0, 50) + (query.length > 50 ? '...' : ''),
              logType: 'error',
            },
          })

          throw error
        }
      }
    },
  )
}
