"use client";

import React from "react";
import { CircleHelp } from "lucide-react";
import { useTutorial } from "@/context/TutorialContext";
import { useTranslation } from "@/context/I18nContext";

export function TutorialButton(): React.ReactElement {
  const { startTutorial } = useTutorial();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      className="rs-a11y-button"
      aria-label={t("tutorial.buttonLabel")}
      title={t("tutorial.buttonLabel")}
      onClick={startTutorial}
    >
      <CircleHelp size={28} color="var(--a11y-icon-color)" strokeWidth={1.5} />
    </button>
  );
}
