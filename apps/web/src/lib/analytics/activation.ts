import { isTrackingEnabled, track } from "./track";

const SIGNUP_KEY = "baton:tracked-signup:";
const FIRST_TASK_KEY = "baton:first-task-pending";

export function trackSignup(user: { id: string }) {
  if (!isTrackingEnabled()) return;
  try {
    if (localStorage.getItem(SIGNUP_KEY + user.id)) return;
    localStorage.setItem(SIGNUP_KEY + user.id, "1");
    localStorage.setItem(FIRST_TASK_KEY, "1");
  } catch {
    return;
  }
  track("Signup");
}

export function trackFirstTask() {
  if (!isTrackingEnabled()) return;
  try {
    if (!localStorage.getItem(FIRST_TASK_KEY)) return;
    localStorage.removeItem(FIRST_TASK_KEY);
  } catch {
    return;
  }
  track("First Task");
}
