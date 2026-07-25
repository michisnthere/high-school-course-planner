"use client";

import { useState, useCallback } from "react";

export function useSearchSubmit(initialValue = "") {
  const [draft, setDraft] = useState(initialValue);
  const [submitted, setSubmitted] = useState(initialValue);

  const hasChanged = draft !== submitted;

  const submit = useCallback(() => {
    setSubmitted(draft);
  }, [draft]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      }
    },
    [submit]
  );

  const clearDraft = useCallback(() => {
    setDraft("");
  }, []);

  const clearAll = useCallback(() => {
    setDraft("");
    setSubmitted("");
  }, []);

  return { draft, setDraft, submitted, hasChanged, submit, handleKeyDown, clearDraft, clearAll };
}
