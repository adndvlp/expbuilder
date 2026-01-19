export type UploadedFile = { name: string; url: string; export type: string };

export type ChoiceItem = {
  value: string;
  text: string;
  imageLink?: string;
};

export type RateValue = {
  value: string;
  text: string;
};

export type Question = {
  type: string;
  name: string;
  title?: string;
  choices?: (string | ChoiceItem)[];
  rateValues?: RateValue[];
  isRequired?: boolean;
  rateMin?: number;
  rateMax?: number;
  minRateDescription?: string;
  maxRateDescription?: string;
  rows?: number;
  displayMode?: "auto" | "buttons";
  // Image type properties
  imageLink?: string;
  imageWidth?: string | number;
  imageHeight?: string | number;
  imageFit?: "none" | "contain" | "cover" | "fill";
  contentMode?: "auto" | "image" | "video" | "youtube";
  // HTML type properties
  html?: string;
};
