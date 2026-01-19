import { useState } from "react";

export default function useParameterModals() {
  // Modal state for HTML editor
  const [isHtmlModalOpen, setIsHtmlModalOpen] = useState(false);
  const [currentHtmlKey, setCurrentHtmlKey] = useState<string>("");

  // Modal state for Button editor
  const [isButtonModalOpen, setIsButtonModalOpen] = useState(false);
  const [currentButtonKey, setCurrentButtonKey] = useState<string>("");

  // Modal state for Survey builder
  const [isSurveyModalOpen, setIsSurveyModalOpen] = useState(false);
  const [currentSurveyKey, setCurrentSurveyKey] = useState<string>("");

  const openHtmlModal = (key: string) => {
    setCurrentHtmlKey(key);
    setIsHtmlModalOpen(true);
  };

  const closeHtmlModal = () => {
    setIsHtmlModalOpen(false);
    setCurrentHtmlKey("");
  };

  const openButtonModal = (key: string) => {
    setCurrentButtonKey(key);
    setIsButtonModalOpen(true);
  };

  const closeButtonModal = () => {
    setIsButtonModalOpen(false);
    setCurrentButtonKey("");
  };

  const openSurveyModal = (key: string) => {
    setCurrentSurveyKey(key);
    setIsSurveyModalOpen(true);
  };

  const closeSurveyModal = () => {
    setIsSurveyModalOpen(false);
    setCurrentSurveyKey("");
  };
  return {
    isHtmlModalOpen,
    currentHtmlKey,
    openHtmlModal,
    closeHtmlModal,
    isButtonModalOpen,
    currentButtonKey,
    openButtonModal,
    closeButtonModal,
    isSurveyModalOpen,
    currentSurveyKey,
    openSurveyModal,
    closeSurveyModal,
  };
}
