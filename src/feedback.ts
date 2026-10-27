/** A tap should feel like it landed: a short vibration on a phone, and a screen flash on a desktop. */
export function ackTap() {
  try { navigator.vibrate?.(16) } catch { /* some browsers throw if vibration is blocked */ }
  const root = document.documentElement
  root.classList.remove('add-flash')
  void root.offsetWidth
  root.classList.add('add-flash')
  window.setTimeout(() => root.classList.remove('add-flash'), 220)
}
