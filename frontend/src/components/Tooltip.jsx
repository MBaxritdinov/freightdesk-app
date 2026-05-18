import { useState, useRef } from 'react'

export default function Tooltip({ children, text, position = 'top', className = '' }) {
  const [visible, setVisible] = useState(false)
  const [rect, setRect] = useState(null)
  const ref = useRef(null)
  const timer = useRef(null)

  function show() {
    if (ref.current) setRect(ref.current.getBoundingClientRect())
    timer.current = setTimeout(() => setVisible(true), 300)
  }
  function hide() { clearTimeout(timer.current); setVisible(false) }

  function getStyle() {
    if (!rect) return { position: 'fixed', top: -9999, left: -9999 }
    const gap = 6
    const base = { position: 'fixed', zIndex: 9999, pointerEvents: 'none' }
    if (position === 'bottom') return { ...base, top: rect.bottom + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
    if (position === 'left')   return { ...base, top: rect.top + rect.height / 2, left: rect.left - gap, transform: 'translate(-100%, -50%)' }
    if (position === 'right')  return { ...base, top: rect.top + rect.height / 2, left: rect.right + gap, transform: 'translateY(-50%)' }
    return { ...base, top: rect.top - gap, left: rect.left + rect.width / 2, transform: 'translate(-50%, -100%)' }
  }

  return (
    <span ref={ref} className={`inline-flex ${className}`} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      <span
        style={getStyle()}
        className={`whitespace-nowrap bg-slate-800 ring-1 ring-white/10 text-xs text-slate-300 px-2 py-1 rounded-lg shadow-xl transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}
      >
        {text}
      </span>
    </span>
  )
}
