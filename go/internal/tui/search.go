package tui

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/groupultra/telegram-search/internal/provider/search"
)

// SearchModel is the search tab sub-model.
type SearchModel struct {
	input     textinput.Model
	results   []search.Result
	cursor    int
	searching bool
	err       error
	svc       *search.Service
	accountID string
}

var searchStyles = struct {
	result         lipgloss.Style
	selectedResult lipgloss.Style
	meta           lipgloss.Style
	content        lipgloss.Style
	noResults      lipgloss.Style
}{
	result: lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("238")).
		Padding(0, 1).
		MarginBottom(1),
	selectedResult: lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("205")).
		Padding(0, 1).
		MarginBottom(1),
	meta: lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Italic(true),
	content: lipgloss.NewStyle().
		Foreground(lipgloss.Color("252")),
	noResults: lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Italic(true).
		Padding(2, 4),
}

func newSearchModel(svc *search.Service, accountID string) SearchModel {
	ti := textinput.New()
	ti.Placeholder = "Type a query and press Enter…"
	ti.Focus()

	ti.CharLimit = 500

	return SearchModel{
		input:     ti,
		svc:       svc,
		accountID: accountID,
	}
}

// searchResultsMsg carries results back from the goroutine.
type searchResultsMsg struct {
	results []search.Result
	err     error
}

func (m SearchModel) Update(msg tea.Msg) (SearchModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "enter":
			if query := strings.TrimSpace(m.input.Value()); query != "" {
				m.searching = true
				m.results = nil
				m.err = nil

				return m, m.doSearch(query)
			}
		case "up", "k":
			if m.cursor > 0 {
				m.cursor--
			}
		case "down", "j":
			if m.cursor < len(m.results)-1 {
				m.cursor++
			}
		}

	case searchResultsMsg:
		m.searching = false
		m.results = msg.results
		m.err = msg.err
		m.cursor = 0
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)

	return m, cmd
}

// doSearch executes a search in the background and returns a tea.Cmd
// that delivers searchResultsMsg when complete.
func (m SearchModel) doSearch(query string) tea.Cmd {
	svc := m.svc
	accountID := m.accountID

	return func() tea.Msg {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		results, err := svc.Search(ctx, query, search.Filter{
			AccountID: accountID,
		}, search.Opts{Limit: 10})

		return searchResultsMsg{results: results, err: err}
	}
}

func (m SearchModel) View() string {
	var b strings.Builder

	// Input box.
	b.WriteString("\n")
	b.WriteString("  ")
	b.WriteString(m.input.View())
	b.WriteString("\n\n")

	switch {
	case m.searching:
		b.WriteString(searchStyles.noResults.Render("Searching…"))

	case m.err != nil:
		b.WriteString(searchStyles.noResults.Render("Error: " + m.err.Error()))

	case len(m.results) == 0 && m.input.Value() != "":
		b.WriteString(searchStyles.noResults.Render("No results found."))

	default:
		for i, r := range m.results {
			b.WriteString(m.renderResult(i, r))
		}
	}

	return b.String()
}

func (m SearchModel) renderResult(i int, r search.Result) string {
	ts := time.Unix(r.PlatformTimestamp, 0).Format("2006-01-02 15:04")

	chat := r.ChatName
	if chat == "" {
		chat = r.InChatID
	}

	meta := searchStyles.meta.Render(fmt.Sprintf(
		"#%d  %s · %s · %s  (score: %.3f)",
		i+1, chat, r.FromName, ts, r.Score,
	))

	content := r.Content
	if len(content) > 200 {
		content = content[:200] + "…"
	}

	body := searchStyles.content.Render(content)

	block := lipgloss.JoinVertical(lipgloss.Left, meta, body)

	if i == m.cursor {
		return searchStyles.selectedResult.Render(block) + "\n"
	}

	return searchStyles.result.Render(block) + "\n"
}
