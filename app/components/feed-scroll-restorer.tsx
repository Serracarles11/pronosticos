"use client";

import { useEffect } from "react";

const FEED_SCROLL_KEY = "todosganamos.feed.scrollTop";

export function FeedScrollRestorer() {
  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>(".feed__scroll");
    if (!scrollEl) return;
    const feedScrollEl = scrollEl;

    const savedScroll = Number(window.sessionStorage.getItem(FEED_SCROLL_KEY) ?? "0");
    if (Number.isFinite(savedScroll) && savedScroll > 0) {
      window.requestAnimationFrame(() => {
        feedScrollEl.scrollTop = savedScroll;
      });
    }

    let frame = 0;
    function saveScroll() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        window.sessionStorage.setItem(FEED_SCROLL_KEY, String(feedScrollEl.scrollTop));
      });
    }

    feedScrollEl.addEventListener("scroll", saveScroll, { passive: true });
    window.addEventListener("pagehide", saveScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      feedScrollEl.removeEventListener("scroll", saveScroll);
      window.removeEventListener("pagehide", saveScroll);
    };
  }, []);

  return null;
}
