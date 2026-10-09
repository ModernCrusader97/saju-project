"use client";

import { useSyncExternalStore } from "react";

function getLocalDate() {
  const today = new Date();
  return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

function getServerDate() {
  return "";
}

function subscribe(onDateChange: () => void) {
  let timer: ReturnType<typeof setTimeout>;

  function scheduleNextDay() {
    clearTimeout(timer);
    const now = new Date();
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = setTimeout(refresh, nextDay.getTime() - now.getTime());
  }

  function refresh() {
    onDateChange();
    scheduleNextDay();
  }

  scheduleNextDay();
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);

  return () => {
    clearTimeout(timer);
    document.removeEventListener("visibilitychange", refresh);
    window.removeEventListener("focus", refresh);
  };
}

export function useLocalDate() {
  return useSyncExternalStore(subscribe, getLocalDate, getServerDate);
}
