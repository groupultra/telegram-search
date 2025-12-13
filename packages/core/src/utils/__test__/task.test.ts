import type { MockedFunction } from 'vitest'

import type { CoreEmitter } from '../../context'

import { describe, expect, it, vi } from 'vitest'

import { createTask } from '../task'

describe('utils/task - createTask', () => {
  it('should emit takeout:task:progress on updateProgress for takeout task', () => {
    const emitter = { emit: vi.fn() } as unknown as CoreEmitter

    const task = createTask('takeout', { chatIds: ['1', '2'] }, emitter)

    task.updateProgress(10, 'hello')

    expect(emitter.emit).toHaveBeenCalledTimes(1)
    expect(emitter.emit).toHaveBeenCalledWith(
      'takeout:task:progress',
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
    const payload = (emitter.emit as MockedFunction<typeof emitter.emit>).mock.calls[0][1]
    expect(payload).not.toHaveProperty('abortController')
  })

  it('should set progress=-1 and emit on updateError for takeout task', () => {
    const emitter = { emit: vi.fn() } as unknown as CoreEmitter

    const task = createTask('takeout', { chatIds: ['x'] }, emitter)

    task.updateError(new Error('boom'))

    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('boom')

    expect(emitter.emit).toHaveBeenCalledTimes(1)
    expect(emitter.emit).toHaveBeenCalledWith(
      'takeout:task:progress',
      expect.objectContaining({
        type: 'takeout',
        progress: -1,
        lastError: 'boom',
      }),
    )
  })

  it('abort should abort signal and set error', () => {
    const emitter = { emit: vi.fn() } as unknown as CoreEmitter

    const task = createTask('takeout', { chatIds: ['x'] }, emitter)

    task.abort()

    expect(task.state.abortController.signal.aborted).toBe(true)
    expect(task.state.progress).toBe(-1)
    expect(task.state.lastError).toBe('Task aborted')

    // abort internally calls updateError, which emits once
    expect(emitter.emit).toHaveBeenCalledTimes(1)
  })

  it('should not emit takeout progress events for non-takeout task types', () => {
    const emitter = { emit: vi.fn() } as unknown as CoreEmitter

    const task = createTask('embed', undefined, emitter)
    task.updateProgress(1)

    expect(emitter.emit).not.toHaveBeenCalled()
  })
})
