import { FaDesktop, FaLaptop, FaMobileAlt, FaTabletAlt } from "react-icons/fa";

export const DEVICE_PRESETS = [
  {
    icon: FaMobileAlt,
    label: "Mobile",
    description: "375 × 725",
    width: 375,
    height: 725,
  },
  {
    icon: (props: React.ComponentProps<typeof FaMobileAlt>) => (
      <FaMobileAlt style={{ transform: "rotate(-90deg)" }} {...props} />
    ),
    label: "Mobile",
    description: "725 × 375",
    width: 725,
    height: 375,
  },
  {
    icon: FaTabletAlt,
    label: "Tablet",
    description: "768 × 725",
    width: 768,
    height: 725,
  },
  {
    icon: FaLaptop,
    label: "Laptop",
    description: "1440 × 763",
    width: 1440,
    height: 763,
  },
  {
    icon: FaDesktop,
    label: "Desktop",
    description: "2560 × 1450",
    width: 2560,
    height: 1450,
  },
];

export type DevicePreset = (typeof DEVICE_PRESETS)[number];
