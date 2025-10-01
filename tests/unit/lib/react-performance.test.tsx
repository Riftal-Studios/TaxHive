import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React, { useState, useEffect } from 'react'
import {
  deepCompareProps,
  shallowCompareProps,
  withMemo,
  useEnhancedMemo,
  useStableCallback,
  withPerformanceMonitoring,
  createMemoizedListItem,
  useDebouncedValue,
  useRenderTracker,
} from '@/lib/react-performance'

describe('React Performance Utilities', () => {
  let originalEnv: NodeJS.ProcessEnv
  let consoleDebugSpy: any
  let consoleWarnSpy: any

  beforeEach(() => {
    originalEnv = process.env
    process.env = { ...originalEnv, NODE_ENV: 'development' }
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env = originalEnv
    consoleDebugSpy.mockRestore()
    consoleWarnSpy.mockRestore()
  })

  describe('deepCompareProps', () => {
    it('should return true for identical props', () => {
      const props1 = { name: 'John', age: 30, data: { id: 1 } }
      const props2 = { name: 'John', age: 30, data: { id: 1 } }
      
      expect(deepCompareProps(props1, props2)).toBe(true)
    })

    it('should return false for different primitive values', () => {
      const props1 = { name: 'John', age: 30 }
      const props2 = { name: 'Jane', age: 30 }
      
      expect(deepCompareProps(props1, props2)).toBe(false)
    })

    it('should perform deep comparison for objects', () => {
      const props1 = { data: { user: { name: 'John', age: 30 } } }
      const props2 = { data: { user: { name: 'John', age: 30 } } }
      const props3 = { data: { user: { name: 'Jane', age: 30 } } }
      
      expect(deepCompareProps(props1, props2)).toBe(true)
      expect(deepCompareProps(props1, props3)).toBe(false)
    })

    it('should handle arrays in deep comparison', () => {
      const props1 = { items: [1, 2, { id: 3 }] }
      const props2 = { items: [1, 2, { id: 3 }] }
      const props3 = { items: [1, 2, { id: 4 }] }
      
      expect(deepCompareProps(props1, props2)).toBe(true)
      expect(deepCompareProps(props1, props3)).toBe(false)
    })

    it('should treat functions with same reference as equal', () => {
      const fn = () => {}
      const props1 = { onClick: fn }
      const props2 = { onClick: fn }
      
      expect(deepCompareProps(props1, props2)).toBe(true)
    })

    it('should treat functions with different references as not equal', () => {
      const props1 = { onClick: () => {} }
      const props2 = { onClick: () => {} }
      
      expect(deepCompareProps(props1, props2)).toBe(false)
    })

    it('should handle null and undefined values', () => {
      const props1 = { value: null, other: undefined }
      const props2 = { value: null, other: undefined }
      const props3 = { value: undefined, other: null }
      
      expect(deepCompareProps(props1, props2)).toBe(true)
      expect(deepCompareProps(props1, props3)).toBe(false)
    })

    it('should return false for different number of keys', () => {
      const props1 = { a: 1, b: 2 }
      const props2 = { a: 1, b: 2, c: 3 }
      
      expect(deepCompareProps(props1, props2)).toBe(false)
    })
  })

  describe('shallowCompareProps', () => {
    it('should return true for identical props', () => {
      const obj = { id: 1 }
      const props1 = { name: 'John', data: obj }
      const props2 = { name: 'John', data: obj }
      
      expect(shallowCompareProps(props1, props2)).toBe(true)
    })

    it('should return false for different references', () => {
      const props1 = { data: { id: 1 } }
      const props2 = { data: { id: 1 } }
      
      expect(shallowCompareProps(props1, props2)).toBe(false)
    })

    it('should only check top-level properties', () => {
      const data = { nested: { value: 1 } }
      const props1 = { name: 'John', data }
      const props2 = { name: 'John', data }
      
      expect(shallowCompareProps(props1, props2)).toBe(true)
      
      data.nested.value = 2 // Mutate nested value
      expect(shallowCompareProps(props1, props2)).toBe(true) // Still true because reference is same
    })
  })

  describe('withMemo', () => {
    it('should memoize component with default deep comparison', () => {
      let renderCount = 0
      
      const TestComponent: React.FC<{ data: any }> = ({ data }) => {
        renderCount++
        return <div>{data.value}</div>
      }
      
      const MemoizedComponent = withMemo(TestComponent)
      
      const { rerender } = render(<MemoizedComponent data={{ value: 1 }} />)
      expect(renderCount).toBe(1)
      
      // Same data structure, should not re-render
      rerender(<MemoizedComponent data={{ value: 1 }} />)
      expect(renderCount).toBe(1)
      
      // Different data, should re-render
      rerender(<MemoizedComponent data={{ value: 2 }} />)
      expect(renderCount).toBe(2)
    })

    it('should use custom comparison function when provided', () => {
      let renderCount = 0
      
      const TestComponent: React.FC<{ count: number }> = ({ count }) => {
        renderCount++
        return <div>{count}</div>
      }
      
      // Only re-render if count changes by more than 5
      const customCompare = (prev: any, next: any) => 
        Math.abs(prev.count - next.count) <= 5
      
      const MemoizedComponent = withMemo(TestComponent, customCompare)
      
      const { rerender } = render(<MemoizedComponent count={1} />)
      expect(renderCount).toBe(1)
      
      // Small change, should not re-render
      rerender(<MemoizedComponent count={3} />)
      expect(renderCount).toBe(1)
      
      // Large change, should re-render
      rerender(<MemoizedComponent count={10} />)
      expect(renderCount).toBe(2)
    })
  })

  describe('useEnhancedMemo', () => {
    it('should memoize expensive computations', () => {
      let computationCount = 0
      
      function TestComponent({ value }: { value: number }) {
        const result = useEnhancedMemo(() => {
          computationCount++
          return value * 2
        }, [value])
        
        return <div>{result}</div>
      }
      
      const { rerender } = render(<TestComponent value={5} />)
      expect(screen.getByText('10')).toBeInTheDocument()
      expect(computationCount).toBe(1)
      
      // Same value, should not recompute
      rerender(<TestComponent value={5} />)
      expect(computationCount).toBe(1)
      
      // Different value, should recompute
      rerender(<TestComponent value={10} />)
      expect(screen.getByText('20')).toBeInTheDocument()
      expect(computationCount).toBe(2)
    })

    it('should log debug info in development with debugName', () => {
      function TestComponent({ value }: { value: number }) {
        const result = useEnhancedMemo(
          () => value * 2,
          [value],
          'expensiveCalculation'
        )
        return <div>{result}</div>
      }
      
      render(<TestComponent value={5} />)
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        expect.stringContaining('[useEnhancedMemo] expensiveCalculation')
      )
    })
  })

  describe('useStableCallback', () => {
    it('should maintain callback reference when deps do not change', () => {
      let callbackRef1: any
      let callbackRef2: any
      
      function TestComponent({ multiplier }: { multiplier: number }) {
        const callback = useStableCallback(
          (value: number) => value * multiplier,
          [multiplier]
        )
        
        if (!callbackRef1) {
          callbackRef1 = callback
        } else {
          callbackRef2 = callback
        }
        
        return <button onClick={() => callback(5)}>Click</button>
      }
      
      const { rerender } = render(<TestComponent multiplier={2} />)
      rerender(<TestComponent multiplier={2} />)
      
      expect(callbackRef1).toBe(callbackRef2)
    })

    it('should update callback when dependencies change', () => {
      let callbackRef1: any
      let callbackRef2: any
      
      function TestComponent({ multiplier }: { multiplier: number }) {
        const callback = useStableCallback(
          (value: number) => value * multiplier,
          [multiplier]
        )
        
        if (!callbackRef1) {
          callbackRef1 = callback
        } else {
          callbackRef2 = callback
        }
        
        return <button onClick={() => callback(5)}>Click</button>
      }
      
      const { rerender } = render(<TestComponent multiplier={2} />)
      rerender(<TestComponent multiplier={3} />)
      
      expect(callbackRef1).not.toBe(callbackRef2)
    })
  })

  describe('withPerformanceMonitoring', () => {
    it('should monitor component render time', () => {
      const TestComponent: React.FC<{ value: number }> = ({ value }) => {
        return <div>{value}</div>
      }
      
      const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'TestComponent')
      
      render(<MonitoredComponent value={1} />)
      
      // Should not warn for fast renders
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should warn about slow renders', () => {
      vi.spyOn(performance, 'now')
        .mockReturnValueOnce(0)    // First call for render start
        .mockReturnValueOnce(20)   // Second call for render end (20ms render)
      
      const TestComponent: React.FC = () => {
        // Simulate slow render
        return <div>Slow component</div>
      }
      
      const MonitoredComponent = withPerformanceMonitoring(TestComponent, 'SlowComponent')
      
      render(<MonitoredComponent />)
      
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Performance] SlowComponent slow render')
      )
    })
  })

  describe('createMemoizedListItem', () => {
    it('should memoize list items efficiently', () => {
      let renderCount = 0
      
      interface Item {
        id: string
        name: string
      }
      
      const ItemComponent: React.FC<{ item: Item; index: number }> = ({ item }) => {
        renderCount++
        return <div>{item.name}</div>
      }
      
      const MemoizedItem = createMemoizedListItem(
        ItemComponent,
        (item: Item) => item.id
      )
      
      const items = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ]
      
      function List() {
        return (
          <div>
            {items.map((item, index) => (
              <MemoizedItem key={item.id} item={item} index={index} />
            ))}
          </div>
        )
      }
      
      const { rerender } = render(<List />)
      expect(renderCount).toBe(2)
      
      // Re-render with same items
      rerender(<List />)
      expect(renderCount).toBe(2) // Should not increase
      
      // Update one item
      items[0] = { id: '1', name: 'Updated Item 1' }
      rerender(<List />)
      expect(renderCount).toBe(3) // Only one item re-rendered
    })
  })

  describe('useDebouncedValue', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should debounce value updates', async () => {
      function TestComponent() {
        const [input, setInput] = useState('initial')
        const debouncedValue = useDebouncedValue(input, 500)
        
        return (
          <div>
            <input 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              data-testid="input"
            />
            <div data-testid="debounced">{debouncedValue}</div>
          </div>
        )
      }
      
      const { getByTestId } = render(<TestComponent />)
      
      expect(getByTestId('debounced')).toHaveTextContent('initial')
      
      // Type quickly
      const input = getByTestId('input') as HTMLInputElement
      input.value = 'updated'
      input.dispatchEvent(new Event('change', { bubbles: true }))
      
      // Immediately after change, debounced value should not update
      expect(getByTestId('debounced')).toHaveTextContent('initial')
      
      // Wait for debounce delay
      vi.advanceTimersByTime(500)
      
      await waitFor(() => {
        expect(getByTestId('debounced')).toHaveTextContent('updated')
      })
    })

    it('should cancel previous timeouts on rapid changes', async () => {
      function TestComponent() {
        const [input, setInput] = useState('a')
        const debouncedValue = useDebouncedValue(input, 300)
        
        return (
          <div>
            <button onClick={() => setInput(input + 'a')}>Add</button>
            <div data-testid="debounced">{debouncedValue}</div>
          </div>
        )
      }
      
      const { getByTestId, getByText } = render(<TestComponent />)
      const button = getByText('Add')
      
      // Make rapid changes
      button.click() // 'aa'
      vi.advanceTimersByTime(100)
      button.click() // 'aaa'
      vi.advanceTimersByTime(100)
      button.click() // 'aaaa'
      
      // Previous timeouts should be cancelled
      expect(getByTestId('debounced')).toHaveTextContent('a')
      
      // Wait for final debounce
      vi.advanceTimersByTime(300)
      
      await waitFor(() => {
        expect(getByTestId('debounced')).toHaveTextContent('aaaa')
      })
    })
  })

  describe('useRenderTracker', () => {
    it('should track prop changes that cause re-renders', () => {
      function TestComponent({ value, other }: { value: number; other: string }) {
        useRenderTracker('TestComponent', { value, other })
        return <div>{value}</div>
      }
      
      const { rerender } = render(<TestComponent value={1} other="a" />)
      
      // First render, no previous props
      expect(consoleDebugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[RenderTracker]')
      )
      
      // Change value prop
      rerender(<TestComponent value={2} other="a" />)
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[RenderTracker] TestComponent re-rendered due to:',
        ['value']
      )
      
      consoleDebugSpy.mockClear()
      
      // Change both props
      rerender(<TestComponent value={3} other="b" />)
      
      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[RenderTracker] TestComponent re-rendered due to:',
        ['value', 'other']
      )
    })

    it('should not log in production environment', () => {
      process.env.NODE_ENV = 'production'
      
      function TestComponent({ value }: { value: number }) {
        useRenderTracker('TestComponent', { value })
        return <div>{value}</div>
      }
      
      const { rerender } = render(<TestComponent value={1} />)
      rerender(<TestComponent value={2} />)
      
      expect(consoleDebugSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('[RenderTracker]')
      )
    })
  })
})