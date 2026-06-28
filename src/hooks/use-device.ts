import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "tablet" | "desktop";

export interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouch: boolean;
  isStandalone: boolean; // running as installed PWA
  os: "ios" | "android" | "windows" | "macos" | "linux" | "unknown";
  canInstall: boolean;
}

function detect(): DeviceInfo {
  if (typeof window === "undefined") {
    return {
      type: "desktop", isMobile: false, isTablet: false, isDesktop: true,
      isTouch: false, isStandalone: false, os: "unknown", canInstall: false,
    };
  }
  const ua = navigator.userAgent || "";
  const width = window.innerWidth;
  const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  let os: DeviceInfo["os"] = "unknown";
  if (/iPhone|iPad|iPod/i.test(ua)) os = "ios";
  else if (/Android/i.test(ua)) os = "android";
  else if (/Windows/i.test(ua)) os = "windows";
  else if (/Mac OS X/i.test(ua)) os = "macos";
  else if (/Linux/i.test(ua)) os = "linux";

  const isTabletUA = /iPad|Tablet|PlayBook|Silk/i.test(ua) || (os === "android" && !/Mobile/i.test(ua));
  const isMobileUA = /iPhone|iPod|Android.*Mobile|Mobi|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  let type: DeviceType = "desktop";
  if (isTabletUA || (isTouch && width >= 600 && width < 1024)) type = "tablet";
  else if (isMobileUA || (isTouch && width < 600)) type = "mobile";

  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // @ts-expect-error iOS Safari
    window.navigator.standalone === true;

  return {
    type,
    isMobile: type === "mobile",
    isTablet: type === "tablet",
    isDesktop: type === "desktop",
    isTouch,
    isStandalone,
    os,
    canInstall: type !== "desktop" && !isStandalone,
  };
}

export function useDevice(): DeviceInfo {
  const [info, setInfo] = useState<DeviceInfo>(() => detect());
  useEffect(() => {
    const update = () => setInfo(detect());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return info;
}
