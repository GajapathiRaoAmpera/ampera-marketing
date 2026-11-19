"use client";

import { createContext, useContext } from "react";

/**
 * True inside a workspace tab. A screen that used to be a whole page hides its own title block
 * there, because the workspace's header and the tab's one-line intro already say what it is.
 */
const EmbeddedContext = createContext(false);

export const EmbeddedProvider = EmbeddedContext.Provider;

export function useEmbedded(): boolean {
  return useContext(EmbeddedContext);
}
