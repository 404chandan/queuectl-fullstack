export function backoffDelay(base, attempts) {
  // delay in seconds: base ^ attempts
  return Math.pow(base, attempts);
}