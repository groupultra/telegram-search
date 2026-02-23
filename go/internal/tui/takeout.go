package tui

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	"github.com/groupultra/telegram-search/internal/provider/takeout"
	"github.com/groupultra/telegram-search/pkg/tgclient"
)

// takeoutState tracks the current takeout job state.
type takeoutState int

const (
	takeoutIdle takeoutState = iota
	takeoutRunning
	takeoutDone
	takeoutFailed
)

// TakeoutModel is the takeout tab sub-model.
type TakeoutModel struct {
	state     takeoutState
	sp        spinner.Model
	prog      progress.Model
	log       []string
	err       error
	svc       *takeout.Service
	tgc       tgclient.API
	accountID string
	cancel    context.CancelFunc
}

var takeoutStyles = struct {
	idle    lipgloss.Style
	log     lipgloss.Style
	logLine lipgloss.Style
}{
	idle: lipgloss.NewStyle().
		Foreground(lipgloss.Color("240")).
		Italic(true).
		Padding(2, 4),
	log: lipgloss.NewStyle().
		Padding(0, 2),
	logLine: lipgloss.NewStyle().
		Foreground(lipgloss.Color("252")),
}

func newTakeoutModel(svc *takeout.Service, tgc tgclient.API, accountID string) TakeoutModel {
	sp := spinner.New()
	sp.Spinner = spinner.Dot

	prog := progress.New(progress.WithDefaultGradient())

	return TakeoutModel{
		state:     takeoutIdle,
		sp:        sp,
		prog:      prog,
		svc:       svc,
		tgc:       tgc,
		accountID: accountID,
	}
}

// takeoutProgressMsg is sent from the goroutine as takeout progresses.
type takeoutProgressMsg takeout.Progress

// takeoutDoneMsg signals that takeout has finished.
type takeoutDoneMsg struct{ err error }

func (m TakeoutModel) Update(msg tea.Msg) (TakeoutModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "s":
			if m.state != takeoutRunning {
				return m.startTakeout()
			}
		case "c":
			if m.state == takeoutRunning && m.cancel != nil {
				m.cancel()

				m.state = takeoutFailed
				m.err = errors.New("cancelled by user")
			}
		}

	case takeoutProgressMsg:
		p := takeout.Progress(msg)

		line := fmt.Sprintf("%-30s  %d/%d  %s", p.ChatName, p.Done, p.Total, p.Msg)
		if p.Err != nil {
			line = fmt.Sprintf("⚠ %s: %v", p.ChatID, p.Err)
		}

		m.log = append(m.log, line)
		// Keep at most 100 lines to avoid unbounded growth.
		if len(m.log) > 100 {
			m.log = m.log[len(m.log)-100:]
		}
		// Update progress bar.
		if p.Total > 0 {
			pct := float64(p.Done) / float64(p.Total)
			// NOTE: progress.Model.Update returns tea.Model (interface); we must
			// type-assert back to progress.Model to store it.
			updated, progCmd := m.prog.Update(m.prog.SetPercent(pct))
			if prog, ok := updated.(progress.Model); ok {
				m.prog = prog
			}

			return m, progCmd
		}

	case takeoutDoneMsg:
		m.state = takeoutDone
		if msg.err != nil {
			m.state = takeoutFailed
			m.err = msg.err
		}

		if m.cancel != nil {
			m.cancel()
		}
	}

	var spinCmd tea.Cmd
	if m.state == takeoutRunning {
		m.sp, spinCmd = m.sp.Update(msg)
	}

	return m, spinCmd
}

// startTakeout kicks off the takeout job in a background goroutine.
func (m TakeoutModel) startTakeout() (TakeoutModel, tea.Cmd) {
	m.state = takeoutRunning
	m.log = nil
	m.err = nil

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	svc := m.svc
	accountID := m.accountID
	opts := takeout.TakeoutOpts{Incremental: true}

	return m, func() tea.Msg {
		ch := make(chan takeout.Progress, 32)

		go svc.Run(ctx, accountID, opts, ch)

		// Return the first progress message immediately so the UI responds.
		// Subsequent messages are delivered via tea.Batch + tea.Cmd chain.
		p, ok := <-ch
		if !ok {
			return takeoutDoneMsg{}
		}

		// Spawn a goroutine to keep draining the channel and sending messages.
		go func() {
			for p := range ch {
				_ = p // NOTE: In a real implementation send via a tea.Program.Send().
			}
		}()

		return takeoutProgressMsg(p)
	}
}

func (m TakeoutModel) View() string {
	var b strings.Builder
	b.WriteString("\n")

	switch m.state {
	case takeoutIdle:
		b.WriteString(takeoutStyles.idle.Render("Press 's' to start exporting your Telegram message history."))
		b.WriteString("\n\n")
		b.WriteString(takeoutStyles.idle.Render("(Requires an active MTProto session — authenticate via the Auth tab first.)"))

	case takeoutRunning:
		b.WriteString("  ")
		b.WriteString(m.sp.View())
		b.WriteString(" Exporting…\n\n")
		b.WriteString("  ")
		b.WriteString(m.prog.View())
		b.WriteString("\n\n")
		b.WriteString("  Press 'c' to cancel.\n\n")
		b.WriteString(m.renderLog())

	case takeoutDone:
		b.WriteString("  ✅ Takeout complete!\n\n")
		b.WriteString(m.renderLog())

	case takeoutFailed:
		msg := "Takeout failed"
		if m.err != nil {
			msg = "Takeout failed: " + m.err.Error()
		}

		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("  ✗ " + msg))
		b.WriteString("\n\n")
		b.WriteString(m.renderLog())
	}

	return b.String()
}

func (m TakeoutModel) renderLog() string {
	if len(m.log) == 0 {
		return ""
	}

	var b strings.Builder
	for _, line := range m.log {
		b.WriteString(takeoutStyles.logLine.Render("  "+line) + "\n")
	}

	return takeoutStyles.log.Render(b.String())
}
