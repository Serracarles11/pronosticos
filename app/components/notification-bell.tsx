"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/actions/notifications";

type Notification = Awaited<ReturnType<typeof getNotifications>>[number];

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} dias`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  function toggle() {
    setOpen((value) => !value);
    if (loaded) return;

    startTransition(async () => {
      setNotifications(await getNotifications());
      setLoaded(true);
    });
  }

  function markRead(id: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === id ? { ...notification, read_at: new Date().toISOString() } : notification
      )
    );
    startTransition(() => void markNotificationRead(id));
  }

  function markAllRead() {
    setNotifications((current) =>
      current.map((notification) => ({ ...notification, read_at: notification.read_at ?? new Date().toISOString() }))
    );
    startTransition(() => void markAllNotificationsRead());
  }

  return (
    <div className="notifications">
      <button aria-label="Notificaciones" className="notification-bell" onClick={toggle} type="button">
        <Image
          alt=""
          aria-hidden="true"
          className="notification-bell__icon"
          height={20}
          src="/notification-svgrepo-com.svg"
          width={20}
        />
        {unreadCount > 0 && <strong>{Math.min(unreadCount, 9)}</strong>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="notification-popover__head">
            <div>
              <strong>Notificaciones</strong>
              <span>{unreadCount} sin leer</span>
            </div>
            {unreadCount > 0 && <button onClick={markAllRead} type="button">Marcar todas</button>}
          </div>
          <div className="notification-list">
            {isPending && !loaded ? (
              <p className="muted">Cargando...</p>
            ) : notifications.length === 0 ? (
              <p className="muted">No tienes notificaciones.</p>
            ) : notifications.map((notification) => (
              <Link
                className={`notification-item ${notification.read_at ? "" : "is-unread"}`}
                href={notification.href || "#"}
                key={notification.id}
                onClick={() => markRead(notification.id)}
              >
                <strong>{notification.titulo}</strong>
                <span>{notification.mensaje}</span>
                <small>{timeAgo(notification.created_at)}</small>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
