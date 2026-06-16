"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { normalizeInternalSearchHref } from "@/lib/search-history";

const HISTORY_KEY = "TodosGanamos-search-history";
const MAX_HISTORY_ITEMS = 6;
const COLORS = ["blue", "navy", "sky", "steel", "slate", "teal", "indigo", "purple"] as const;
const QUICK_CATEGORIES = [
  { label: "Mundial", href: "/feed?categoria=mundial", description: "Pronosticos del Mundial" },
  { label: "Quiniela", href: "/feed?categoria=quiniela", description: "Pronosticos de quiniela" },
  { label: "Cuota alta", href: "/feed?categoria=cuota-alta", description: "Cuotas desde 3.00" },
] as const;

type ProfileSuggestion = {
  id: string;
  username: string;
  display_name: string | null;
  followers_count: number;
  is_private: boolean;
};

type HistoryItem = {
  label: string;
  href: string;
  type: "search" | "profile" | "category";
};

type SearchOption = HistoryItem & {
  id: string;
  description: string;
  initials?: string;
  tone?: (typeof COLORS)[number];
};

function avatarColor(username: string) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function cleanSearchTerm(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function cleanPostgrestSearch(value: string) {
  return value.replace(/^@/, "").replace(/[^\p{L}\p{N}_ -]/gu, " ").trim();
}

function exactOdds(value: string) {
  const match = value.match(/^(?:cuota\s*)?(\d+(?:[.,]\d{1,2})?)$/i);
  if (!match) return null;

  const odds = Number(match[1].replace(",", "."));
  return odds >= 1.01 ? odds.toFixed(2) : null;
}

function formatFollowers(value: number) {
  return new Intl.NumberFormat("es-ES", { notation: "compact", maximumFractionDigits: 1 }).format(
    value
  );
}

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item): item is HistoryItem =>
          typeof item === "object" &&
          item !== null &&
          "label" in item &&
          typeof item.label === "string" &&
          "href" in item &&
          typeof item.href === "string" &&
          "type" in item &&
          ["search", "profile", "category"].includes(String(item.type))
      )
      .map((item) => ({ ...item, href: normalizeInternalSearchHref(item.href) }));
  } catch {
    return [];
  }
}

function saveHistory(item: HistoryItem) {
  const normalizedItem = {
    label: item.label,
    href: normalizeInternalSearchHref(item.href),
    type: item.type,
  };
  const next = [
    normalizedItem,
    ...readHistory().filter((entry) => entry.href !== normalizedItem.href),
  ].slice(0, MAX_HISTORY_ITEMS);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    return next;
  }
  return next;
}

