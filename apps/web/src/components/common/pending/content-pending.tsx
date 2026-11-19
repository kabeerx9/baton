import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import "./pending.css";

/**
 * Pending screen for a route inside an app shell: a small spinner in the
 * content pane. The router has already waited 300ms and holds it 500ms.
 */
export function ContentPending() {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-48 items-center justify-center">
      <Spinner
        aria-label={t("common:empty.loading")}
        className="pending-fade-in size-5 text-muted-foreground"
      />
    </div>
  );
}
