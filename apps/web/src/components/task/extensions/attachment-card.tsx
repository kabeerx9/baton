import {
  AttachmentCard as AttachmentCardNode,
  isValidUrl,
} from "@baton/editor";
import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import { FileText } from "lucide-react";

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function AttachmentCardView({ node }: NodeViewProps) {
  const rawUrl = String(node.attrs.url || "");
  const url = isValidUrl(rawUrl) ? rawUrl : "";
  const filename = String(node.attrs.filename || "Attachment");
  const mimeType = String(node.attrs.mimeType || "");
  const size = Number(node.attrs.size || 0);

  return (
    <NodeViewWrapper as="span" className="baton-attachment-node">
      <a
        href={url || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="baton-attachment-card"
        title={filename}
      >
        <span className="baton-attachment-card-icon">
          <FileText className="size-4" />
        </span>
        <span className="baton-attachment-card-content">
          <span className="baton-attachment-card-title">{filename}</span>
          <span className="baton-attachment-card-meta">
            {formatBytes(size)}
            {mimeType ? ` · ${mimeType}` : ""}
          </span>
        </span>
      </a>
    </NodeViewWrapper>
  );
}

export const AttachmentCard = AttachmentCardNode.extend({
  addNodeView() {
    return ReactNodeViewRenderer(AttachmentCardView);
  },
});
