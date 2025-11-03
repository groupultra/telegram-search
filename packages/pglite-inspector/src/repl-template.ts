export const replHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PGlite REPL</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: #1e1e1e;
      color: #d4d4d4;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      height: 100%;
      padding: 16px;
      gap: 12px;
    }

    .header {
      flex-shrink: 0;
    }

    .header h2 {
      font-size: 16px;
      font-weight: 600;
      color: #42b883;
      margin-bottom: 8px;
    }

    .editor-section {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .editor-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .editor-label {
      font-size: 12px;
      font-weight: 500;
      color: #858585;
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }

    textarea {
      width: 100%;
      min-height: 120px;
      padding: 12px;
      background: #252525;
      border: 1px solid #3e3e3e;
      border-radius: 6px;
      color: #d4d4d4;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
    }

    textarea:focus {
      border-color: #42b883;
    }

    button {
      padding: 6px 16px;
      background: #42b883;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
    }

    button:hover {
      background: #35a372;
    }

    button:active {
      transform: translateY(1px);
    }

    button:disabled {
      background: #404040;
      color: #666;
      cursor: not-allowed;
    }

    button.secondary {
      background: #404040;
      color: #d4d4d4;
    }

    button.secondary:hover {
      background: #4a4a4a;
    }

    .results-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      gap: 8px;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .results-content {
      flex: 1;
      overflow: auto;
      background: #252525;
      border: 1px solid #3e3e3e;
      border-radius: 6px;
      padding: 12px;
    }

    .empty-state {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #858585;
      font-size: 13px;
    }

    .query-result {
      margin-bottom: 16px;
    }

    .query-result:last-child {
      margin-bottom: 0;
    }

    .query-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      padding: 8px;
      background: #2d2d2d;
      border-radius: 4px;
      font-size: 12px;
    }

    .query-sql {
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      color: #9cdcfe;
      flex: 1;
      margin-right: 12px;
      overflow-x: auto;
      white-space: nowrap;
    }

    .query-meta {
      display: flex;
      gap: 12px;
      color: #858585;
    }

    .meta-item {
      display: flex;
      gap: 4px;
    }

    .meta-label {
      font-weight: 500;
    }

    .table-wrapper {
      overflow-x: auto;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    th {
      background: #2d2d2d;
      color: #42b883;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      border-bottom: 2px solid #3e3e3e;
      position: sticky;
      top: 0;
    }

    td {
      padding: 8px 12px;
      border-bottom: 1px solid #3e3e3e;
    }

    tr:hover td {
      background: #2d2d2d;
    }

    .null-value {
      color: #858585;
      font-style: italic;
    }

    .error-message {
      padding: 12px;
      background: #5a1e1e;
      border: 1px solid #8b2c2c;
      border-radius: 4px;
      color: #f48771;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
    }

    .success-message {
      padding: 12px;
      background: #1e3a2e;
      border: 1px solid #2c5f47;
      border-radius: 4px;
      color: #42b883;
      font-size: 12px;
    }

    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: #1e1e1e;
    }

    ::-webkit-scrollbar-thumb {
      background: #404040;
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #4a4a4a;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>SQL REPL</h2>
    </div>

    <div class="editor-section">
      <div class="editor-header">
        <span class="editor-label">SQL Query</span>
        <div class="editor-actions">
          <button class="secondary" onclick="clearQuery()">Clear</button>
          <button onclick="executeQuery()" id="executeBtn">Execute (Ctrl+Enter)</button>
        </div>
      </div>
      <textarea
        id="queryInput"
        placeholder="Enter SQL query... (e.g., SELECT * FROM chat_messages LIMIT 10)"
        spellcheck="false"
      ></textarea>
    </div>

    <div class="results-section">
      <div class="results-header">
        <span class="editor-label">Results</span>
        <button class="secondary" onclick="clearResults()">Clear Results</button>
      </div>
      <div class="results-content" id="results">
        <div class="empty-state">Execute a query to see results</div>
      </div>
    </div>
  </div>

  <script>
    // Query history
    let queryHistory = [];
    const MAX_HISTORY = 50;

    // Notify parent that REPL is ready (sent once on load)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'pglite-repl-ready' }, '*');
    }

    // Handle keyboard shortcuts
    document.getElementById('queryInput').addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
    });

    function clearQuery() {
      document.getElementById('queryInput').value = '';
    }

    function clearResults() {
      document.getElementById('results').innerHTML = '<div class="empty-state">Execute a query to see results</div>';
    }

    async function executeQuery() {
      const queryInput = document.getElementById('queryInput');
      const query = queryInput.value.trim();

      if (!query) {
        showError('Please enter a SQL query');
        return;
      }

      const executeBtn = document.getElementById('executeBtn');
      executeBtn.disabled = true;
      executeBtn.textContent = 'Executing...';

      try {
        // Send query to parent for execution
        const startTime = performance.now();

        // Request query execution through postMessage
        window.parent.postMessage({
          type: 'pglite-execute-query',
          query: query
        }, '*');

        // Listen for response
        const handleResponse = (event) => {
          // Validate response type (source is already validated by parent)
          if (event.data.type === 'pglite-query-result') {
            window.removeEventListener('message', handleResponse);

            const duration = performance.now() - startTime;

            if (event.data.error) {
              showError(event.data.error);
            } else {
              showResult(query, event.data.result, duration);
              addToHistory(query);
            }

            executeBtn.disabled = false;
            executeBtn.textContent = 'Execute (Ctrl+Enter)';
          }
        };

        window.addEventListener('message', handleResponse);

        // Timeout after 30 seconds
        setTimeout(() => {
          window.removeEventListener('message', handleResponse);
          if (executeBtn.disabled) {
            showError('Query execution timed out after 30 seconds');
            executeBtn.disabled = false;
            executeBtn.textContent = 'Execute (Ctrl+Enter)';
          }
        }, 30000);

      } catch (error) {
        showError(error.message);
        executeBtn.disabled = false;
        executeBtn.textContent = 'Execute (Ctrl+Enter)';
      }
    }

    function showError(message) {
      const resultsDiv = document.getElementById('results');
      const errorHTML = \`
        <div class="query-result">
          <div class="error-message">\${escapeHtml(message)}</div>
        </div>
      \`;

      if (resultsDiv.querySelector('.empty-state')) {
        resultsDiv.innerHTML = errorHTML;
      } else {
        resultsDiv.insertAdjacentHTML('afterbegin', errorHTML);
      }
    }

    function showResult(query, result, duration) {
      const resultsDiv = document.getElementById('results');

      // Remove empty state if present
      const emptyState = resultsDiv.querySelector('.empty-state');
      if (emptyState) {
        emptyState.remove();
      }

      let resultHTML = '';

      if (!result.rows || result.rows.length === 0) {
        // Non-SELECT query or empty result
        const affectedCount = result.affectedRows !== undefined ? Number(result.affectedRows) : null
        resultHTML = \`
          <div class="query-result">
            <div class="query-info">
              <div class="query-sql">\${escapeHtml(query)}</div>
              <div class="query-meta">
                <div class="meta-item">
                  <span class="meta-label">Time:</span>
                  <span>\${duration.toFixed(2)}ms</span>
                </div>
              </div>
            </div>
            <div class="success-message">
              Query executed successfully\${affectedCount !== null ? \` (\${affectedCount} rows affected)\` : ''}
            </div>
          </div>
        \`;
      } else {
        // SELECT query with results
        const columns = Object.keys(result.rows[0]);

        resultHTML = \`
          <div class="query-result">
            <div class="query-info">
              <div class="query-sql">\${escapeHtml(query)}</div>
              <div class="query-meta">
                <div class="meta-item">
                  <span class="meta-label">Rows:</span>
                  <span>\${result.rows.length}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">Time:</span>
                  <span>\${duration.toFixed(2)}ms</span>
                </div>
              </div>
            </div>
            <div class="table-wrapper">
              <table>
                <thead>
                  <tr>
                    \${columns.map(col => \`<th>\${escapeHtml(col)}</th>\`).join('')}
                  </tr>
                </thead>
                <tbody>
                  \${result.rows.map(row => \`
                    <tr>
                      \${columns.map(col => {
                        const value = row[col];
                        if (value === null || value === undefined) {
                          return '<td><span class="null-value">NULL</span></td>';
                        }
                        return \`<td>\${escapeHtml(String(value))}</td>\`;
                      }).join('')}
                    </tr>
                  \`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        \`;
      }

      resultsDiv.insertAdjacentHTML('afterbegin', resultHTML);
    }

    function addToHistory(query) {
      queryHistory.unshift(query);
      if (queryHistory.length > MAX_HISTORY) {
        queryHistory.pop();
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>
`
