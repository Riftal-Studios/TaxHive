/**
 * React Performance Optimization Utilities
 * 
 * Provides utilities for optimizing React component performance,
 * including memoization helpers and performance monitoring.
 */

import React, { memo, useMemo, useCallback, useRef, useEffect } from 'react';

/**
 * Deep comparison function for React.memo
 * Performs a deep equality check on props
 */
export function deepCompareProps<T extends Record<string, any>>(
  prevProps: T,
  nextProps: T
): boolean {
  const keys1 = Object.keys(prevProps);
  const keys2 = Object.keys(nextProps);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    const val1 = prevProps[key];
    const val2 = nextProps[key];

    // Handle functions - assume they don't change if reference is same
    if (typeof val1 === 'function' && typeof val2 === 'function') {
      if (val1 !== val2) return false;
      continue;
    }

    // Handle objects and arrays
    if (typeof val1 === 'object' && typeof val2 === 'object') {
      if (val1 === null || val2 === null) {
        if (val1 !== val2) return false;
        continue;
      }
      
      // Use JSON.stringify for deep comparison (not perfect but practical)
      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        return false;
      }
      continue;
    }

    // Primitive comparison
    if (val1 !== val2) {
      return false;
    }
  }

  return true;
}

/**
 * Shallow comparison function for React.memo
 * Only checks top-level props
 */
export function shallowCompareProps<T extends Record<string, any>>(
  prevProps: T,
  nextProps: T
): boolean {
  const keys1 = Object.keys(prevProps);
  const keys2 = Object.keys(nextProps);

  if (keys1.length !== keys2.length) {
    return false;
  }

  for (const key of keys1) {
    if (prevProps[key] !== nextProps[key]) {
      return false;
    }
  }

  return true;
}

/**
 * Higher-order component for automatic memoization
 * Wraps a component with React.memo and optional custom comparison
 */
export function withMemo<P extends object>(
  Component: React.ComponentType<P>,
  compareFunction?: (prevProps: P, nextProps: P) => boolean
): React.MemoExoticComponent<React.ComponentType<P>> {
  return memo(Component, compareFunction || deepCompareProps);
}

/**
 * Hook for memoizing expensive computations
 * Enhanced version of useMemo with dependency tracking
 */
export function useEnhancedMemo<T>(
  factory: () => T,
  deps: React.DependencyList,
  debugName?: string
): T {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current++;
    if (process.env.NODE_ENV === 'development' && debugName) {
      console.debug(`[useEnhancedMemo] ${debugName} recalculated (render #${renderCount.current})`);
    }
  }, deps);

  return useMemo(factory, deps);
}

/**
 * Hook for creating stable callbacks
 * Enhanced version of useCallback with performance tracking
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList,
  debugName?: string
): T {
  const renderCount = useRef(0);
  
  useEffect(() => {
    renderCount.current++;
    if (process.env.NODE_ENV === 'development' && debugName) {
      console.debug(`[useStableCallback] ${debugName} recreated (render #${renderCount.current})`);
    }
  }, deps);

  return useCallback(callback, deps) as T;
}

/**
 * Performance monitoring component wrapper
 * Tracks render times and re-render frequency
 */
export function withPerformanceMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return function PerformanceMonitoredComponent(props: P) {
    const renderCount = useRef(0);
    const renderStartTime = useRef(performance.now());

    useEffect(() => {
      renderCount.current++;
      const renderTime = performance.now() - renderStartTime.current;
      
      if (process.env.NODE_ENV === 'development') {
        if (renderTime > 16) { // More than one frame (60fps)
          console.warn(
            `[Performance] ${componentName} slow render: ${renderTime.toFixed(2)}ms (render #${renderCount.current})`
          );
        }
      }
      
      renderStartTime.current = performance.now();
    });

    return <Component {...props} />;
  };
}

/**
 * List item memoization helper
 * Optimizes list rendering by memoizing individual items
 */
export function createMemoizedListItem<T, P extends { item: T; index: number }>(
  ItemComponent: React.ComponentType<P>,
  getKey: (item: T, index: number) => string
): React.MemoExoticComponent<React.ComponentType<P>> {
  return memo(ItemComponent, (prevProps, nextProps) => {
    // Compare items by key and index
    const prevKey = getKey(prevProps.item, prevProps.index);
    const nextKey = getKey(nextProps.item, nextProps.index);
    
    return prevKey === nextKey && 
           prevProps.index === nextProps.index &&
           JSON.stringify(prevProps.item) === JSON.stringify(nextProps.item);
  });
}

/**
 * Debounced value hook
 * Delays value updates to prevent excessive re-renders
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Component render tracker
 * Logs when and why a component re-renders
 */
export function useRenderTracker(componentName: string, props: Record<string, any>) {
  const prevPropsRef = useRef<Record<string, any>>();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (prevPropsRef.current) {
        const changedProps = Object.entries(props).filter(
          ([key, val]) => prevPropsRef.current![key] !== val
        );
        
        if (changedProps.length > 0) {
          console.debug(
            `[RenderTracker] ${componentName} re-rendered due to:`,
            changedProps.map(([key]) => key)
          );
        }
      }
      
      prevPropsRef.current = props;
    }
  });
}