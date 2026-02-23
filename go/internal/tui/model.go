// Package tui provides the interactive terminal user interface built with
// Bubble Tea (https://github.com/charmbracelet/bubbletea).
//
// Screen layout:
//
//	┌─────────────────────────────────────────┐
//	│  Telegram Search  [Search] [Takeout] [Auth]│  ← tab bar
//	├─────────────────────────────────────────┤
//	│  (active view renders here)             │
//	└─────────────────────────────────────────┘
//	  status: ready                             ← status bar
//
// Navigation: Tab / Shift+Tab cycles tabs; Ctrl+C or q exits.
package tui

import (
	"github.com/charmbracelet/bubbles/key"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/groupultra/telegram-search/internal/provider/search"
	"github.com/groupultra/telegram-search/internal/provider/takeout"
	"github.com/groupultra/telegram-search/pkg/tgclient"
)

// tab identifies which view is active.
type tab int

const (
	tabSearch tab = iota
	tabTakeout
	tabAuth
	tabCount
)

var tabNames = [tabCount]string{"Search", "Takeout", "Auth"}

// keyMap holds the global keybindings.
type keyMap struct {
	NextTab key.Binding
	PrevTab key.Binding
	Quit    key.Binding
}

var keys = keyMap{
	NextTab: key.NewBinding(key.WithKeys("tab"), key.WithHelp("tab", "next tab")),
	PrevTab: key.NewBinding(key.WithKeys("shift+tab"), key.WithHelp("shift+tab", "prev tab")),
	Quit:    key.NewBinding(key.WithKeys("ctrl+c", "q"), key.WithHelp("ctrl+c/q", "quit")),
}

// styles groups all lipgloss styles used by the TUI.
var styles = struct {
	tab         lipgloss.Style
	activeTab   lipgloss.Style
	tabBorder   lipgloss.Style
	statusOK    lipgloss.Style
	statusError lipgloss.Style
	title       lipgloss.Style
}{
	tab: lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Padding(0, 2),
	activeTab: lipgloss.NewStyle().
		Foreground(lipgloss.Color("205")).
		Bold(true).
		Padding(0, 2).
		Underline(true),
	tabBorder: lipgloss.NewStyle().
		BorderStyle(lipgloss.NormalBorder()).
		BorderBottom(true).
		BorderForeground(lipgloss.Color("238")),
	statusOK: lipgloss.NewStyle().
		Foreground(lipgloss.Color("34")),
	statusError: lipgloss.NewStyle().
		Foreground(lipgloss.Color("196")),
	title: lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("205")),
}

// Model is the root Bubble Tea model.
type Model struct {
	activeTab tab
	width     int
	height    int
	status    string
	statusErr bool

	searchView  SearchModel
	takeoutView TakeoutModel
	authView    AuthModel
}

// Deps groups the service dependencies needed to build the Model.
type Deps struct {
	Search    *search.Service
	Takeout   *takeout.Service
	TGClient  tgclient.API
	AccountID string
}

// NewModel initialises the root model.
func NewModel(deps Deps) Model {
	return Model{
		activeTab:   tabSearch,
		status:      "ready",
		searchView:  newSearchModel(deps.Search, deps.AccountID),
		takeoutView: newTakeoutModel(deps.Takeout, deps.TGClient, deps.AccountID),
		authView:    newAuthModel(deps.TGClient),
	}
}

// Init is the Bubble Tea initialisation command.
func (m Model) Init() tea.Cmd {
	return nil
}

// Update handles incoming messages and key events.
func (m Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

	case tea.KeyMsg:
		switch {
		case key.Matches(msg, keys.Quit):
			return m, tea.Quit
		case key.Matches(msg, keys.NextTab):
			m.activeTab = (m.activeTab + 1) % tabCount
			return m, nil
		case key.Matches(msg, keys.PrevTab):
			m.activeTab = (m.activeTab + tabCount - 1) % tabCount
			return m, nil
		}

	case statusMsg:
		m.status = string(msg)
		m.statusErr = false

	case errMsg:
		m.status = msg.Error()
		m.statusErr = true
	}

	// Delegate to the active sub-model.
	var cmd tea.Cmd

	switch m.activeTab {
	case tabSearch:
		m.searchView, cmd = m.searchView.Update(msg)
	case tabTakeout:
		m.takeoutView, cmd = m.takeoutView.Update(msg)
	case tabAuth:
		m.authView, cmd = m.authView.Update(msg)
	}

	return m, cmd
}

// View renders the complete TUI.
func (m Model) View() string {
	// Tab bar.
	tabBar := m.renderTabBar()

	// Active view content.
	var content string

	switch m.activeTab {
	case tabSearch:
		content = m.searchView.View()
	case tabTakeout:
		content = m.takeoutView.View()
	case tabAuth:
		content = m.authView.View()
	}

	// Status bar.
	status := m.renderStatus()

	return lipgloss.JoinVertical(lipgloss.Left, tabBar, content, status)
}

func (m Model) renderTabBar() string {
	var tabs []string

	for i := range tabCount {
		name := tabNames[i]
		if i == m.activeTab {
			tabs = append(tabs, styles.activeTab.Render(name))
		} else {
			tabs = append(tabs, styles.tab.Render(name))
		}
	}

	bar := lipgloss.JoinHorizontal(lipgloss.Top, tabs...)

	return styles.tabBorder.Width(m.width).Render(bar)
}

func (m Model) renderStatus() string {
	s := m.status
	if m.statusErr {
		return styles.statusError.Render("✗ " + s)
	}

	return styles.statusOK.Render("● " + s)
}

// statusMsg sets the status bar text.
type statusMsg string

// errMsg sets the status bar to an error state.
type errMsg error

// Run starts the Bubble Tea program and blocks until the user exits.
func Run(deps Deps) error {
	m := NewModel(deps)
	p := tea.NewProgram(m, tea.WithAltScreen())
	_, err := p.Run()

	return err
}
