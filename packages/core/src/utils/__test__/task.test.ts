import type { CoreEventContext } from '../../context'

import { useLogger } from '@guiiai/logg'
import { describe, expect, it, vi } from 'vitest'

import { TakeoutTaskProgress } from '../../types/events'
import { createTask } from '../task'

const logger = useLogger()

describe('utils/task - createTask', () => {
  it('should emit takeout:task:progress on updateProgress for takeout task', () => {
    const eventContext = { emit: vi.fn() } as unknown as CoreEventContext

    const task = createTask('takeout', { chatIds: ['1', '2'] }, eventContext, logger)

    task.updateProgress(10, 'hello')

    expect(eventContext.emit).toHaveBeenCalledTimes(1)
    expect(eventContext.emit).toHaveBeenCalledWith(
      TakeoutTaskProgress,
      expect.objectContaining({
        taskId: expect.any(String),
        type: 'takeout',
        progress: 10,
        lastMessage: 'hello',
        metadata: { chatIds: ['1', '2'] },
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      }),
    )

    // toJSON payload must not expose abortController
    const payload = (eventContext.emit as any).mock.calls[0][1]
    expect(payload).not.toHaveProperty('abortController')
  })

  it('should set progress=-1 and emit on updateError for takeout task', () => {
    const eventContext = { emit: vi.fn() } as unknown as CoreEventContext

    const task = createTask('takeout', { chatIds: ['x'] }, eventContext, logger)

    task.updateError(new Error('boom'))

    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('boom')

    expect(eventContext.emit).toHaveBeenCalledTimes(1)
    expect(eventContext.emit).toHaveBeenCalledWith(
      TakeoutTaskProgress,
      expect.objectContaining({
        type: 'takeout',
        progress: -1,
        lastError: 'boom',
      }),
    )
  })

  it('abort should abort signal and set error', () => {
    const eventContext = { emit: vi.fn() } as unknown as CoreEventContext

    const task = createTask('takeout', { chatIds: ['x'] }, eventContext, logger)

    task.abort()

    expect(task.state.abortController.signal.aborted).toBe(true)
    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('Task aborted')

    // abort internally calls updateError, which emits once
    expect(eventContext.emit).toHaveBeenCalledTimes(1)
  })

  it('should not emit takeout progress events for non-takeout task types', () => {
    const eventContext = { emit: vi.fn() } as unknown as CoreEventContext

    const task = createTask('embed', undefined, eventContext, logger)
    task.updateProgress(1)

    expect(eventContext.emit).not.toHaveBeenCalled()
  })
})
