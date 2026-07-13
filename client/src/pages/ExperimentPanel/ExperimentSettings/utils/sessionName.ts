import type {
  SessionNameToken,
  SessionNameTokenType,
  SessionTokenMetadata,
} from "../types";

export const MAX_SESSION_TOKENS = 6;

export const SESSION_TOKEN_CATALOG: SessionTokenMetadata[] = [
  { type: "date", label: "Date", color: "#4a90d9" },
  { type: "time", label: "Time", color: "#9b6dd8" },
  { type: "randomAlpha", label: "Random ID", color: "#e67e22" },
  { type: "customText", label: "Custom Text", color: "#e74c3c" },
  { type: "counter", label: "Participant Number", color: "#16a085" },
];

export function makeSessionToken(type: SessionNameTokenType): SessionNameToken {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    type,
    dateFormat: "YYYY-MM-DD",
    timeFormat: "HH-mm-ss",
    randomLength: 6,
    customValue: "",
    counterDigits: 3,
  };
}

export function previewToken(token: SessionNameToken): string {
  const now = new Date();
  const pad = (number: number) => String(number).padStart(2, "0");
  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());
  switch (token.type) {
    case "date":
      if (token.dateFormat === "YYYYMMDD") return `${year}${month}${day}`;
      if (token.dateFormat === "DD-MM-YYYY") return `${day}-${month}-${year}`;
      if (token.dateFormat === "MM-DD-YYYY") return `${month}-${day}-${year}`;
      return `${year}-${month}-${day}`;
    case "time":
      if (token.timeFormat === "HH-mm") return `${hour}-${minute}`;
      if (token.timeFormat === "HHmmss") return `${hour}${minute}${second}`;
      return `${hour}-${minute}-${second}`;
    case "randomAlpha": {
      const characters = "aB3k9pQxmN4t7ZvE";
      return Array.from(
        { length: token.randomLength },
        (_, index) => characters[index % characters.length],
      ).join("");
    }
    case "customText":
      return token.customValue || "text";
    case "counter":
      return "1".padStart(token.counterDigits, "0");
  }
}

export function getSessionNameUniquenessError(tokens: SessionNameToken[]) {
  if (
    tokens.length > 0 &&
    !tokens.some(
      (token) => token.type === "randomAlpha" || token.type === "counter",
    )
  ) {
    return "Debes incluir al menos un componente Random ID o Participant Number para garantizar sesiones únicas.";
  }
  return null;
}
