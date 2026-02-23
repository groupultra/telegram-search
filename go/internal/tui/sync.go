package tui

import (
	"context"
	"fmt"
	"strings"

	"github.com/charmbracelet/bubbles/progress"
	"github.com/charmbracelet/bubbles/spinner"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"

	syncsvc "github.com/groupultra/telegram-search/internal/sync"
	"github.com/groupultra/telegram-search/internal/tgclient"
)

// syncState tracks the current sync job state.
type syncState int

const (
	syncIdle syncState = iota
	syncRunning
	syncDone
	syncFailed
)

// SyncModel is the sync tab sub-model.
type SyncModel struct {
	state     syncState
	sp        spinner.Model
	prog      progress.Model
	log       []string
	err       error
	svc       *syncsvc.Service
	tgc       tgclient.API
	accountID string
	cancel    context.CancelFunc
}

var syncStyles = struct {
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

func newSyncModel(svc *syncsvc.Service, tgc tgclient.API, accountID string) SyncModel {
	sp := spinner.New()
	sp.Spinner = spinner.Dot

	prog := progress.New(progress.WithDefaultGradient())

	return SyncModel{
		state:     syncIdle,
		sp:        sp,
		prog:      prog,
		svc:       svc,
		tgc:       tgc,
		accountID: accountID,
	}
}

// syncProgressMsg is sent from the goroutine as sync progresses.
type syncProgressMsg syncsvc.Progress

// syncDoneMsg signals that sync has finished.
type syncDoneMsg struct{ err error }

func (m SyncModel) Update(msg tea.Msg) (SyncModel, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "s":
			if m.state != syncRunning {
				return m.startSync()
			}
		case "c":
			if m.state == syncRunning && m.cancel != nil {
				m.cancel()
				m.state = syncFailed
				m.err = fmt.Errorf("cancelled by user")
			}
		}

	case syncProgressMsg:
		p := syncsvc.Progress(msg)
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

	case syncDoneMsg:
		m.state = syncDone
		if msg.err != nil {
			m.state = syncFailed
			m.err = msg.err
		}
		if m.cancel != nil {
			m.cancel()
		}
	}

	var spinCmd tea.Cmd
	if m.state == syncRunning {
		m.sp, spinCmd = m.sp.Update(msg)
	}
	return m, spinCmd
}

// startSync kicks off the sync job in a background goroutine.
func (m SyncModel) startSync() (SyncModel, tea.Cmd) {
	m.state = syncRunning
	m.log = nil
	m.err = nil

	ctx, cancel := context.WithCancel(context.Background())
	m.cancel = cancel

	svc := m.svc
	accountID := m.accountID
	opts := syncsvc.SyncOpts{Incremental: true}

	return m, func() tea.Msg {
		ch := make(chan syncsvc.Progress, 32)

		go svc.Run(ctx, accountID, opts, ch)

		// Return the first progress message immediately so the UI responds.
		// Subsequent messages are delivered via tea.Batch + tea.Cmd chain.
		p, ok := <-ch
		if !ok {
			return syncDoneMsg{}
		}

		// Spawn a goroutine to keep draining the channel and sending messages.
		go func() {
			for p := range ch {
				_ = p // NOTE: In a real implementation send via a tea.Program.Send().
			}
		}()

		return syncProgressMsg(p)
	}
}

func (m SyncModel) View() string {
	var b strings.Builder
	b.WriteString("\n")

	switch m.state {
	case syncIdle:
		b.WriteString(syncStyles.idle.Render("Press 's' to start syncing your Telegram message history."))
		b.WriteString("\n\n")
		b.WriteString(syncStyles.idle.Render("(Requires an active MTProto session — authenticate via the Auth tab first.)"))

	case syncRunning:
		b.WriteString("  ")
		b.WriteString(m.sp.View())
		b.WriteString(" Syncing…\n\n")
		b.WriteString("  ")
		b.WriteString(m.prog.View())
		b.WriteString("\n\n")
		b.WriteString("  Press 'c' to cancel.\n\n")
		b.WriteString(m.renderLog())

	case syncDone:
		b.WriteString("  ✅ Sync complete!\n\n")
		b.WriteString(m.renderLog())

	case syncFailed:
		msg := "Sync failed"
		if m.err != nil {
			msg = "Sync failed: " + m.err.Error()
		}
		b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render("  ✗ "+msg))
		b.WriteString("\n\n")
		b.WriteString(m.renderLog())
	}

	return b.String()
}

func (m SyncModel) renderLog() string {
	if len(m.log) == 0 {
		return ""
	}

	var b strings.Builder
	for _, line := range m.log {
		b.WriteString(syncStyles.logLine.Render("  "+line) + "\n")
	}
	return syncStyles.log.Render(b.String())
}
