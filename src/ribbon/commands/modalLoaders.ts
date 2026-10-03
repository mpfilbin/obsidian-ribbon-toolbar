import type { App } from "obsidian";
import type { EditorLike } from "./actions/types";

// Modals are imported on demand so the command definitions don't depend on
// modal code (and through it the Obsidian runtime) just by being loaded.
export function openCallout(editor: EditorLike, app: App): void {
  void import("./actions/calloutModal")
    .then((module) => module.openCalloutModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open callout modal", error));
}

export function openExternalLink(editor: EditorLike, app: App): void {
  void import("./actions/externalLinkModal")
    .then((module) => module.openExternalLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open external link modal", error));
}

export function openInternalLink(editor: EditorLike, app: App): void {
  void import("./actions/linkModal")
    .then((module) => module.openLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open internal link modal", error));
}

export function openEmbed(editor: EditorLike, app: App): void {
  void import("./actions/embedModal")
    .then((module) => module.openEmbedModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open embed modal", error));
}

export function openFootnote(editor: EditorLike, app: App): void {
  void import("./actions/footnoteModal")
    .then((module) => module.openFootnoteModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open footnote modal", error));
}

export function openHeadingLink(editor: EditorLike, app: App): void {
  void import("./actions/headingLinkModal")
    .then((module) => module.openHeadingLinkModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open heading link modal", error));
}
