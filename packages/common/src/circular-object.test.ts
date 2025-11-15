import { describe, expect, it } from 'vitest'

import { circularObject, circularStringify } from './circular-object'

describe('circular-object', () => {
  describe('circularStringify', () => {
    it('should stringify simple object with primitive properties', () => {
      const obj = {
        name: 'test',
        age: 25,
        active: true,
      }
      const result = circularStringify(obj)
      expect(result).toBe('{"name":"test","age":25,"active":true}')
    })

    it('should exclude nested objects', () => {
      const obj = {
        name: 'test',
        nested: { value: 'should be excluded' },
        age: 25,
      }
      const result = circularStringify(obj)
      expect(result).toBe('{"name":"test","age":25}')
    })

    it('should exclude functions', () => {
      const obj = {
        name: 'test',
        method: () => 'should be excluded',
        age: 25,
      }
      const result = circularStringify(obj)
      expect(result).toBe('{"name":"test","age":25}')
    })

    it('should exclude properties from prototype chain', () => {
      function Parent(this: any) {
        this.parentProp = 'parent'
      }
      Parent.prototype.inheritedProp = 'inherited'

      function Child(this: any) {
        Parent.call(this)
        this.childProp = 'child'
      }
      Child.prototype = Object.create(Parent.prototype)

      const obj = new (Child as any)()
      const result = circularStringify(obj)
      expect(result).toBe('{"parentProp":"parent","childProp":"child"}')
    })

    it('should handle empty object', () => {
      const obj = {}
      const result = circularStringify(obj)
      expect(result).toBe('{}')
    })

    it('should handle object with only nested objects and functions', () => {
      const obj = {
        nested: { value: 'excluded' },
        func: () => 'excluded',
      }
      const result = circularStringify(obj)
      expect(result).toBe('{}')
    })

    it('should exclude null values (treated as objects)', () => {
      const obj = {
        name: 'test',
        value: null,
      }
      const result = circularStringify(obj)
      // null is typeof 'object', so it gets filtered out
      expect(result).toBe('{"name":"test"}')
    })

    it('should handle object with undefined values', () => {
      const obj = {
        name: 'test',
        value: undefined,
      }
      const result = circularStringify(obj)
      expect(result).toBe('{"name":"test"}')
    })
  })

  describe('circularObject', () => {
    it('should return parsed object with primitive properties', () => {
      const obj = {
        name: 'test',
        age: 25,
        active: true,
      }
      const result = circularObject(obj)
      expect(result).toEqual({ name: 'test', age: 25, active: true })
    })

    it('should exclude nested objects and functions', () => {
      const obj = {
        name: 'test',
        nested: { value: 'should be excluded' },
        method: () => 'should be excluded',
        age: 25,
      }
      const result = circularObject(obj)
      expect(result).toEqual({ name: 'test', age: 25 })
    })

    it('should return empty object for empty input', () => {
      const obj = {}
      const result = circularObject(obj)
      expect(result).toEqual({})
    })

    it('should exclude null values (treated as objects)', () => {
      const obj = {
        name: 'test',
        value: null,
      }
      const result = circularObject(obj)
      // null is typeof 'object', so it gets filtered out
      expect(result).toEqual({ name: 'test' })
    })
  })
})
