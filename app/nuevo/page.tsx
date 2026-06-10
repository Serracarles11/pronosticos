/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { TodosGanamosShell } from "../components/todosganamos-shell";
import { createPronostico } from "@/app/actions/pronosticos";
import { confirmBetImport, discardBetImport } from "@/app/actions/bet-imports";
import { formatPickCategory, normalizePickCategories } from "@/lib/pronostico-meta";
import type { FootballMatchPickerItem } from "@/lib/football-data/types";
import type { BetImportReviewPayload, ImportedBetSelection } from "@/lib/bet-import/types";

type Pick = {
  mercado: string;
  cuota: string;
  eventName?: string;
  competition?: string;
  kickoffAt?: string;
  footballMatchId?: string;
  footballMatchExternalId?: string;
};
type ImportProgress = {
  value: number;
  label: string;
};

const CATEGORY_PRESETS = [
  ["quiniela", "Quiniela"],
  ["cuota-alta", "Cuota alta"],
  ["combinada", "Combinada"],
  ["laliga", "LaLiga"],
  ["champions", "Champions"],
  ["value-bet", "Value bet"],
] as const;

const WORLD_CUP_COMPETITION_CODE = "WC";

function combinedOdds(picks: Pick[]): number {
  return picks.reduce((acc, p) => {
    const v = parseFloat(p.cuota);
    return acc * (isNaN(v) || v < 1.01 ? 1 : v);
  }, 1);
}

function normalizeOddsInput(value: number) {
  if (!Number.isFinite(value)) return "";
  return Math.max(1.01, Math.round(value * 100) / 100).toFixed(2);
}

function normalizeOptionalOddsInput(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return normalizeOddsInput(value);
}

function importProgressLabel(value: number) {
  if (value < 30) return "Subiendo captura";
  if (value < 45) return "Guardando imagen privada";
  if (value < 78) return "Leyendo texto con OCR";
  if (value < 94) return "Detectando cuotas y selecciones";
  return "Preparando revision";
}

const OCR_TARGET_MAX_WIDTH = 1280;
const OCR_TARGET_MAX_HEIGHT = 2200;
const OCR_JPEG_QUALITY = 0.84;

function enhanceCanvasForOcr(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const luminance = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 128));
    const value = contrasted > 238 ? 255 : contrasted < 32 ? 0 : contrasted;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }

  context.putImageData(imageData, 0, 0);
}

async function optimizeBetSlipImageForOcr(file: File) {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
      1,
      OCR_TARGET_MAX_WIDTH / bitmap.width,
      OCR_TARGET_MAX_HEIGHT / bitmap.height
    );

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    enhanceCanvasForOcr(canvas);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", OCR_JPEG_QUALITY)
    );
    if (!blob) return file;
    if (scale === 1 && blob.size > file.size * 1.15) return file;

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

function postBetImportWithProgress(
  file: File,
  onProgress: (progress: ImportProgress) => void
) {
  return new Promise<{
    importId?: string;
    extractedText?: string;
    parsed?: Omit<BetImportReviewPayload, "importId" | "extractedText">;
    error?: string;
  }>((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", "/api/bet-imports");

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const uploadProgress = Math.round((event.loaded / event.total) * 28);
      onProgress({ value: Math.min(33, 5 + uploadProgress), label: "Subiendo captura" });
    };

    request.upload.onload = () => {
      onProgress({ value: 35, label: "Guardando imagen privada" });
    };

    request.onload = () => {
      let payload: {
        importId?: string;
        extractedText?: string;
        parsed?: Omit<BetImportReviewPayload, "importId" | "extractedText">;
        error?: string;
      };
      try {
        payload = JSON.parse(request.responseText || "{}");
      } catch {
        reject(new Error("Respuesta invalida procesando la captura."));
        return;
      }

      if (request.status < 200 || request.status >= 300 || payload.error) {
        reject(new Error(payload.error ?? "No se pudo procesar la captura."));
        return;
      }

      resolve(payload);
    };

    request.onerror = () => reject(new Error("No se pudo subir la captura."));
    request.send(formData);
  });
}

function totalOddsMatch(calculated: number | null, detected: number | null) {
  if (!calculated || !detected) return null;
  return Math.abs(calculated - detected) <= Math.max(0.03, detected * 0.005);
}

function toDatetimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatMatchDate(value: string) {
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMatchStatus(value: string) {
  const labels: Record<string, string> = {
    scheduled: "programado",
    live: "en directo",
    finished: "finalizado",
    postponed: "aplazado",
    cancelled: "cancelado",
  };
  return labels[value] ?? value;
}

function matchEventLabel(match: FootballMatchPickerItem) {
  return `${match.home_team_name} vs ${match.away_team_name}`;
}

function buildPickEventLabel(picks: Pick[]) {
  const events = Array.from(
    new Set(
      picks
        .map((pick) => (pick.eventName ?? "").trim())
        .filter(Boolean)
    )
  );
  if (events.length === 0) return "";
  if (events.length <= 2) return events.join(" + ");
  return `Combinada (${events.length} partidos)`;
}

function buildPickCompetitionLabel(picks: Pick[], fallback: string) {
  const competitions = Array.from(
    new Set(
      picks
        .map((pick) => (pick.competition ?? "").trim())
        .filter(Boolean)
    )
  );
  if (competitions.length === 0) return fallback;
  if (competitions.length === 1) return competitions[0];
  return "Combinada";
}

function latestPickKickoff(picks: Pick[]) {
  const timestamps = picks
    .map((pick) => (pick.kickoffAt ? new Date(pick.kickoffAt).getTime() : NaN))
    .filter(Number.isFinite);
  if (timestamps.length === 0) return "";
  return toDatetimeLocal(new Date(Math.max(...timestamps)).toISOString());
}

export default function NuevoPage() {
  const [confianza, setConfianza] = useState(4);
  const [picks, setPicks] = useState<Pick[]>([{ mercado: "", cuota: "" }]);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importReview, setImportReview] = useState<BetImportReviewPayload | null>(null);
  const [categorias, setCategorias] = useState("");
  const [copyLink, setCopyLink] = useState("");
  const [deporte, setDeporte] = useState("Futbol");
  const [competicion, setCompeticion] = useState("LaLiga");
  const [evento, setEvento] = useState("");
  const [fechaEvento, setFechaEvento] = useState("");
  const [matchPickerPickIndex, setMatchPickerPickIndex] = useState<number | null>(null);
  const [matchQuery, setMatchQuery] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [matchResults, setMatchResults] = useState<FootballMatchPickerItem[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [preview, setPreview] = useState({
    evento: "Real Sociedad - Villarreal",
    explicacion: "La Real lleva 6 partidos seguidos con BTTS en casa...",
    competicion: "LaLiga",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isImportPending, startImportTransition] = useTransition();

  function updatePick(idx: number, field: keyof Pick, value: string) {
    setPicks((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function adjustPickOdds(idx: number, delta: number) {
    setPicks((prev) =>
      prev.map((pick, i) => {
        if (i !== idx) return pick;
        const current = parseFloat(pick.cuota);
        const base = Number.isFinite(current) ? current : 1.01;
        return { ...pick, cuota: normalizeOddsInput(base + delta) };
      })
    );
  }

  function addPick() {
    setPicks((prev) => {
      const lastPick = prev.at(-1);
      return [
        ...prev,
        {
          mercado: "",
          cuota: "",
          eventName: lastPick?.eventName ?? "",
          competition: lastPick?.competition ?? "",
          kickoffAt: lastPick?.kickoffAt ?? "",
          footballMatchId: lastPick?.footballMatchId ?? "",
          footballMatchExternalId: lastPick?.footballMatchExternalId ?? "",
        },
      ];
    });
  }

  function removePick(idx: number) {
    setPicks((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateImportReview<K extends keyof BetImportReviewPayload>(
    field: K,
    value: BetImportReviewPayload[K]
  ) {
    setImportReview((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateImportSelection<K extends keyof ImportedBetSelection>(
    idx: number,
    field: K,
    value: ImportedBetSelection[K]
  ) {
    setImportReview((current) => {
      if (!current) return current;
      const selections = current.selections.map((selection, selectionIdx) =>
        selectionIdx === idx ? { ...selection, [field]: value } : selection
      );
      return {
        ...current,
        kind: selections.length > 1 ? "combinada" : "simple",
        selections,
        totalOdds: combinedOdds(
          selections.map((selection) => ({ mercado: selection.selection, cuota: String(selection.odds ?? "") }))
        ),
      };
    });
  }

  function adjustImportSelectionOdds(idx: number, delta: number) {
    setImportReview((current) => {
      if (!current) return current;
      const selections = current.selections.map((selection, selectionIdx) => {
        if (selectionIdx !== idx) return selection;
        const base = Number.isFinite(selection.odds) && selection.odds ? selection.odds : 1.01;
        return { ...selection, odds: Number(normalizeOddsInput(base + delta)) };
      });
      return {
        ...current,
        selections,
        totalOdds: combinedOdds(
          selections.map((selection) => ({ mercado: selection.selection, cuota: String(selection.odds ?? "") }))
        ),
      };
    });
  }

  function addImportSelection() {
    setImportReview((current) => {
      if (!current) return current;
      const selections = [
        ...current.selections,
        {
          eventName: current.eventName,
          competition: current.competition,
          market: "",
          selection: "",
          odds: null,
          kickoffAt: current.kickoffAt,
          confidence: 0.5,
          rawText: "",
        },
      ];
      return { ...current, kind: "combinada", selections };
    });
  }

  function removeImportSelection(idx: number) {
    setImportReview((current) => {
      if (!current) return current;
      const selections = current.selections.filter((_, selectionIdx) => selectionIdx !== idx);
      return {
        ...current,
        kind: selections.length > 1 ? "combinada" : "simple",
        selections,
        totalOdds: combinedOdds(
          selections.map((selection) => ({ mercado: selection.selection, cuota: String(selection.odds ?? "") }))
        ),
      };
    });
  }

  function markImportSelectionAsTotalOdds(idx: number) {
    setImportReview((current) => {
      if (!current) return current;
      const selectedOdds = current.selections[idx]?.odds ?? null;
      const selections = current.selections.filter((_, selectionIdx) => selectionIdx !== idx);
      const calculatedTotal = combinedOdds(
        selections.map((selection) => ({ mercado: selection.selection, cuota: String(selection.odds ?? "") }))
      );
      return {
        ...current,
        kind: selections.length > 1 ? "combinada" : "simple",
        detectedTotalOdds: selectedOdds,
        totalOdds: calculatedTotal,
        totalOddsMatch: totalOddsMatch(calculatedTotal, selectedOdds),
        selections,
      };
    });
  }

  async function handleImportUpload() {
    setImportError(null);
    if (!importFile) {
      setImportError("Selecciona una captura PNG, JPG, JPEG o WEBP.");
      return;
    }

    setImportLoading(true);
    setImportProgress({ value: 2, label: "Preparando captura" });
    const progressTimer = window.setInterval(() => {
      setImportProgress((current) => {
        if (!current || current.value >= 92) return current;
        const nextValue = current.value < 35 ? current.value : Math.min(92, current.value + 4);
        return { value: nextValue, label: importProgressLabel(nextValue) };
      });
    }, 900);

    try {
      const preparedFile = await optimizeBetSlipImageForOcr(importFile);
      if (preparedFile !== importFile) {
        setImportProgress({ value: 6, label: "Optimizando imagen para OCR" });
      }

      const payload = await postBetImportWithProgress(preparedFile, setImportProgress);
      if (payload.error || !payload.importId || !payload.parsed) {
        throw new Error(payload.error ?? "No se pudo procesar la captura.");
      }

      setImportProgress({ value: 100, label: "Revision lista" });
      setImportReview({
        importId: payload.importId,
        extractedText: payload.extractedText ?? "",
        ...payload.parsed,
      });
    } catch (uploadError) {
      setImportError(uploadError instanceof Error ? uploadError.message : "No se pudo procesar la captura.");
    } finally {
      window.clearInterval(progressTimer);
      setImportLoading(false);
      window.setTimeout(() => setImportProgress(null), 900);
    }
  }

  function handleImportDiscard() {
    if (!importReview) {
      setImportFile(null);
      setImportError(null);
      return;
    }

    const importId = importReview.importId;
    setImportReview(null);
    setImportFile(null);
    setImportError(null);
    startImportTransition(async () => {
      await discardBetImport(importId);
    });
  }

  function handleImportPublish() {
    if (!importReview) return;
    setImportError(null);
    startImportTransition(async () => {
      const result = await confirmBetImport({
        importId: importReview.importId,
        bookmaker: importReview.bookmaker,
        kind: importReview.kind,
        sport: importReview.sport,
        competition: importReview.competition,
        eventName: importReview.eventName,
        market: importReview.market,
        selection: importReview.selection,
        selections: importReview.selections,
        totalOdds: importReview.totalOdds,
        detectedTotalOdds: importReview.detectedTotalOdds,
        potentialReturnDetected: importReview.potentialReturnDetected,
        boosterPercent: importReview.boosterPercent,
        totalOddsMatch: totalOddsMatch(reviewTotalOdds, importReview.detectedTotalOdds),
        warnings: importReview.warnings,
        stakeSimulated: importReview.stakeSimulated,
        kickoffAt: importReview.kickoffAt,
        explanation: "Combinada importada desde captura y revisada por el usuario.",
        visibility: "publico",
      });
      if (result?.error) setImportError(result.error);
    });
  }

  function toggleMatchPicker(idx: number) {
    setMatchPickerPickIndex((current) => {
      const next = current === idx ? null : idx;
      if (next === null) setMatchLoading(false);
      return next;
    });
  }

  function clearPickMatch(idx: number) {
    setPicks((prev) =>
      prev.map((pick, pickIdx) =>
        pickIdx === idx
          ? {
              ...pick,
              eventName: "",
              competition: "",
              kickoffAt: "",
              footballMatchId: "",
              footballMatchExternalId: "",
            }
          : pick
      )
    );
  }

  function toggleCategory(category: string) {
    setCategorias((current) => {
      const currentCategories = normalizePickCategories(current);
      const next = currentCategories.includes(category)
        ? currentCategories.filter((item) => item !== category)
        : [...currentCategories, category];
      return next.join(", ");
    });
  }

  const matchPickerOpen = matchPickerPickIndex !== null;
  const totalOdds = combinedOdds(picks);
  const picksEventLabel = buildPickEventLabel(picks);
  const picksCompetitionLabel = buildPickCompetitionLabel(picks, competicion);
  const picksLatestKickoff = latestPickKickoff(picks);
  const previewEventLabel = picksEventLabel || preview.evento;
  const previewMercado =
    picks.length === 1
      ? picks[0].mercado || "..."
      : picks.length > 1
      ? `Combinada (${picks.length} sel.)`
      : "...";
  const previewCuota =
    picks.length === 1
      ? picks[0].cuota || "?"
      : totalOdds.toFixed(2);
  const previewCategories = normalizePickCategories(categorias);
  const reviewTotalOdds = importReview
    ? combinedOdds(
        importReview.selections.map((selection) => ({
          mercado: selection.selection,
          cuota: String(selection.odds ?? ""),
        }))
      )
    : null;
  const totalMismatch =
    importReview?.detectedTotalOdds && reviewTotalOdds
      ? totalOddsMatch(reviewTotalOdds, importReview.detectedTotalOdds) === false
      : false;
  const importTotalOddsMatch = importReview
    ? totalOddsMatch(reviewTotalOdds, importReview.detectedTotalOdds)
    : null;

  function applyFootballMatch(match: FootballMatchPickerItem) {
    const eventLabel = matchEventLabel(match);
    const matchCompetitionName = match.competition_name ?? match.competition_code ?? "Futbol";
    const targetPickIndex = matchPickerPickIndex ?? 0;
    setPicks((prev) =>
      prev.map((pick, idx) =>
        idx === targetPickIndex
          ? {
              ...pick,
              eventName: eventLabel,
              competition: matchCompetitionName,
              kickoffAt: match.kickoff_at,
              footballMatchId: match.id,
              footballMatchExternalId: match.external_id,
            }
          : pick
      )
    );
    setMatchPickerPickIndex(null);
    setMatchLoading(false);
    setDeporte("Futbol");
    if (picks.length === 1 || targetPickIndex === 0) {
      setCompeticion(matchCompetitionName);
      setEvento(eventLabel);
      setFechaEvento(toDatetimeLocal(match.kickoff_at));
    }
    setPreview((current) => ({
      ...current,
      evento: targetPickIndex === 0 ? eventLabel : buildPickEventLabel(picks) || eventLabel,
      competicion: targetPickIndex === 0 ? matchCompetitionName : buildPickCompetitionLabel(picks, matchCompetitionName),
    }));
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get("matchId");
    if (!matchId) return;

    let ignore = false;
    fetch(`/api/football-matches/search?id=${encodeURIComponent(matchId)}&limit=1`)
      .then((response) => response.json())
      .then((payload: { matches?: FootballMatchPickerItem[] }) => {
        const match = payload.matches?.[0];
        if (ignore || !match) return;
        const eventLabel = matchEventLabel(match);
        const matchCompetitionName = match.competition_name ?? match.competition_code ?? "Futbol";
        setPicks((prev) =>
          prev.map((pick, idx) =>
            idx === 0
              ? {
                  ...pick,
                  eventName: eventLabel,
                  competition: matchCompetitionName,
                  kickoffAt: match.kickoff_at,
                  footballMatchId: match.id,
                  footballMatchExternalId: match.external_id,
                }
              : pick
          )
        );
        setDeporte("Futbol");
        setCompeticion(matchCompetitionName);
        setEvento(eventLabel);
        setFechaEvento(toDatetimeLocal(match.kickoff_at));
        setPreview((current) => ({
          ...current,
          evento: eventLabel,
          competicion: matchCompetitionName,
        }));
      })
      .catch(() => {
        if (!ignore) setMatchError("No se pudo cargar el partido seleccionado.");
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!matchPickerOpen) return;

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setMatchLoading(true);
      setMatchError(null);

      const params = new URLSearchParams({
        competitionCode: WORLD_CUP_COMPETITION_CODE,
        limit: "8",
      });
      if (matchQuery.trim()) params.set("q", matchQuery.trim());
      if (matchDate) {
        const from = new Date(`${matchDate}T00:00:00`);
        const to = new Date(`${matchDate}T23:59:59`);
        params.set("dateFrom", from.toISOString());
        params.set("dateTo", to.toISOString());
      }

      try {
        const response = await fetch(`/api/football-matches/search?${params.toString()}`);
        const payload = (await response.json()) as {
          matches?: FootballMatchPickerItem[];
          error?: string;
        };
        if (ignore) return;
        setMatchResults(payload.matches ?? []);
        if (payload.error) setMatchError(payload.error);
      } catch {
        if (!ignore) setMatchError("No se pudieron buscar partidos.");
      } finally {
        if (!ignore) setMatchLoading(false);
      }
    }, 250);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [matchDate, matchPickerOpen, matchPickerPickIndex, matchQuery]);

  async function handleSubmit(formData: FormData) {
    formData.set("confianza", String(confianza));
    formData.set("picks_json", JSON.stringify(picks));
    formData.set("copy_link", copyLink.trim());
    if (picksEventLabel) formData.set("evento", picksEventLabel);
    if (picksCompetitionLabel) formData.set("competicion", picksCompetitionLabel);
    if (picksLatestKickoff) formData.set("fecha_evento", picksLatestKickoff);
    setError(null);
    startTransition(async () => {
      const result = await createPronostico(formData);
      if (result?.error) setError(result.error);
    });
  }

  function handleDraft() {
    const form = document.getElementById("pred-form") as HTMLFormElement;
    if (!form) return;
    const hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "_action";
    hidden.value = "borrador";
    form.appendChild(hidden);
    form.requestSubmit();
  }

  return (
    <TodosGanamosShell active="feed">
      <main className="publish">
        <div className="publish__inner">
          <section className="publish__form">
            <Link href="/feed" className="publish__back">
              ← Volver al feed
            </Link>
            <h1>Nuevo pronostico</h1>
            <p className="publish__lede">
              Publica lo que ves antes que nadie. Cuanto mas claro lo expliques,
              mas facil sera que la comunidad te siga.
            </p>
            <div className="responsible-note responsible-note--compact">
              <strong>+18</strong>
              <span>No publiques llamadas a apostar dinero real ni promesas de ganancia.</span>
            </div>

            {error && <div className="auth-error" style={{ marginBottom: 16 }}>{error}</div>}

            <section className="bet-import">
              <div className="bet-import__head">
                <div>
                  <h2>Importar desde captura</h2>
                  <p>
                    Sube una captura de una apuesta o combinada. El OCR puede cometer errores.
                    Revisa todos los datos antes de publicar.
                  </p>
                </div>
                <button
                  className="btn btn--ghost"
                  onClick={() => setImportOpen((current) => !current)}
                  type="button"
                >
                  {importOpen ? "Ocultar importacion" : "Importar desde captura"}
                </button>
              </div>

              {importOpen && (
                <div className="bet-import__body">
                  <div className="bet-import__upload">
                    <input
                      accept="image/png,image/jpeg,image/webp"
                      className="input"
                      onChange={(event) => {
                        setImportFile(event.target.files?.[0] ?? null);
                        setImportProgress(null);
                        setImportError(null);
                      }}
                      type="file"
                    />
                    <button
                      className="btn btn--soft"
                      disabled={importLoading || isImportPending}
                      onClick={handleImportUpload}
                      type="button"
                    >
                      {importLoading ? "Procesando captura..." : "Procesar OCR"}
                    </button>
                  </div>
                  <div className="field__hint">
                    Formatos permitidos: PNG, JPG, JPEG y WEBP. Maximo 5 MB. No se hacen apuestas reales ni scraping.
                  </div>
                  {importProgress && (
                    <div
                      aria-label="Progreso de importacion"
                      aria-valuemax={100}
                      aria-valuemin={0}
                      aria-valuenow={importProgress.value}
                      className="bet-import-progress"
                      role="progressbar"
                    >
                      <div className="bet-import-progress__top">
                        <span>{importProgress.label}</span>
                        <strong>{importProgress.value}%</strong>
                      </div>
                      <div className="bet-import-progress__track">
                        <span style={{ width: `${importProgress.value}%` }} />
                      </div>
                    </div>
                  )}
                  {importError && <div className="auth-error">{importError}</div>}

                  {importReview && (
                    <div className="bet-review">
                      <div className="bet-review__top">
                        <div>
                          <h3>Revision de captura</h3>
                          <p>El OCR puede cometer errores. Edita los datos antes de publicar.</p>
                        </div>
                        <div className="bet-review__badges">
                          {importReview.ticketPattern === "partial_selection_list" && (
                            <span className="badge badge--purple">Captura parcial</span>
                          )}
                          <span className="badge badge--purple">
                            {importReview.kind === "combinada" ? "Combinada" : "Simple"}
                          </span>
                        </div>
                      </div>

                      <div className="publish__grid-2">
                        <div className="field">
                          <label className="field__label">Bookmaker</label>
                          <select
                            className="select"
                            onChange={(event) => updateImportReview("bookmaker", event.target.value)}
                            value={importReview.bookmaker}
                          >
                            <option value="unknown">No detectado</option>
                            <option value="winamax">Winamax</option>
                            <option value="bet365">Bet365</option>
                            <option value="betfair">Betfair</option>
                            <option value="betway">Betway</option>
                            <option value="codere">Codere</option>
                            <option value="sportium">Sportium</option>
                            <option value="luckia">Luckia</option>
                            <option value="bwin">Bwin</option>
                            <option value="otro">Otro</option>
                          </select>
                        </div>
                        <div className="field">
                          <label className="field__label">Tipo</label>
                          <select
                            className="select"
                            onChange={(event) =>
                              updateImportReview("kind", event.target.value === "simple" ? "simple" : "combinada")
                            }
                            value={importReview.kind}
                          >
                            <option value="simple">Simple</option>
                            <option value="combinada">Combinada</option>
                          </select>
                        </div>
                      </div>

                      <div className="publish__grid-2">
                        <div className="field">
                          <label className="field__label">Deporte</label>
                          <input
                            className="input"
                            onChange={(event) => updateImportReview("sport", event.target.value)}
                            value={importReview.sport}
                          />
                        </div>
                        <div className="field">
                          <label className="field__label">Competicion</label>
                          <input
                            className="input"
                            onChange={(event) => updateImportReview("competition", event.target.value)}
                            value={importReview.competition}
                          />
                        </div>
                      </div>

                      <div className="field">
                        <label className="field__label">Evento principal</label>
                        <input
                          className="input"
                          onChange={(event) => updateImportReview("eventName", event.target.value)}
                          value={importReview.eventName}
                        />
                      </div>

                      <div className="bet-review__signals">
                        <span>
                          Confianza OCR: <strong>{Math.round((importReview.confidence ?? 0) * 100)}%</strong>
                        </span>
                        {importReview.debug?.parser && (
                          <span>
                            Parser: <strong>{importReview.debug.parser}</strong>
                          </span>
                        )}
                        {typeof importReview.bookmakerConfidence === "number" && (
                          <span>
                            Bookmaker: <strong>{Math.round(importReview.bookmakerConfidence * 100)}%</strong>
                          </span>
                        )}
                      </div>

                      <div className="bet-review__selections">
                        <div className="picks-header">
                          <label className="field__label" style={{ margin: 0 }}>
                            Selecciones detectadas
                          </label>
                          <div className="bet-review__odds-summary">
                            <span className="picks-combined">
                              Detectada: <strong className="mono">{importReview.detectedTotalOdds?.toFixed(2) ?? "-"}</strong>
                            </span>
                            <span className="picks-combined">
                              Calculada: <strong className="mono">{reviewTotalOdds?.toFixed(2) ?? "-"}</strong>
                            </span>
                            {importTotalOddsMatch === true && <span className="badge badge--ok">Coincide aproximadamente</span>}
                            {importTotalOddsMatch === false && <span className="badge badge--warn">Revisar</span>}
                          </div>
                        </div>
                        {importReview.warnings.length > 0 && (
                          <div className="bet-review__warnings">
                            {importReview.warnings.map((warning) => (
                              <span key={warning}>{warning}</span>
                            ))}
                          </div>
                        )}
                        {Boolean(importReview.corrections?.length) && (
                          <div className="bet-review__warnings bet-review__warnings--soft">
                            {importReview.corrections?.map((correction) => (
                              <span key={correction}>{correction}</span>
                            ))}
                          </div>
                        )}
                        {Boolean(importReview.orphanOdds?.length) && (
                          <div className="field__hint">
                            Cuotas sueltas no asignadas: {importReview.orphanOdds?.map((odds) => odds.toFixed(2)).join(", ")}
                          </div>
                        )}
                        {importReview.ticketPattern === "partial_selection_list" && (
                          <div className="auth-info">
                            No se ha detectado importe ni cuota total. Puedes completarlo manualmente.
                          </div>
                        )}
                        {totalMismatch && (
                          <div className="auth-error">
                            La cuota calculada no coincide con la cuota detectada. Revisa los datos antes de publicar.
                          </div>
                        )}
                        {importReview.selections.length === 0 && (
                          <div className="field__hint">
                            No se detectaron selecciones completas. Anade las filas manualmente antes de publicar.
                          </div>
                        )}

                        {importReview.selections.map((selection, idx) => (
                          <div className="bet-selection" key={`${selection.rawText}-${idx}`}>
                            <div className="bet-selection__num">{idx + 1}</div>
                            <input
                              className="input"
                              onChange={(event) => updateImportSelection(idx, "eventName", event.target.value)}
                              placeholder="Partido/evento"
                              value={selection.eventName}
                            />
                            <input
                              className="input"
                              onChange={(event) => updateImportSelection(idx, "market", event.target.value)}
                              placeholder="Mercado"
                              value={selection.market}
                            />
                            <input
                              className="input"
                              onChange={(event) => updateImportSelection(idx, "selection", event.target.value)}
                              placeholder="Seleccion"
                              value={selection.selection}
                            />
                            <div className="pick-row__odds">
                              <button
                                aria-label="Bajar cuota importada"
                                className="pick-row__odds-btn"
                                onClick={() => adjustImportSelectionOdds(idx, -0.01)}
                                type="button"
                              >
                                -
                              </button>
                              <input
                                className="input mono pick-row__cuota"
                                inputMode="decimal"
                                onBlur={(event) =>
                                  updateImportSelection(
                                    idx,
                                    "odds",
                                    Number(normalizeOddsInput(parseFloat(event.target.value)))
                                  )
                                }
                                onChange={(event) =>
                                  updateImportSelection(
                                    idx,
                                    "odds",
                                    event.target.value ? Number(event.target.value) : null
                                  )
                                }
                                placeholder="1.80"
                                step="0.01"
                                type="number"
                                value={normalizeOptionalOddsInput(selection.odds)}
                              />
                              <button
                                aria-label="Subir cuota importada"
                                className="pick-row__odds-btn"
                                onClick={() => adjustImportSelectionOdds(idx, 0.01)}
                                type="button"
                              >
                                +
                              </button>
                            </div>
                            <div className="bet-selection__actions">
                              <span className="bet-selection__confidence">
                                {Math.round(selection.confidence * 100)}%
                              </span>
                              {importReview.ticketPattern !== "partial_selection_list" && (
                                <button
                                  className="bet-selection__total-btn"
                                  onClick={() => markImportSelectionAsTotalOdds(idx)}
                                  type="button"
                                >
                                  Cuota total
                                </button>
                              )}
                              <button
                                aria-label="Eliminar seleccion importada"
                                className="pick-row__remove"
                                onClick={() => removeImportSelection(idx)}
                                type="button"
                              >
                                x
                              </button>
                            </div>
                          </div>
                        ))}

                        <button className="btn btn--ghost picks-add" onClick={addImportSelection} type="button">
                          + Anadir seleccion
                        </button>
                      </div>

                      <div className="publish__grid-2">
                        <div className="field">
                          <label className="field__label">Cuota total detectada</label>
                          <input
                            className="input mono"
                            onChange={(event) =>
                              updateImportReview(
                                "detectedTotalOdds",
                                event.target.value ? Number(event.target.value) : null
                              )
                            }
                            step="0.01"
                            type="number"
                            value={normalizeOptionalOddsInput(importReview.detectedTotalOdds)}
                          />
                          {totalMismatch && (
                            <div className="field__hint">
                              La cuota detectada no coincide con el producto de las selecciones.
                            </div>
                          )}
                        </div>
                        <div className="field">
                          <label className="field__label">Stake simulado</label>
                          <input
                            className="input mono"
                            max="100"
                            min="0.1"
                            onChange={(event) =>
                              updateImportReview(
                                "stakeSimulated",
                                event.target.value ? Number(event.target.value) : null
                              )
                            }
                            step="0.1"
                            type="number"
                            value={importReview.stakeSimulated ?? ""}
                          />
                        </div>
                      </div>

                      <div className="publish__grid-2">
                        <div className="field">
                          <label className="field__label">Ganancia potencial detectada</label>
                          <input
                            className="input mono"
                            onChange={(event) =>
                              updateImportReview(
                                "potentialReturnDetected",
                                event.target.value ? Number(event.target.value) : null
                              )
                            }
                            step="0.01"
                            type="number"
                            value={importReview.potentialReturnDetected ?? ""}
                          />
                        </div>
                        <div className="field">
                          <label className="field__label">Combo booster detectado (%)</label>
                          <input
                            className="input mono"
                            onChange={(event) =>
                              updateImportReview(
                                "boosterPercent",
                                event.target.value ? Number(event.target.value) : null
                              )
                            }
                            step="0.01"
                            type="number"
                            value={importReview.boosterPercent ?? ""}
                          />
                        </div>
                      </div>

                      <details className="bet-review__ocr">
                        <summary>Texto OCR original</summary>
                        <pre>{importReview.extractedText || "Sin texto detectado."}</pre>
                      </details>

                      <div className="publish__actions">
                        <button
                          className="btn btn--ghost btn--lg"
                          onClick={() => document.querySelector<HTMLInputElement>(".bet-selection .input")?.focus()}
                          type="button"
                        >
                          Editar
                        </button>
                        <button
                          className="btn btn--danger btn--lg"
                          disabled={isImportPending}
                          onClick={handleImportDiscard}
                          type="button"
                        >
                          Descartar
                        </button>
                        <button
                          className="btn btn--primary btn--lg btn--flex"
                          disabled={isImportPending || importReview.selections.length === 0}
                          onClick={handleImportPublish}
                          type="button"
                        >
                          {isImportPending ? "Publicando..." : "Publicar combinada"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <form action={handleSubmit} id="pred-form">
              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="deporte">
                    Deporte
                  </label>
                  <select
                    id="deporte"
                    name="deporte"
                    className="select"
                    value={deporte}
                    onChange={(e) => setDeporte(e.target.value)}
                  >
                    <option>Futbol</option>
                    <option>Tenis</option>
                    <option>NBA</option>
                    <option>eSports</option>
                    <option>Combinada</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="competicion">
                    Competicion
                  </label>
                  <select
                    id="competicion"
                    name="competicion"
                    className="select"
                    value={competicion}
                    onChange={(e) => {
                      setCompeticion(e.target.value);
                      setPreview((p) => ({ ...p, competicion: e.target.value }));
                    }}
                  >
                    <option>LaLiga</option>
                    <option>Premier League</option>
                    <option>Champions League</option>
                    <option>Mundial</option>
                    <option>Liga Hypermotion</option>
                    <option>Roland Garros</option>
                    <option>NBA Playoffs</option>
                    <option>Otra</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="evento">
                  Evento general
                </label>
                <input
                  id="evento"
                  name="evento"
                  className="input"
                  placeholder="Opcional si eliges partido en cada seleccion"
                  onChange={(e) => {
                    setEvento(e.target.value);
                    setPreview((p) => ({ ...p, evento: e.target.value || "..." }));
                  }}
                  value={evento}
                />
                <div className="field__hint">
                  Para combinadas de varios partidos, puedes dejarlo vacio y elegir un partido en cada seleccion.
                </div>
              </div>

              <div className="field">
                <div className="picks-header">
                  <label className="field__label" style={{ margin: 0 }}>
                    Pronosticos / selecciones
                  </label>
                  {picks.length > 1 && (
                    <span className="picks-combined">
                      Cuota combinada: <strong className="mono">{totalOdds.toFixed(2)}</strong>
                    </span>
                  )}
                </div>

                <div className="picks-list">
                  {picks.map((pick, idx) => (
                    <div
                      key={idx}
                      className={`pick-row pick-row--with-match ${picks.length === 1 ? "pick-row--no-remove" : ""}`}
                    >
                      <span className="pick-row__num">{idx + 1}</span>
                      <div className="pick-row__match">
                        <input
                          className="input"
                          placeholder="Partido de esta seleccion"
                          value={pick.eventName ?? ""}
                          onChange={(e) => updatePick(idx, "eventName", e.target.value)}
                        />
                        <div className="pick-row__match-actions">
                          <button
                            aria-controls={`world-cup-match-panel-${idx}`}
                            aria-expanded={matchPickerPickIndex === idx}
                            className="pick-row__match-btn"
                            onClick={() => toggleMatchPicker(idx)}
                            type="button"
                          >
                            {matchPickerPickIndex === idx
                              ? "Ocultar"
                              : pick.footballMatchId
                              ? "Cambiar partido"
                              : "Elegir partido"}
                          </button>
                          {(pick.eventName || pick.footballMatchId) && (
                            <button
                              className="pick-row__match-btn pick-row__match-btn--muted"
                              onClick={() => clearPickMatch(idx)}
                              type="button"
                            >
                              Quitar
                            </button>
                          )}
                        </div>
                        {pick.kickoffAt && (
                          <span className="pick-row__match-meta">
                            {pick.competition ?? "Futbol"} - {formatMatchDate(pick.kickoffAt)}
                          </span>
                        )}
                      </div>
                      <input
                        className="input pick-row__mercado"
                        placeholder="Ej: BTTS Si, Mas 2.5, Gana local..."
                        value={pick.mercado}
                        onChange={(e) => updatePick(idx, "mercado", e.target.value)}
                        required
                      />
                      <div className="pick-row__odds">
                        <button
                          aria-label="Bajar cuota"
                          className="pick-row__odds-btn"
                          onClick={() => adjustPickOdds(idx, -0.01)}
                          type="button"
                        >
                          -
                        </button>
                        <input
                          className="input mono pick-row__cuota"
                          inputMode="decimal"
                          placeholder="1.82"
                          type="number"
                          step="0.01"
                          min="1.01"
                          value={pick.cuota}
                          onBlur={(e) => updatePick(idx, "cuota", normalizeOddsInput(parseFloat(e.target.value)))}
                          onChange={(e) => updatePick(idx, "cuota", e.target.value)}
                          required
                        />
                        <button
                          aria-label="Subir cuota"
                          className="pick-row__odds-btn"
                          onClick={() => adjustPickOdds(idx, 0.01)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                      {picks.length > 1 && (
                        <button
                          type="button"
                          className="pick-row__remove"
                          onClick={() => removePick(idx)}
                          aria-label="Eliminar seleccion"
                        >
                          ×
                        </button>
                      )}
                      {matchPickerPickIndex === idx && (
                        <div className="match-picker__panel pick-row__match-panel" id={`world-cup-match-panel-${idx}`}>
                          <div className="match-picker__filters">
                            <input
                              className="input"
                              onChange={(event) => setMatchQuery(event.target.value)}
                              placeholder="Buscar Mexico, Espana, Brasil..."
                              type="search"
                              value={matchQuery}
                            />
                            <input
                              className="input"
                              onChange={(event) => setMatchDate(event.target.value)}
                              type="date"
                              value={matchDate}
                            />
                          </div>
                          <div className="match-picker__results">
                            {matchLoading && <p className="muted">Buscando partidos del Mundial...</p>}
                            {!matchLoading && matchError && <p className="muted">{matchError}</p>}
                            {!matchLoading && !matchError && matchResults.length === 0 && (
                              <p className="muted">No hay partidos del Mundial disponibles con esos filtros.</p>
                            )}
                            {matchResults.map((match) => (
                              <button
                                className={`match-option ${pick.footballMatchId === match.id ? "is-active" : ""}`}
                                key={match.id}
                                onClick={() => applyFootballMatch(match)}
                                type="button"
                              >
                                <span className="match-option__teams">
                                  {match.home_team_crest && <img alt="" src={match.home_team_crest} />}
                                  <strong>{match.home_team_name}</strong>
                                  <span>vs</span>
                                  {match.away_team_crest && <img alt="" src={match.away_team_crest} />}
                                  <strong>{match.away_team_name}</strong>
                                </span>
                                <span className="match-option__meta">
                                  {match.competition_name ?? match.competition_code ?? "Mundial"} - {formatMatchDate(match.kickoff_at)} - {formatMatchStatus(match.status)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn--ghost picks-add"
                  onClick={addPick}
                >
                  + Añadir seleccion
                </button>
                <div className="field__hint">
                  {picks.length === 1
                    ? "Pronostico simple. Añade mas selecciones para hacer una combinada."
                    : `Combinada de ${picks.length} selecciones · Cuota total: ${totalOdds.toFixed(2)}`}
                </div>
              </div>

              <div className="field">
                <label className="field__label">Nivel de confianza</label>
                <div className="confidence">
                  {[1, 2, 3, 4, 5].map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={`confidence__step ${step <= confianza ? "is-on" : ""}`.trim()}
                      onClick={() => setConfianza(step)}
                    >
                      {step}
                    </button>
                  ))}
                </div>
                <div className="field__hint">
                  {confianza}/5 -{" "}
                  {confianza <= 2
                    ? "Conviccion baja."
                    : confianza === 3
                    ? "Conviccion media."
                    : confianza === 4
                    ? "Conviccion alta. La comunidad valora mas cuando explicas por que."
                    : "Conviccion maxima. Asegurate de argumentarlo bien."}
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="explicacion">
                  Explicacion
                </label>
                <textarea
                  id="explicacion"
                  name="explicacion"
                  className="textarea"
                  rows={5}
                  placeholder="Explica tu razonamiento, estadisticas, lesiones clave..."
                  minLength={20}
                  onChange={(e) =>
                    setPreview((p) => ({ ...p, explicacion: e.target.value || "" }))
                  }
                  defaultValue=""
                />
                <div className="field__hint">
                  Min. 20 caracteres. TodosGanamos premia las apuestas argumentadas.
                </div>
              </div>

              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="fecha_evento">
                    Fecha y hora del evento
                  </label>
                  <input
                    id="fecha_evento"
                    name="fecha_evento"
                    className="input"
                    onChange={(event) => setFechaEvento(event.target.value)}
                    type="datetime-local"
                    value={fechaEvento}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="visibilidad">
                    Visibilidad
                  </label>
                  <select id="visibilidad" name="visibilidad" className="select" defaultValue="publico">
                    <option value="publico">Publico</option>
                    <option value="seguidores">Solo seguidores</option>
                    <option value="borrador">Borrador privado</option>
                  </select>
                </div>
              </div>

              <div className="publish__grid-2">
                <div className="field">
                  <label className="field__label" htmlFor="bookmaker">
                    Bookmaker de referencia
                  </label>
                  <select className="select" defaultValue="" id="bookmaker" name="bookmaker">
                    <option value="">No indicar</option>
                    <option>Bet365</option>
                    <option>Winamax</option>
                    <option>Betfair</option>
                    <option>Betway</option>
                    <option>Otro</option>
                  </select>
                  <div className="field__hint">Solo como referencia informativa de la cuota.</div>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="stake_simulado">
                    Stake simulado
                  </label>
                  <input
                    className="input mono"
                    defaultValue="1"
                    id="stake_simulado"
                    max="100"
                    min="0.1"
                    name="stake_simulado"
                    step="0.1"
                    type="number"
                  />
                  <div className="field__hint">Unidades ficticias. Nunca representa dinero real.</div>
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="copy_link">
                  Link para copiar la apuesta
                </label>
                <input
                  className="input"
                  id="copy_link"
                  name="copy_link"
                  onChange={(event) => setCopyLink(event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={copyLink}
                />
                <div className="field__hint">
                  Opcional. Solo se aceptan enlaces HTTPS. TodosGanamos no permite apostar dentro de la app.
                </div>
              </div>

              <div className="field">
                <label className="field__label" htmlFor="categorias">
                  Categorias de la apuesta
                </label>
                <input
                  className="input"
                  id="categorias"
                  name="categorias"
                  onChange={(event) => setCategorias(event.target.value)}
                  placeholder="quiniela, cuota-alta, laliga"
                  value={categorias}
                />
                <div className="publish-category-presets">
                  {CATEGORY_PRESETS.map(([value, label]) => {
                    const isSelected = previewCategories.includes(value);
                    return (
                      <button
                        aria-pressed={isSelected}
                        className={isSelected ? "is-active" : undefined}
                        key={value}
                        onClick={() => toggleCategory(value)}
                        type="button"
                      >
                        {isSelected ? "×" : "+"} {label}
                      </button>
                    );
                  })}
                </div>
                <div className="field__hint">
                  Separalas con comas. Se normalizan para busqueda y filtros.
                </div>
              </div>

              <div className="publish__actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--lg btn--flex"
                  disabled={isPending}
                >
                  {isPending ? "Publicando..." : "Publicar pronostico"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--lg"
                  onClick={handleDraft}
                  disabled={isPending}
                >
                  Guardar borrador
                </button>
              </div>
            </form>
          </section>

          <aside className="publish__aside">
            <h4 className="side-section__title">Vista previa en el feed</h4>
            <article className="card card--featured pred">
              <header className="pred__head">
                <div className="pred__author">
                  <span className="avatar avatar--md avatar--blue">YO</span>
                  <div className="pred__author-meta">
                    <span className="pred__user">tu_usuario</span>
                    <span className="pred__sub">Ahora · {preview.competicion}</span>
                  </div>
                </div>
                <span className="pill pill--warn">
                  <span className="pill__dot" />
                  Pendiente
                </span>
              </header>
              <h3 className="pred__title">{previewEventLabel || "..."}</h3>
              {previewCategories.length > 0 && (
                <div className="pred-meta-list">
                  {previewCategories.map((category) => (
                    <span className="badge" key={category}>
                      {formatPickCategory(category)}
                    </span>
                  ))}
                </div>
              )}
              <div className="pred__strip">
                <div className="pred__cell">
                  <div className="pred__cell-label">Pronostico</div>
                  <div className="pred__cell-value">{previewMercado}</div>
                </div>
                <div className="pred__cell pred__cell--accent">
                  <div className="pred__cell-label">Cuota</div>
                  <div className="pred__cell-value mono">{previewCuota}</div>
                </div>
                <div className="pred__cell">
                  <div className="pred__cell-label">Confianza</div>
                  <div className="pred__confidence">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={s <= confianza ? "is-on" : ""} />
                    ))}
                  </div>
                </div>
              </div>
              {preview.explicacion && (
                <p className="pred__body">{preview.explicacion.slice(0, 100)}{preview.explicacion.length > 100 ? "..." : ""}</p>
              )}
              {copyLink && (
                <span className="badge badge--purple">Incluye link de copia</span>
              )}
            </article>

            <div className="notice publish__notice">
              <span className="notice__icon">i</span>
              <div>
                <strong className="notice__title">Recuerda</strong>
                <span className="notice__body">
                  TodosGanamos es una comunidad de pronosticos. No se apuesta dinero real.
                </span>
              </div>
            </div>

            <div className="publish__tips">
              <h4 className="side-section__title">Tips de la comunidad</h4>
              <ul>
                <li>Explica el por que, no solo el que.</li>
                <li>Apunta a pronosticos con cuotas entre 1.40 y 2.50.</li>
                <li>Se honesto con tu nivel de confianza.</li>
                <li>Publica antes del inicio del evento.</li>
              </ul>
            </div>
          </aside>
        </div>
      </main>
    </TodosGanamosShell>
  );
}
