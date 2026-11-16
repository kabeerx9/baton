import { KeyboardIcon, ListTreeIcon, ScanTextIcon } from "lucide-react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import type { PageProps } from "../../page-props";
import { DetailsPanel } from "./details-panel";
import { FlowList } from "./flow-list";
import { KeysPanel } from "./keys-panel";

const TAB =
  "grid size-9 place-items-center rounded-md text-muted-foreground data-[selected]:text-foreground aria-selected:text-foreground";

/**
 * The context rail. A vertical tab list: the arrow keys here are up and down,
 * so they never meet the picker's left and right.
 */
export function ConsoleRail(props: PageProps) {
  return (
    <Tabs
      defaultValue="flow"
      orientation="vertical"
      className="flex-row gap-3 p-3"
    >
      <TabsList className="h-fit flex-col bg-transparent p-0">
        <TabsTab value="flow" aria-label="Flow" className={TAB}>
          <ListTreeIcon className="size-4" aria-hidden="true" />
        </TabsTab>
        <TabsTab value="details" aria-label="Details" className={TAB}>
          <ScanTextIcon className="size-4" aria-hidden="true" />
        </TabsTab>
        <TabsTab value="keys" aria-label="Keys" className={TAB}>
          <KeyboardIcon className="size-4" aria-hidden="true" />
        </TabsTab>
      </TabsList>
      <div className="min-w-0 flex-1">
        <TabsPanel value="flow">
          <FlowList {...props} />
        </TabsPanel>
        <TabsPanel value="details">
          <DetailsPanel {...props} />
        </TabsPanel>
        <TabsPanel value="keys">
          <KeysPanel />
        </TabsPanel>
      </div>
    </Tabs>
  );
}
