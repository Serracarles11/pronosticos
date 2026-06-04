"use client";

import dynamic from "next/dynamic";

const DynamicNotificationBell = dynamic(
  () => import("./notification-bell").then((mod) => mod.NotificationBell),
  {
    ssr: false,
    loading: () => (
      <button
        aria-label="Cargando notificaciones"
        className="notification-bell notification-bell--placeholder"
        disabled
        type="button"
      />
    ),
  }
);

const DynamicBetaFeedback = dynamic(
  () => import("./beta-feedback").then((mod) => mod.BetaFeedback),
  { ssr: false }
);

export function ShellNotificationBell() {
  return <DynamicNotificationBell />;
}

export function ShellBetaFeedback() {
  return <DynamicBetaFeedback />;
}
