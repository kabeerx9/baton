// The session splash and the router's first pending screen are two screens
// for one wait. If the first one showed, the second must start at once, or
// the page blinks blank for the router's 300ms delay in between.
let shown = false;

export function markBootSplashShown() {
  shown = true;
}

export function takeBootSplashShown() {
  const wasShown = shown;
  shown = false;
  return wasShown;
}
