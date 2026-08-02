"use client";

import dynamic from "next/dynamic";
import { forwardRef } from "react";
import type { MDXEditorMethods, MDXEditorProps } from "@mdxeditor/editor";

const Ed = dynamic(() => import("./InitializedMDXEditor"), { ssr: false });

// SSR-safe forwardRef wrapper so pages can use <Editor markdown=... onChange=... />
export const Editor = forwardRef<MDXEditorMethods, MDXEditorProps>((props, ref) => (
  <Ed {...props} editorRef={ref} />
));
Editor.displayName = "Editor";
