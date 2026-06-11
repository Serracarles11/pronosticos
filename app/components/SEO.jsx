import { useEffect } from "react";

function setMeta(attr, key, content) {
  if (!content) return;

  let element = document.head.querySelector(`meta[${attr}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function setCanonical(href) {
  if (!href) return;

  let element = document.head.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export default function SEO({
  title,
  description,
  canonical,
  noindex = false,
}) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", canonical);

    setMeta("name", "twitter:card", "summary_large_image");

    setCanonical(canonical);
  }, [title, description, canonical, noindex]);

  return null;
}