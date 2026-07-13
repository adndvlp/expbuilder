export const INPUT_ICON_AREA_WIDTH = 26;

export interface InputTypeInfo {
  displayPlaceholder: string;
  hasIcon: boolean;
}

export function getInputTypeInfo(
  type: string,
  userPlaceholder: string,
): InputTypeInfo {
  switch (type) {
    case "date":
      return {
        displayPlaceholder: userPlaceholder || "YYYY-MM-DD",
        hasIcon: true,
      };
    case "time":
      return { displayPlaceholder: userPlaceholder || "HH:MM", hasIcon: true };
    case "datetime-local":
      return {
        displayPlaceholder: userPlaceholder || "YYYY-MM-DD HH:MM",
        hasIcon: true,
      };
    case "number":
      return { displayPlaceholder: userPlaceholder || "0", hasIcon: true };
    case "password":
      return { displayPlaceholder: "••••••", hasIcon: false };
    default:
      return { displayPlaceholder: userPlaceholder, hasIcon: false };
  }
}
