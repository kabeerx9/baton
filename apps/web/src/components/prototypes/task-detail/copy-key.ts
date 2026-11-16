import { toastManager } from "@/components/ui/toast-manager";

export function copyKey(key: string) {
  void navigator.clipboard?.writeText(key).catch(() => undefined);
  toastManager.add({ title: `Copied ${key}`, type: "success" });
}
