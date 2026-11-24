import { useEffect, useState, useCallback, useRef } from "react";
import { getStoredUser, getToken, logout, setStoredUser, fetchSession } from "../shared/api/auth";
import { getAdminDateRange } from "../shared/lib/reportCalendar";
import { fetchSummary } from "../shared/api/summary";
import { fetchWorkers } from "../shared/api/workers";
import {
  fetchWorkerDailyStatsVisibility,
  updateWorkerDailyStatsVisibility,
} from "../shared/api/appSettings";
import { fetchWorkerContext, fetchWorkerDashboard } from "../shared/api/worker";
import { fetchSites } from "../shared/api/sites";
import { fetchSyncStatus } from "../shared/api/sync";
import { fetchGamNetworks } from "../shared/api/gamNetworks";
import { readAdminActiveGamNetworkCode, writeAdminActiveGamNetworkCode } from "../shared/lib/adminActiveNetwork";
import { toUserErrorMessage } from "../shared/lib/uiError";
import GamNetworksModule from "../features/admin/components/GamNetworksModule";
import LoginForm from "../features/auth/components/LoginForm";
import SummaryCards from "../features/admin/components/SummaryCards";
import WorkersList from "../features/admin/components/WorkersList";
import WorkerDashboard from "../features/worker/components/WorkerDashboard";
import AdminProfile from "../features/admin/components/AdminProfile";
import SectionHeader from "../components/SectionHeader";
import ThemeToggle from "../components/ThemeToggle";
import {
  LayoutDashboard,
  Users,
  Network,
  UserCircle2,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const ADMIN_RANGE_LABELS = {
  today: "Hoy",
  yesterday: "Ayer",
  last7Days: "Últimos 7 días",
  currentMonth: "Este mes (hasta hoy)",
  fullCalendarMonth: "Mes calendario completo",
};
const ADMIN_CACHE_TTL_MS = 60 * 1000;
const WORKER_DOMAIN_STORAGE_PREFIX = "workerDashboardSelectedDomain";
const WORKER_TAB_STORAGE_PREFIX = "workerDashboardActiveTab";

const ADMIN_MENU_OPTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "workers", label: "Trabajadores", icon: Users },
  { id: "network-codes", label: "Codigos de red", icon: Network },
  { id: "profile", label: "Perfil", icon: UserCircle2 },
];

const ADMIN_ACTIVE_MODULE_STORAGE_KEY = "adminActiveModule";

function readStoredAdminActiveModule() {
  if (typeof window === "undefined") return "dashboard";
  const stored = window.sessionStorage.getItem(ADMIN_ACTIVE_MODULE_STORAGE_KEY);
  if (!stored) return "dashboard";
  return ADMIN_MENU_OPTIONS.some((o) => o.id === stored) ? stored : "dashboard";
}

/** Unique subdomain strings assigned to the worker (same host may exist on multiple GAM networks internally). */
function getWorkerDomains(context) {
  const raw = (context?.properties || []).filter((p) => p.type === "domain").map((p) => p.value);
  return [...new Set(raw.map((v) => String(v || "").trim()).filter(Boolean))];
}

function getWorkerDomainStorageKey(workerId) {
  return `${WORKER_DOMAIN_STORAGE_PREFIX}:${workerId || "unknown"}`;
}

function formatUserDateLabel(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("es-ES", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const parts = formatter.formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value || "";
  const day = parts.find((p) => p.type === "day")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  const monthCapitalized = month ? month.charAt(0).toUpperCase() + month.slice(1) : "";
  return `${monthCapitalized} ${day}, ${year}`;
}

function formatSyncStatusLabel(lastSyncedAt) {
  if (!lastSyncedAt) {
    return "Última sincronización Ad Manager: pendiente";
  }
  const date = parseSyncTimestamp(lastSyncedAt);
  if (Number.isNaN(date.getTime())) {
    return "Última sincronización Ad Manager: pendiente";
  }
  const formatted = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `Última sincronización Ad Manager: ${formatted}`;
}

function parseSyncTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return new Date(NaN);
  // SQLite datetime('now') stores UTC without timezone suffix (e.g. "2026-05-05 18:19:00").
  // Interpret it as UTC explicitly so users see the correct local time conversion.
  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)) {
    return new Date(raw.replace(" ", "T") + "Z");
  }
  return new Date(raw);
}

