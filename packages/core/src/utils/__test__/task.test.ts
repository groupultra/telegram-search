import { useLogger } from '@guiiai/logg'
import { createContext } from '@moeru/eventa'
import { describe, expect, it, vi } from 'vitest'

import { takeoutTaskProgressEvent } from '../../events'
import { createTask } from '../task'

const logger = useLogger()

describe('utils/task - createTask', () => {
  it('should emit takeout:task:progress on updateProgress for takeout task', () => {
    const eventaCtx = createContext()
    const emitSpy = vi.spyOn(eventaCtx, 'emit')

    const task = createTask('takeout', { chatIds: ['1', '2'] }, eventaCtx, logger)

    task.updateProgress(10, 'hello')

    expect(emitSpy).toHaveBeenCalledTimes(1)
    expect(emitSpy).toHaveBeenCalledWith(
      takeoutTaskProgressEvent,
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
    const payload = emitSpy.mock.calls[0][1]
    expect(payload).not.toHaveProperty('abortController')
  })

  it('should set progress=-1 and emit on updateError for takeout task', () => {
    const eventaCtx = createContext()
    const emitSpy = vi.spyOn(eventaCtx, 'emit')

    const task = createTask('takeout', { chatIds: ['x'] }, eventaCtx, logger)

    task.updateError(new Error('boom'))

    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('boom')

    expect(emitSpy).toHaveBeenCalledTimes(1)
    expect(emitSpy).toHaveBeenCalledWith(
      takeoutTaskProgressEvent,
      expect.objectContaining({
        type: 'takeout',
        progress: -1,
        lastError: 'boom',
      }),
    )
  })

  it('abort should abort signal and set error', () => {
    const eventaCtx = createContext()
    const emitSpy = vi.spyOn(eventaCtx, 'emit')

    const task = createTask('takeout', { chatIds: ['x'] }, eventaCtx, logger)

    task.abort()

    expect(task.state.abortController.signal.aborted).toBe(true)
    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('Task aborted')

    // abort internally calls updateError, which emits once
    expect(emitSpy).toHaveBeenCalledTimes(1)
  })

  it('should not emit takeout progress events for non-takeout task types', () => {
    const eventaCtx = createContext()
    const emitSpy = vi.spyOn(eventaCtx, 'emit')

    const task = createTask('embed', undefined, eventaCtx, logger)
    task.updateProgress(1)

    expect(emitSpy).not.toHaveBeenCalled()
  })
})
