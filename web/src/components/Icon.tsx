import type { SVGProps } from "react";

export type IconName = "home" | "files" | "route" | "calendar" | "more" | "users" | "briefcase" | "settings" | "logout" | "arrow" | "upload" | "download" | "check" | "clock" | "shield" | "plus" | "close";
const paths: Record<IconName, string> = {
  home: "m3 10 9-7 9 7M5 9v11h5v-6h4v6h5V9",
  files: "M14 2H5v20h14V7l-5-5v5h5M8 12h8M8 16h6",
  route: "M5 4h10a4 4 0 0 1 0 8H9a4 4 0 0 0 0 8h10M16 17l3 3-3 3M3 2h4v4H3z",
  calendar: "M4 5h16v16H4zM8 2v6M16 2v6M4 10h16M8 14h2M14 14h2",
  more: "M5 11h2v2H5zM11 11h2v2h-2zM17 11h2v2h-2z",
  users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M17 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87",
  briefcase: "M3 7h18v14H3zM8 7V3h8v4M3 12a21 21 0 0 0 18 0M10 12h4v4h-4z",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2",
  logout: "M9 4H3v16h6M9 12h12M17 8l4 4-4 4",
  arrow: "M4 12h16M14 6l6 6-6 6",
  upload: "M12 16V3M7 8l5-5 5 5M4 15v6h16v-6",
  download: "M12 3v13M7 11l5 5 5-5M4 17v4h16v-4",
  check: "m5 12 4 4L19 6",
  clock: "M12 8v5l3 2M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0",
  shield: "M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4M8 12l3 3 5-6",
  plus: "M12 4v16M4 12h16",
  close: "m6 6 12 12M6 18 18 6",
};
export function Icon({ name, className = "size-5", ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
