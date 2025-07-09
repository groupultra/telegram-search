import { describe, expect, it } from 'vitest'

import { Err, Ok } from '.'

describe('utils/monad', () => {
  it('works in sync', () => {
    function testOk() {
      return Ok(1)
    }

    function testErr() {
      return Err(new Error('test'))
    }

    let notError = true
    try {
      testOk()
    }
    catch {
      notError = false
    }

    expect(notError).toBe(true)

    let error = false
    try {
      testErr().expect('expect error occurred')
    }
    catch (err) {
      console.error(err)
      error = true
    }

    expect(error).toBe(true)
  })

  it('works in async', async () => {
    async function testOk() {
      return Ok(1)
    }

    async function testErr() {
      return Err(new Error('async test'))
    }

    let notError = true
    try {
      await testOk()
    }
    catch {
      notError = false
    }

    expect(notError).toBe(true)

    let error = false
    try {
      (await testErr()).expect('expect async error occurred')
    }
    catch (err) {
      console.error(err)
      error = true
    }

    expect(error).toBe(true)
  })
})
