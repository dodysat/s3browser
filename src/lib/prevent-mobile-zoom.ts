export function preventMobileZoom() {
  const preventDefault = (event: Event) => {
    event.preventDefault()
  }

  const preventMultiTouch = (event: TouchEvent) => {
    if (event.touches.length > 1) {
      event.preventDefault()
    }
  }

  let lastTouchEnd = 0
  const preventDoubleTapZoom = (event: TouchEvent) => {
    const now = Date.now()

    if (now - lastTouchEnd <= 300) {
      event.preventDefault()
    }

    lastTouchEnd = now
  }

  const preventTrackpadZoom = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
    }
  }

  document.addEventListener("gesturestart", preventDefault, { passive: false })
  document.addEventListener("gesturechange", preventDefault, { passive: false })
  document.addEventListener("gestureend", preventDefault, { passive: false })
  document.addEventListener("touchmove", preventMultiTouch, { passive: false })
  document.addEventListener("touchend", preventDoubleTapZoom, { passive: false })
  document.addEventListener("wheel", preventTrackpadZoom, { passive: false })
}

