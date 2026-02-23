package tui

import (
	"context"
	"strings"

	"github.com/charmbracelet/bubbles/textinput"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/groupultra/telegram-search/internal/tgclient"
)

// authStep tracks which prompt we're on.
type authStep int

const (
	authStepPhone    authStep = iota
	authStepCode
	authStepPassword // 2FA
	authStepDone
)

// AuthModel handles the interactive MTProto authentication flow.
type AuthModel struct {
	step     authStep
	input    textinput.Model
	err      error
	info     string
	tgc      tgclient.API
	sentCode *tgclient.SentCode
	phone    string
}

var authStyles = struct {
	prompt   lipgloss.Style
	info     lipgloss.Style
	success  lipgloss.Style
	errStyle lipgloss.Style
}{
	prompt: lipgloss.NewStyle().
		Foreground(lipgloss.Color("205")).
		Bold(true).
		Padding(0, 2),
	info: lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Padding(0, 2),
	success: lipgloss.NewStyle().
		Foreground(lipgloss.Color("34")).
		Bold(true).
		Padding(0, 2),
	errStyle: lipgloss.NewStyle().
		Foreground(lipgloss.Color("196")).
		Padding(0, 2),
}

func newAuthModel(tgc tgclient.API) AuthModel {
	ti := textinput.New()
	ti.Placeholder = "+1 234 567 8900"
	ti.Focus()

	step := authStepPhone
	info := "Enter your Telegram phone number to authenticate."
	if tgc != nil && tgc.IsAuthenticated() {
		step = authStepDone
		info = "Already authenticated."
	}

	return AuthModel{
		step:  step,
		input: ti,
		info:  info,
		tgc:   tgc,
	}
}

// authResultMsg carries the result of an async auth step.
type authResultMsg struct {
	sentCode *tgclient.SentCode
	err      error
}

// authDoneMsg signals a successful auth.
type authDoneMsg struct{}

func (m AuthModel) Update(msg tea.Msg) (AuthModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		if msg.String() == "enter" {
			value := strings.TrimSpace(m.input.Value())
			if value == "" {
				return m, nil
			}
			switch m.step {
			case authStepPhone:
				m.phone = value
				m.input.SetValue("")
				m.input.Placeholder = "Enter auth code"
				return m, m.sendCode(value)
			case authStepCode:
				return m, m.submitCode(value)
			case authStepPassword:
				return m, m.submit2FA(value)
			}
		}

	case authResultMsg:
		if msg.err != nil {
			m.err = msg.err
		} else if msg.sentCode != nil {
			m.sentCode = msg.sentCode
			m.step = authStepCode
			m.info = "Code sent to your Telegram app. Enter it below:"
			m.err = nil
		}

	case authDoneMsg:
		m.step = authStepDone
		m.info = "Authenticated successfully!"
		m.err = nil
	}

	var cmd tea.Cmd
	m.input, cmd = m.input.Update(msg)
	return m, cmd
}

func (m AuthModel) sendCode(phone string) tea.Cmd {
	tgc := m.tgc
	return func() tea.Msg {
		sent, err := tgc.AuthWithPhone(context.Background(), phone)
		return authResultMsg{sentCode: sent, err: err}
	}
}

func (m AuthModel) submitCode(code string) tea.Cmd {
	tgc := m.tgc
	phone := m.phone
	sentCode := m.sentCode
	return func() tea.Msg {
		if err := tgc.AuthWithCode(context.Background(), phone, code, sentCode); err != nil {
			return authResultMsg{err: err}
		}
		return authDoneMsg{}
	}
}

func (m AuthModel) submit2FA(password string) tea.Cmd {
	tgc := m.tgc
	return func() tea.Msg {
		if err := tgc.AuthWithPassword(context.Background(), password); err != nil {
			return authResultMsg{err: err}
		}
		return authDoneMsg{}
	}
}

func (m AuthModel) View() string {
	var b strings.Builder
	b.WriteString("\n\n")

	if m.step == authStepDone {
		b.WriteString(authStyles.success.Render("✅ " + m.info))
		return b.String()
	}

	prompts := [...]string{
		authStepPhone:    "Phone number:",
		authStepCode:     "Auth code:",
		authStepPassword: "2FA password:",
	}
	if int(m.step) < len(prompts) {
		b.WriteString(authStyles.prompt.Render(prompts[m.step]))
		b.WriteString("\n\n  ")
		b.WriteString(m.input.View())
		b.WriteString("\n\n")
	}

	if m.info != "" {
		b.WriteString(authStyles.info.Render(m.info))
		b.WriteString("\n")
	}

	if m.err != nil {
		b.WriteString(authStyles.errStyle.Render("Error: " + m.err.Error()))
		b.WriteString("\n")
	}

	return b.String()
}