function isAuthSessionError(message) {
  const text = String(message || "");
  return (
    text === "401" ||
    text.includes("credenciales fueron cambiadas") ||
    text.includes("SESSION_REVOKED_PROFILE")
  );
}

function noticeAfterForcedLogout(message) {
  const text = String(message || "").trim();
  if (!text || text.includes("SESSION_REVOKED_PROFILE")) return null;
  return text;
}

export default function App() {
  const [user, setUser] = useState(() => {
    const u = getStoredUser();
    if (u && !getToken()) {
      logout();
      return null;
    }
    return u;
  });
  const [sessionNotice, setSessionNotice] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [adminDashboardRange, setAdminDashboardRange] = useState("today");
  const [adminReady, setAdminReady] = useState(false);
  const [error, setError] = useState(null);
  const [workerMetricsLoading, setWorkerMetricsLoading] = useState(false);
  const [workerMetricsError, setWorkerMetricsError] = useState(null);
  const [workerSelectedDomain, setWorkerSelectedDomain] = useState(null);
  const [adminActiveNetworkCode, setAdminActiveNetworkCode] = useState(() =>
    readAdminActiveGamNetworkCode(),
  );
  const [currentDateLabel, setCurrentDateLabel] = useState(() => formatUserDateLabel());
  const [syncStatus, setSyncStatus] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [adminActiveModule, setAdminActiveModule] = useState(() => {
    const u = getStoredUser();
    if (u?.role !== "admin") return "dashboard";
    return readStoredAdminActiveModule();
  });
  const [workerFormOpenRequestId, setWorkerFormOpenRequestId] = useState(0);
  const [workerEditLaunch, setWorkerEditLaunch] = useState({ id: null, nonce: 0 });
  const adminDashboardCacheRef = useRef(new Map());
  const workerValidDomainsRef = useRef([]);
  const adminActiveNetworkCodeRef = useRef(adminActiveNetworkCode);
  const workerContextReqSeqRef = useRef(0);
  const loadInitialSeqRef = useRef(0);

  const handleLogout = useCallback((noticeMessage = null) => {
    const notice = noticeAfterForcedLogout(noticeMessage);
    logout();
    if (notice) setSessionNotice(notice);
    setUser(null);
    setData(null);
    setAdminReady(false);
    setWorkerMetricsLoading(false);
    setWorkerMetricsError(null);
    setWorkerSelectedDomain(null);
    setSyncStatus(null);
    workerValidDomainsRef.current = [];
    setAdminActiveNetworkCode(readAdminActiveGamNetworkCode());
    setWorkerFormOpenRequestId(0);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ADMIN_ACTIVE_MODULE_STORAGE_KEY);
      const tabPrefix = `${WORKER_TAB_STORAGE_PREFIX}:`;
      for (let i = window.sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith(tabPrefix)) {
          window.sessionStorage.removeItem(key);
        }
      }
    }
    adminDashboardCacheRef.current.clear();
  }, []);

  function adminDashCacheKey(rangeKey) {
    const net = adminActiveNetworkCodeRef.current || "_";
    return `${net}|${rangeKey}`;
  }

  function getCachedDashboardSummary(rangeKey) {
    const entry = adminDashboardCacheRef.current.get(adminDashCacheKey(rangeKey));
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ADMIN_CACHE_TTL_MS) {
      adminDashboardCacheRef.current.delete(adminDashCacheKey(rangeKey));
      return null;
    }
    return entry.summary;
  }

  function setCachedDashboardSummary(rangeKey, summary) {
    adminDashboardCacheRef.current.set(adminDashCacheKey(rangeKey), {
      summary,
      cachedAt: Date.now(),
    });
  }

  useEffect(() => {
    adminActiveNetworkCodeRef.current = adminActiveNetworkCode;
  }, [adminActiveNetworkCode]);

  const loadWorkerMetrics = useCallback(
    async (domain, allowedDomains = null) => {
      if (!user || user.role !== "worker") return;
      const validDomains = Array.isArray(allowedDomains)
        ? allowedDomains
        : workerValidDomainsRef.current;
      if (validDomains.length === 0) return;
      let targetDomain = domain;
      if (!targetDomain || !validDomains.includes(targetDomain)) {
        targetDomain = validDomains[0];
      }
      if (!targetDomain) return;
      setWorkerMetricsError(null);
      setWorkerMetricsLoading(true);
      try {
        const metrics = await fetchWorkerDashboard({ domain: targetDomain });
        setData((prev) => ({ ...prev, workerMetrics: metrics }));
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else if (rawMessage.includes("cuenta de trabajador fue eliminada")) {
          handleLogout(rawMessage);
        } else if (rawMessage.includes("subdominio solicitado no está asignado")) {
          try {
            const ctx = await fetchWorkerContext();
            const domains = getWorkerDomains(ctx);
            const fallbackDomain = domains[0] || null;
            setData((prev) => ({ ...prev, workerContext: ctx }));
            setWorkerSelectedDomain(fallbackDomain);
            if (fallbackDomain) {
              const metrics = await fetchWorkerDashboard({ domain: fallbackDomain });
              setData((prev) => ({ ...prev, workerMetrics: metrics }));
            }
          } catch {
            setWorkerMetricsError("No se pudieron cargar métricas del subdominio seleccionado");
          }
        } else {
          setWorkerMetricsError(toUserErrorMessage(err, "No se pudieron cargar las métricas."));
        }
      } finally {
        setWorkerMetricsLoading(false);
      }
    },
    [user, handleLogout],
  );

  const loadInitial = useCallback(async () => {
    if (!user) return;
    const seq = ++loadInitialSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      if (!getToken()) {
        handleLogout();
        return;
      }
      try {
        const session = await fetchSession();
        if (seq !== loadInitialSeqRef.current) return;
        const sid = Number(session?.userId);
        const uid = Number(user.id);
        if (!Number.isFinite(sid) || !Number.isFinite(uid) || sid !== uid) {
          handleLogout("Tu sesión no coincide con los datos guardados. Inicia sesión de nuevo.");
          return;
        }
        if (session?.role !== user.role) {
          handleLogout("Tu sesión no coincide con los datos guardados. Inicia sesión de nuevo.");
          return;
        }
      } catch {
        if (seq !== loadInitialSeqRef.current) return;
        handleLogout(
          "Tu sesión expiró o ya no es válida. Inicia sesión de nuevo.",
        );
        return;
      }
      if (seq !== loadInitialSeqRef.current) return;

      if (user.role === "admin") {
        const gamNetList = await fetchGamNetworks();
        if (seq !== loadInitialSeqRef.current) return;
        let activeCode = readAdminActiveGamNetworkCode();
        const codes = (gamNetList || []).map((n) => n.networkCode);
        if (!activeCode || !codes.includes(activeCode)) {
          activeCode =
            (gamNetList || []).find((n) => n.isDefault)?.networkCode || codes[0] || null;
        }
        if (activeCode) writeAdminActiveGamNetworkCode(activeCode);
        setAdminActiveNetworkCode(activeCode);
        adminActiveNetworkCodeRef.current = activeCode;

        const range = getAdminDateRange("today");
        const netOpts = { networkCode: activeCode || undefined };
        const [summary, workers, sites, sync, dailyStatsVisibility] = await Promise.all([
          fetchSummary({ ...range, ...netOpts }),
          fetchWorkers({ includeDeleted: true, ...netOpts }),
          fetchSites(netOpts),
          fetchSyncStatus(netOpts).catch(() => null),
          fetchWorkerDailyStatsVisibility(),
        ]);
        if (seq !== loadInitialSeqRef.current) return;
        setCachedDashboardSummary("today", summary);
        setData({
          summary,
          workers,
          sites,
          gamNetworks: gamNetList,
          workerDailyStatsEnabled: dailyStatsVisibility.enabled,
        });
        setSyncStatus(sync);
        setAdminReady(true);

        const remainingRanges = ["yesterday", "last7Days", "currentMonth", "fullCalendarMonth"];
        remainingRanges.forEach((rangeKey) => {
          if (getCachedDashboardSummary(rangeKey) != null) return;
          const r = getAdminDateRange(rangeKey);
          fetchSummary({ ...r, ...netOpts })
            .then((s) => {
              setCachedDashboardSummary(rangeKey, s);
            })
            .catch(() => {});
        });
      } else {
        const context = await fetchWorkerContext();
        if (seq !== loadInitialSeqRef.current) return;
        const domains = getWorkerDomains(context);
        let initialDomain = domains[0] || null;
        if (typeof window !== "undefined" && context?.workerId) {
          const savedDomain = window.localStorage.getItem(getWorkerDomainStorageKey(context.workerId));
          if (savedDomain && domains.includes(savedDomain)) {
            initialDomain = savedDomain;
          }
        }
        setData({
          workerContext: context,
          workerMetrics: null,
        });
        setWorkerSelectedDomain(initialDomain);
        setWorkerMetricsError(null);
        if (initialDomain) {
          await loadWorkerMetrics(initialDomain, domains);
          if (seq !== loadInitialSeqRef.current) return;
        }
      }
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else if (rawMessage.includes("cuenta de trabajador fue eliminada")) {
        handleLogout(rawMessage);
      } else {
        setError(toUserErrorMessage(err, "No se pudo cargar la información del panel."));
      }
    } finally {
      if (seq === loadInitialSeqRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cache helpers are stable refs; adding them would re-run the initial load
  }, [user, loadWorkerMetrics, handleLogout]);

  useEffect(() => {
    loadInitial();
    return () => {
      loadInitialSeqRef.current += 1;
    };
  }, [loadInitial]);

  useEffect(() => {
    if (typeof window === "undefined" || user?.role !== "admin") return;
    window.sessionStorage.setItem(ADMIN_ACTIVE_MODULE_STORAGE_KEY, adminActiveModule);
  }, [adminActiveModule, user?.role]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    const timer = window.setInterval(async () => {
      try {
        const status = adminActiveNetworkCode
          ? await fetchSyncStatus({ networkCode: adminActiveNetworkCode })
          : await fetchSyncStatus();
        setSyncStatus(status);
      } catch {
        // Keep last known sync status during transient errors.
      }
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [user, user?.role, adminActiveNetworkCode]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    if (adminActiveModule !== "workers") {
      setWorkerFormOpenRequestId(0);
    }
  }, [adminActiveModule, user?.role]);

  useEffect(() => {
    setCurrentDateLabel(formatUserDateLabel());
    const timer = window.setInterval(() => {
      setCurrentDateLabel(formatUserDateLabel());
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (user?.role === "admin" && adminMenuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
    document.body.style.overflow = "";
  }, [adminMenuOpen, user?.role]);

  useEffect(() => {
    async function refreshDashboardByRange() {
      if (!user || user.role !== "admin" || !adminReady) return;
      const cached = getCachedDashboardSummary(adminDashboardRange);
      if (cached != null) {
        setData((prev) => ({ ...prev, summary: cached }));
        return;
      }
      setRefreshingAdmin(true);
      setError(null);
      try {
        const range = getAdminDateRange(adminDashboardRange);
        const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
        const summary = await fetchSummary({ ...range, ...net });
        setCachedDashboardSummary(adminDashboardRange, summary);
        setData((prev) => ({ ...prev, summary }));
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else setError(toUserErrorMessage(err, "No se pudo actualizar el resumen."));
      } finally {
        setRefreshingAdmin(false);
      }
    }
    refreshDashboardByRange();
  }, [adminDashboardRange, adminActiveNetworkCode, user, adminReady, handleLogout]);

  // Keep ref in sync so loadWorkerMetrics always has current valid domains
  // without needing data in its dependency array (which would cause re-render loops).
  useEffect(() => {
    workerValidDomainsRef.current = getWorkerDomains(data?.workerContext);
  }, [data?.workerContext]);

  useEffect(() => {
    if (!user || user.role !== "worker" || typeof window === "undefined") return;
    const workerId = data?.workerContext?.workerId;
    if (!workerId) return;
    const storageKey = getWorkerDomainStorageKey(workerId);
    if (workerSelectedDomain) {
      window.localStorage.setItem(storageKey, workerSelectedDomain);
    } else {
      window.localStorage.removeItem(storageKey);
    }
  }, [user, workerSelectedDomain, data?.workerContext?.workerId]);

  const refreshAdminWorkers = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const dashRangeObj = getAdminDateRange(adminDashboardRange);
      const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
      const [workers, summary] = await Promise.all([
        fetchWorkers({ includeDeleted: true, ...net }),
        fetchSummary({ ...dashRangeObj, ...net }),
      ]);
      setCachedDashboardSummary(adminDashboardRange, summary);
      setData((prev) => ({ ...prev, workers, summary }));
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else
        setError(toUserErrorMessage(err, "No se pudo actualizar la información de trabajadores."));
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminDashboardRange, adminActiveNetworkCode, handleLogout]);

  const handleAdminNetworkChange = useCallback(
    async (nextCode) => {
      if (!nextCode || user?.role !== "admin" || !adminReady) return;
      writeAdminActiveGamNetworkCode(nextCode);
      setAdminActiveNetworkCode(nextCode);
      adminActiveNetworkCodeRef.current = nextCode;
      adminDashboardCacheRef.current.clear();
      setRefreshingAdmin(true);
      setError(null);
      try {
        const dashRangeObj = getAdminDateRange(adminDashboardRange);
        const net = { networkCode: nextCode };
        const [workers, summary, sites, sync] = await Promise.all([
          fetchWorkers({ includeDeleted: true, ...net }),
          fetchSummary({ ...dashRangeObj, ...net }),
          fetchSites(net),
          fetchSyncStatus(net).catch(() => null),
        ]);
        setCachedDashboardSummary(adminDashboardRange, summary);
        setData((prev) => ({ ...prev, workers, summary, sites }));
        setSyncStatus(sync);
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else setError(toUserErrorMessage(err, "No se pudo cambiar el contexto de red."));
      } finally {
        setRefreshingAdmin(false);
      }
    },
    [user, adminReady, adminDashboardRange, handleLogout],
  );

  const refreshWorkerContext = useCallback(async () => {
    if (!user || user.role !== "worker") return;
    const reqSeq = ++workerContextReqSeqRef.current;
    try {
      const ctx = await fetchWorkerContext();
      if (workerContextReqSeqRef.current !== reqSeq) return;
      const domains = getWorkerDomains(ctx);
      const stillValid = workerSelectedDomain && domains.includes(workerSelectedDomain);
      const nextDomain = stillValid ? workerSelectedDomain : domains[0] || null;
      setWorkerSelectedDomain(nextDomain);
      setData((prev) => ({ ...prev, workerContext: ctx }));
      setError(null);
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else if (rawMessage.includes("cuenta de trabajador fue eliminada")) handleLogout(rawMessage);
      // No elevamos este error al estado global para no romper la UI del worker
      // por fallos transitorios del refresco liviano de contexto.
    }
  }, [user, workerSelectedDomain, handleLogout]);

  useEffect(() => {
    if (!user || user.role !== "worker" || !data?.workerContext?.workerId) return;
    const timer = window.setInterval(() => {
      refreshWorkerContext();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [user, data?.workerContext?.workerId, refreshWorkerContext]);

  function handleLogin(loggedUser) {
    setSessionNotice(null);
    // Reset any worker-specific state from a previous session so stale domains
    // never leak into the incoming session.
    setData(null);
    setWorkerSelectedDomain(null);
    workerValidDomainsRef.current = [];
    setAdminMenuOpen(false);
    setAdminActiveModule("dashboard");
    setWorkerFormOpenRequestId(0);
    setSyncStatus(null);
    setUser(loggedUser);
  }

  if (!user) return <LoginForm onLogin={handleLogin} notice={sessionNotice} />;

  const activeAdminModule =
    ADMIN_MENU_OPTIONS.find((item) => item.id === adminActiveModule) || ADMIN_MENU_OPTIONS[0];

  if (user.role === "admin") {
    return (
      <div className="app app--admin">
        <aside
          className={`admin-sidebar ${adminMenuOpen ? "open" : ""}`}
          aria-label="Navegación de administrador"
        >
          <div className="admin-sidebar-brand">XerviaLinks Metrics</div>

          <div className="admin-sidebar-mobile-top">
            <span className="admin-sidebar-mobile-brand">XerviaLinks Metrics</span>
            <button
              type="button"
              className="admin-sidebar-close"
              aria-label="Cerrar menú"
              onClick={() => setAdminMenuOpen(false)}
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          <nav className="admin-sidebar-nav">
            {ADMIN_MENU_OPTIONS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === adminActiveModule;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-sidebar-item ${isActive ? "active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => {
                    setAdminActiveModule(item.id);
                    if (item.id !== "workers") {
                      setWorkerEditLaunch((prev) => ({ ...prev, id: null }));
                    }
                    setAdminMenuOpen(false);
                  }}
                >
                  <Icon size={17} aria-hidden />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-user">
              <span className="header-user-name">{user.name}</span>
              <span className="role-badge">Administrador</span>
            </div>
            <button
              type="button"
              className="admin-sidebar-logout"
              onClick={() => {
                setAdminMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut size={16} aria-hidden />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </aside>

        {adminMenuOpen && (
          <button
            type="button"
            className="admin-sidebar-overlay"
            aria-label="Cerrar menú lateral"
            onClick={() => setAdminMenuOpen(false)}
          />
        )}

        <div className="admin-main-shell">
          <header className="app-header app-header--admin">
            <button
              type="button"
              className="admin-mobile-menu-btn"
              aria-label="Abrir menú"
              onClick={() => setAdminMenuOpen(true)}
            >
              <Menu size={18} aria-hidden />
            </button>
            <div className="header-title-group">
              <h1>{activeAdminModule.label}</h1>
              <p className="app-current-date">{currentDateLabel}</p>
            </div>
            <div className="header-right">
              <div className="header-sync-theme-row">
                {(data?.gamNetworks || []).length > 0 ? (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground max-w-[min(100%,220px)]">
                    <span className="shrink-0">Red:</span>
                    <select
                      className="form-select admin-range-select py-1 text-xs max-w-[160px]"
                      value={adminActiveNetworkCode || ""}
                      onChange={(e) => handleAdminNetworkChange(e.target.value)}
                      aria-label="Red Ad Manager activa"
                    >
                      {(data?.gamNetworks || []).map((n) => (
                        <option key={n.networkCode} value={n.networkCode}>
                          {n.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <p className="app-sync-status">
                  {formatSyncStatusLabel(
                    syncStatus?.activeNetworkLastSyncedAt || syncStatus?.lastSyncedAt,
                  )}
                </p>
                <ThemeToggle />
                {(loading || refreshingAdmin) && (
                  <div className="header-progress" aria-hidden="true" />
                )}
              </div>
            </div>
          </header>

          <main className="app-main">
            {loading && <p className="status-msg">Cargando dashboard…</p>}
            {error && <p className="status-msg error">{error}</p>}
            {!loading && data && (
              <AdminDashboard
                data={data}
                user={user}
                isRefreshing={refreshingAdmin}
                onWorkersUpdate={refreshAdminWorkers}
                adminDashboardRange={adminDashboardRange}
                onChangeAdminDashboardRange={setAdminDashboardRange}
                activeModule={adminActiveModule}
                adminActiveNetworkCode={adminActiveNetworkCode}
                onGamNetworksUpdated={async () => {
                  try {
                    const list = await fetchGamNetworks();
                    setData((prev) => ({ ...prev, gamNetworks: list }));
                  } catch {
                    /* ignore */
                  }
                }}
                workerFormOpenRequestId={workerFormOpenRequestId}
                onAddWorkerFromDashboard={() => {
                  setAdminActiveModule("workers");
                  setWorkerFormOpenRequestId((n) => n + 1);
                }}
                workerEditLaunchId={workerEditLaunch.id}
                workerEditLaunchNonce={workerEditLaunch.nonce}
                onNavigateToWorkerEdit={(workerId) => {
                  setAdminActiveModule("workers");
                  setWorkerEditLaunch((prev) => ({
                    id: workerId,
                    nonce: prev.nonce + 1,
                  }));
                }}
                onAdminUserUpdated={(partial) => {
                  setUser((prev) => {
                    if (!prev) return prev;
                    const next = { ...prev, ...partial };
                    setStoredUser(next);
                    return next;
                  });
                }}
                onForceLogout={handleLogout}
                onWorkerDailyStatsVisibilityChange={async (enabled) => {
                  const setting = await updateWorkerDailyStatsVisibility(enabled);
                  setData((prev) => ({
                    ...prev,
                    workerDailyStatsEnabled: setting.enabled,
                  }));
                }}
                workerDailyStatsEnabled={data.workerDailyStatsEnabled}
              />
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app app--worker">
      <header className="app-header app-header--worker">
        <div className="header-title-group">
          <h1 className="worker-header-brand">XerviaLinks Metrics</h1>
          <p className="app-current-date">{currentDateLabel}</p>
        </div>
        <div className="header-right header-right--worker">
          <ThemeToggle />
          <div className="header-user">
            <div className="header-user-info">
              <span className="header-user-name">{user.name}</span>
              <span className="role-badge">Trabajador</span>
            </div>
            <button
              type="button"
              className="btn-logout btn-logout-icon"
              onClick={() => handleLogout()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <WorkerDashboard
          workerContext={data?.workerContext ?? null}
          dailyStatsEnabled={data?.workerContext?.dailyStatsEnabled}
          workerMetrics={data?.workerMetrics ?? null}
          selectedDomain={workerSelectedDomain}
          onDomainChange={async (nextDomain) => {
            setWorkerSelectedDomain(nextDomain);
            await loadWorkerMetrics(nextDomain, getWorkerDomains(data?.workerContext));
          }}
          contextLoading={loading}
          metricsLoading={workerMetricsLoading}
          metricsError={workerMetricsError}
          error={error}
          workerId={data?.workerContext?.workerId ?? null}
        />
      </main>
    </div>
  );
}
function AdminDashboard({
  data,
  user,
  isRefreshing = false,
  onWorkersUpdate,
  adminDashboardRange,
  onChangeAdminDashboardRange,
  activeModule,
  adminActiveNetworkCode,
  onGamNetworksUpdated,
  workerFormOpenRequestId,
  onAddWorkerFromDashboard,
  workerEditLaunchId,
  workerEditLaunchNonce,
  onNavigateToWorkerEdit,
  onAdminUserUpdated,
  onForceLogout,
  workerDailyStatsEnabled,
  onWorkerDailyStatsVisibilityChange,
}) {
  const { summary, workers, sites, gamNetworks = [] } = data;
  const [updatingDailyStatsVisibility, setUpdatingDailyStatsVisibility] = useState(false);
  const [dailyStatsVisibilityError, setDailyStatsVisibilityError] = useState("");

  const activeWorkers = (workers || []).filter((w) => !w.deleted_at);

  async function toggleWorkerDailyStatsVisibility() {
    setDailyStatsVisibilityError("");
    setUpdatingDailyStatsVisibility(true);
    try {
      await onWorkerDailyStatsVisibilityChange(!workerDailyStatsEnabled);
    } catch (err) {
      setDailyStatsVisibilityError(
        toUserErrorMessage(err, "No se pudo actualizar la visibilidad de las estadísticas."),
      );
    } finally {
      setUpdatingDailyStatsVisibility(false);
    }
  }

  if (activeModule === "workers") {
    return (
      <>
        <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Tabla de métricas para trabajadores
              </p>
              <p className="text-xs text-muted-foreground">
                Permite a los trabajadores ver la tabla diaria de métricas de sus subdominios.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={workerDailyStatsEnabled}
              aria-label="Tabla de métricas para trabajadores"
              disabled={updatingDailyStatsVisibility}
              onClick={toggleWorkerDailyStatsVisibility}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                workerDailyStatsEnabled
                  ? "border-transparent bg-gradient-to-r from-primary to-secondary"
                  : "border-border bg-muted"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 rounded-full border border-border bg-background shadow-sm transition-transform duration-200 ease-in-out ${
                  workerDailyStatsEnabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {dailyStatsVisibilityError && (
            <p className="status-msg error mt-2" role="alert">
              {dailyStatsVisibilityError}
            </p>
          )}
        </div>
        <WorkersList
          workers={workers}
          sites={sites}
          activeNetworkCode={adminActiveNetworkCode}
          gamNetworks={gamNetworks}
          onUpdate={onWorkersUpdate}
          mode="management"
          workerFormOpenRequestId={workerFormOpenRequestId}
          autoEditWorkerId={workerEditLaunchId}
          autoEditNonce={workerEditLaunchNonce}
        />
      </>
    );
  }

  if (activeModule === "profile") {
    return (
      <AdminProfile user={user} onUserUpdated={onAdminUserUpdated} onForceLogout={onForceLogout} />
    );
  }

  if (activeModule === "network-codes") {
    return <GamNetworksModule onNetworksChanged={onGamNetworksUpdated} />;
  }

  if (activeModule !== "dashboard") {
    return (
      <section>
        <h2>Perfil</h2>
        <p className="empty-state">Módulo en construcción.</p>
      </section>
    );
  }

  return (
    <>
      <section>
        <div className="admin-range-row">
          <select
            className="form-select admin-range-select"
            value={adminDashboardRange}
            onChange={(e) => onChangeAdminDashboardRange(e.target.value)}
            aria-label="Rango de fechas para el resumen del dashboard"
          >
            {Object.entries(ADMIN_RANGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <SectionHeader title="Resumen" />
        <SummaryCards summary={summary} isLoading={isRefreshing} />
      </section>

      <section>
        <SectionHeader title="Trabajadores" />
        {activeWorkers.length === 0 ? (
          <div className="admin-dashboard-workers-empty">
            <p className="empty-state">
              Aún no hay trabajadores activos. Crea el primero para asignar subdominios y
              compartir sus métricas.
            </p>
            <button
              type="button"
              className="btn workers-module-add-btn w-full sm:w-auto"
              onClick={() => onAddWorkerFromDashboard?.()}
            >
              Agregar trabajador
            </button>
          </div>
        ) : (
        <WorkersList
          workers={activeWorkers}
          sites={sites}
          activeNetworkCode={adminActiveNetworkCode}
          gamNetworks={gamNetworks}
          onUpdate={onWorkersUpdate}
          mode="dashboard"
          onNavigateToWorkerEdit={onNavigateToWorkerEdit}
        />
        )}
      </section>
    </>
  );
}
