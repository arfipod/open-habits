import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:open-habits-test'),
    configurable: true
  })
}

if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true
  })
}

Object.defineProperty(HTMLAnchorElement.prototype, 'click', {
  value: vi.fn(),
  configurable: true
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