export function HeaderSearch({ initialValue = "" }: { initialValue?: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialValue);
  const [profiles, setProfiles] = useState<ProfileSuggestion[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const term = cleanSearchTerm(query);
  const odds = exactOdds(term);
  const matchingCategories = QUICK_CATEGORIES.filter(({ label }) =>
    label.toLowerCase().includes(term.toLowerCase())
  );

  const typedOptions = useMemo<SearchOption[]>(() => {
    if (!term) return [];

    const options: SearchOption[] = profiles.map((profile) => ({
      id: `profile-${profile.id}`,
      type: "profile",
      label: profile.username,
      href: `/u/${encodeURIComponent(profile.username)}`,
      description: `${profile.display_name ?? `@${profile.username}`} - ${formatFollowers(profile.followers_count)} seguidores${profile.is_private ? " - Cuenta privada" : ""}`,
      initials: profile.username.slice(0, 2).toUpperCase(),
      tone: avatarColor(profile.username),
    }));

    if (odds) {
      options.push({
        id: `odds-${odds}`,
        type: "search",
        label: `Cuota exacta ${odds}`,
        href: `/feed?q=${encodeURIComponent(odds)}`,
        description: "Buscar pronosticos con esta cuota",
      });
    }

    for (const category of matchingCategories) {
      options.push({
        id: `category-${category.href}`,
        type: "category",
        label: category.label,
        href: category.href,
        description: category.description,
      });
    }

    options.push({
      id: `search-${term}`,
      type: "search",
      label: `Buscar "${term}"`,
      href: `/feed?q=${encodeURIComponent(term)}`,
      description: "Ver todos los pronosticos relacionados",
    });

    return options;
  }, [matchingCategories, odds, profiles, term]);

  const visibleOptions: SearchOption[] = term
    ? typedOptions
    : history.map((item, index) => ({
        ...item,
        id: `history-${index}-${item.href}`,
        description: item.type === "profile" ? "Perfil visitado recientemente" : "Busqueda reciente",
      }));

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    const profileTerm = cleanPostgrestSearch(term);
    if (!open || document.visibilityState !== "visible" || profileTerm.length < 2 || odds) {
      return;
    }

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      const pattern = `%${profileTerm}%`;
      const { data } = await supabase
        .from("profiles")
        .select("id, username, display_name, followers_count, is_private")
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order("followers_count", { ascending: false })
        .limit(6);

      if (!ignore) {
        setProfiles((data ?? []) as ProfileSuggestion[]);
        setLoading(false);
      }
    }, 220);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [odds, open, supabase, term]);

  function navigate(item: HistoryItem) {
    const normalizedItem = { ...item, href: normalizeInternalSearchHref(item.href) };
    setHistory(saveHistory(normalizedItem));
    setOpen(false);
    router.push(normalizedItem.href);
  }

  function submitSearch() {
    if (!term) return;
    navigate({
      type: "search",
      label: term,
      href: `/feed?q=${encodeURIComponent(term)}`,
    });
  }

  function clearHistory() {
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch {
      // The browser may disable local storage in strict privacy modes.
    }
    setHistory([]);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + direction;
        if (next < 0) return visibleOptions.length - 1;
        if (next >= visibleOptions.length) return 0;
        return next;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const activeOption = visibleOptions[activeIndex];
      if (activeOption) {
        navigate(activeOption);
      } else {
        submitSearch();
      }
    }
  }

  return (
    <div className="search" ref={rootRef}>
      <input
        autoComplete="off"
        name="q"
        onChange={(event) => {
          setQuery(event.target.value);
          setProfiles([]);
          setLoading(false);
          setActiveIndex(-1);
          setOpen(true);
        }}
        onFocus={() => {
          setHistory(readHistory());
          setActiveIndex(-1);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Busca usuarios, mercados o cuotas: 2.50..."
        ref={inputRef}
        type="search"
        value={query}
      />
      {query && (
        <button
          aria-label="Limpiar busqueda"
          className="search__clear"
          onClick={() => {
            setQuery("");
            setProfiles([]);
            setLoading(false);
            setActiveIndex(-1);
            inputRef.current?.focus();
          }}
          type="button"
        >
          x
        </button>
      )}
      {open && (
        <div className="search-popover">
          <div className="search-popover__head">
            <strong>{term ? "Sugerencias" : "Ultimas busquedas"}</strong>
            {!term && history.length > 0 && (
              <button onClick={clearHistory} type="button">
                Borrar historial
              </button>
            )}
          </div>

          {!term && history.length === 0 && (
            <p className="search-popover__empty">Tus busquedas recientes apareceran aqui.</p>
          )}

          {visibleOptions.length > 0 && (
            <div className="search-popover__list">
              {visibleOptions.map((item, index) => (
                <button
                  className={`search-option ${index === activeIndex ? "is-active" : ""}`}
                  key={item.id}
                  onClick={() => navigate(item)}
                  onMouseEnter={() => setActiveIndex(index)}
                  type="button"
                >
                  {item.type === "profile" ? (
                    <span className={`avatar avatar--md avatar--${item.tone}`}>
                      {item.initials}
                    </span>
                  ) : (
                    <span className={`search-option__icon search-option__icon--${item.type}`}>
                      {item.type === "category" ? "#" : ""}
                    </span>
                  )}
                  <span className="search-option__body">
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="search-option__arrow">&gt;</span>
                </button>
              ))}
            </div>
          )}

          {term && loading && <p className="search-popover__empty">Buscando usuarios...</p>}

          {!term && (
            <div className="search-popover__quick">
              <span>Accesos rapidos</span>
              <div>
                {QUICK_CATEGORIES.map((category) => (
                  <button
                    key={category.href}
                    onClick={() =>
                      navigate({ type: "category", label: category.label, href: category.href })
                    }
                    type="button"
                  >
                    {category.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
