/* eslint-disable @next/next/no-img-element */

import CountUp from "@/components/home/CountUp";

type CommunityStatsCardProps = {
  totalUsers: number;
  latestUsers: Array<{
    id: string;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: string;
  }>;
  error?: boolean;
};

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "hace 1 min";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  if (hours < 48) return "ayer";

  return `hace ${Math.floor(hours / 24)} días`;
}

function initialsFor(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "TG"
  );
}

export function CommunityStatsCard({
  totalUsers,
  latestUsers,
  error = false,
}: CommunityStatsCardProps) {
  const visibleUsers = latestUsers.slice(0, 2);

  return (
    <article className="community-card">
      <span className="community-card__badge">
        <span className="community-card__dot" />
        Compañeros activos
      </span>

      {error ? (
        <div className="community-card__state">
          <h3>Comunidad creciendo</h3>
          <p>No se pudieron cargar los últimos usuarios.</p>
        </div>
      ) : (
        <>
          <div className="community-card__total">
            <strong>
              <CountUp
                from={0}
                to={totalUsers}
                separator="."
                direction="up"
                duration={2.4}
                className="community-card__count"
                waitForAgeGate
              />
            </strong>
            <span>usuarios registrados</span>
          </div>

          <div className="community-card__divider" />

          <div className="community-card__head">
            <h3>Últimos en unirse</h3>
          </div>

          {visibleUsers.length > 0 ? (
            <ul className="community-card__list">
              {visibleUsers.map((user) => {
                const label = user.displayName?.trim() || `@${user.username}`;
                return (
                  <li className="community-card__user" key={user.id}>
                    <span className="community-card__avatar">
                      {user.avatarUrl ? (
                        <img alt="" src={user.avatarUrl} />
                      ) : (
                        initialsFor(label.replace(/^@/, ""))
                      )}
                    </span>
                    <span className="community-card__name">{label}</span>
                    <span className="community-card__time">{formatRelativeTime(user.createdAt)}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="community-card__empty">
              <strong>Todavía no hay usuarios registrados.</strong>
              <span>Sé el primero en unirte.</span>
            </div>
          )}
        </>
      )}
    </article>
  );
}
