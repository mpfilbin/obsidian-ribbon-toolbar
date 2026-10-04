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

export function openAddProperty(editor: EditorLike, app: App): void {
  void import("./actions/propertyModal")
    .then((module) => module.openAddPropertyModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open add property modal", error));
}

// ---- Bases tab. The base editors pull in the Obsidian runtime, so they load on demand too.

export function openNewBase(editor: EditorLike, app: App): void {
  void import("../bases/ui/NewBaseModal")
    .then((module) => module.openNewBaseModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open new base modal", error));
}

export function openEmbedBase(editor: EditorLike, app: App): void {
  void import("../bases/ui/EmbedBaseModal")
    .then((module) => module.openEmbedBaseModal(editor, app))
    .catch((error) => console.error("Ribbon Bar: failed to open embed base modal", error));
}

/** Opens the base editor on one of its sections (views, filters, formulas, …). */
export function openBaseSection(section: "views" | "filters" | "formulas" | "properties" | "summaries") {
  return (editor: EditorLike, app: App): void => {
    void import("../bases/ui/BaseManagerModal")
      .then((module) => module.openBaseManager(editor, app, section))
      .catch((error) => console.error("Ribbon Bar: failed to open base editor", error));
  };
}

export function addBaseView(type: string) {
  return (editor: EditorLike, app: App): void => {
    void import("../bases/quickActions")
      .then((module) => module.addBaseView(type)(editor, app))
      .catch((error) => console.error("Ribbon Bar: failed to add a base view", error));
  };
}

export function addBaseQuickFilter(id: string) {
  return (editor: EditorLike, app: App): void => {
    void import("../bases/quickActions")
      .then((module) => {
        const quick = module.quickFilterSpecs().find((q) => q.id === id);
        if (quick) module.addBaseFilter(quick.specFor)(editor, app);
      })
      .catch((error) => console.error("Ribbon Bar: failed to add a base filter", error));
  };
}
