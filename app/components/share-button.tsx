"use client";

import { useState } from "react";

type Props = {
  title: string;
  text?: string;
  url?: string;
};

function currentUrl(explicitUrl?: string) {
  return explicitUrl ? new URL(explicitUrl, window.location.origin).toString() : window.location.href;
}

function openShareUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

export function CopyLinkButton({ url, onCopied }: { url?: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(currentUrl(url));
    setCopied(true);
    onCopied?.();
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button type="button" onClick={copy}>
      <span>CP</span>
      {copied ? "Enlace copiado" : "Copiar enlace"}
    </button>
  );
}

export function ShareMenu({ title, text, url, onClose }: Props & { onClose: () => void }) {
  const shareUrl = currentUrl(url);
  const message = text ?? title;
  const encodedUrl = encodeURIComponent(shareUrl);
  const encodedText = encodeURIComponent(`${message} ${shareUrl}`);

  async function nativeShare() {
    if (!navigator.share) return;
    await navigator.share({ title, text: message, url: shareUrl });
    onClose();
  }

  return (
    <div className="share-menu">
      <div className="share-menu__head">
        <strong>Compartir</strong>
        <button aria-label="Cerrar" onClick={onClose} type="button">
          x
        </button>
      </div>
      <div className="share-menu__grid">
        {typeof navigator !== "undefined" && "share" in navigator && (
          <button type="button" onClick={nativeShare}>
            <span>...</span>
            Compartir
          </button>
        )}
        <button
          type="button"
          onClick={() => openShareUrl(`https://wa.me/?text=${encodedText}`)}
        >
          <span>WA</span>
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => openShareUrl(`https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(message)}`)}
        >
          <span>TG</span>
          Telegram
        </button>
        <button
          type="button"
          onClick={() => openShareUrl(`https://x.com/intent/post?text=${encodedText}`)}
        >
          <span>X</span>
          X
        </button>
        <button
          type="button"
          onClick={() => openShareUrl(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`)}
        >
          <span>FB</span>
          Facebook
        </button>
        <CopyLinkButton onCopied={onClose} url={url} />
      </div>
    </div>
  );
}

export function ShareButton({ title, text, url }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="share">
      <button className="btn btn--ghost" type="button" onClick={() => setOpen((value) => !value)}>
        Compartir
      </button>
      {open && <ShareMenu onClose={() => setOpen(false)} text={text} title={title} url={url} />}
    </div>
  );
}
