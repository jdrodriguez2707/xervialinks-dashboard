import { useEffect, useState, useCallback, useRef } from "react";
import { getStoredUser, logout, setStoredUser } from "../shared/api/auth";
import { getAdminDateRange } from "../shared/lib/reportCalendar";
import { fetchSummary } from "../shared/api/summary";
import { fetchWorkers } from "../shared/api/workers";
import { fetchPayouts, fetchPaymentHistory } from "../shared/api/payouts";
import {
  fetchWorkerContext,
  fetchWorkerDashboard,
  fetchWorkerPaymentHistory,
} from "../shared/api/worker";
import { fetchSites } from "../shared/api/sites";
import { fetchSyncStatus } from "../shared/api/sync";
import { toUserErrorMessage } from "../shared/lib/uiError";
import LoginForm from "../features/auth/components/LoginForm";
import SummaryCards from "../features/admin/components/SummaryCards";
import PayoutsTable from "../features/admin/components/PayoutsTable";
import PaymentHistoryTable from "../features/admin/components/PaymentHistoryTable";
import WorkersList from "../features/admin/components/WorkersList";
import WorkerDashboard from "../features/worker/components/WorkerDashboard";
import AdminProfile from "../features/admin/components/AdminProfile";
import SectionHeader from "../components/SectionHeader";
import {
  LayoutDashboard,
  Wallet,
  Banknote,
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
  currentMonth: "Este mes",
};
const ADMIN_CACHE_TTL_MS = 60 * 1000;
const WORKER_DOMAIN_STORAGE_PREFIX = "workerDashboardSelectedDomain";
const WORKER_TAB_STORAGE_PREFIX = "workerDashboardActiveTab";

const ADMIN_MENU_OPTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "earnings", label: "Ganancias", icon: Wallet },
  { id: "payment-history", label: "Historial de pagos", icon: Banknote },
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

function getWorkerDomains(context) {
  return (context?.properties || []).filter((p) => p.type === "domain").map((p) => p.value);
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

function getDefaultPaymentMonth(date = new Date()) {
  const target = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const month = String(target.getMonth() + 1).padStart(2, "0");
  return `${target.getFullYear()}-${month}`;
}

function formatSyncStatusLabel(lastSyncedAt, mode = "admin") {
  if (!lastSyncedAt) {
    return mode === "worker"
      ? "Última actualización: pendiente"
      : "Última sincronización Ad Manager: pendiente";
  }
  const date = parseSyncTimestamp(lastSyncedAt);
  if (Number.isNaN(date.getTime())) {
    return mode === "worker"
      ? "Última actualización: pendiente"
      : "Última sincronización Ad Manager: pendiente";
  }
  const formatted = new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return mode === "worker"
    ? `Última actualización: ${formatted}`
    : `Última sincronización Ad Manager: ${formatted}`;
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
  return text === "401" || text.includes("credenciales fueron cambiadas");
}

export default function App() {
  const [user, setUser] = useState(() => getStoredUser());
  const [sessionNotice, setSessionNotice] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [refreshingAdmin, setRefreshingAdmin] = useState(false);
  const [adminDashboardRange, setAdminDashboardRange] = useState("today");
  const [adminEarningsRange, setAdminEarningsRange] = useState("today");
  const [adminPaymentMonth, setAdminPaymentMonth] = useState(() => getDefaultPaymentMonth());
  const [workerPaymentMonth, setWorkerPaymentMonth] = useState(() => getDefaultPaymentMonth());
  const [workerHistoryPaymentMonth, setWorkerHistoryPaymentMonth] = useState(() =>
    getDefaultPaymentMonth(),
  );
  const [adminReady, setAdminReady] = useState(false);
  const [error, setError] = useState(null);
  const [workerMetricsLoading, setWorkerMetricsLoading] = useState(false);
  const [workerMetricsError, setWorkerMetricsError] = useState(null);
  const [workerSelectedDomain, setWorkerSelectedDomain] = useState(null);
  const [currentDateLabel, setCurrentDateLabel] = useState(() => formatUserDateLabel());
  const [syncStatus, setSyncStatus] = useState(null);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [adminActiveModule, setAdminActiveModule] = useState(() => {
    const u = getStoredUser();
    if (u?.role !== "admin") return "dashboard";
    return readStoredAdminActiveModule();
  });
  const [workerFormOpenRequestId, setWorkerFormOpenRequestId] = useState(0);
  const [highlightedEarningsWorkerId, setHighlightedEarningsWorkerId] = useState(null);
  const [workerEditLaunch, setWorkerEditLaunch] = useState({ id: null, nonce: 0 });
  const adminDashboardCacheRef = useRef(new Map());
  const adminEarningsCacheRef = useRef(new Map());
  const workerValidDomainsRef = useRef([]);
  const workerPaymentMonthRef = useRef(getDefaultPaymentMonth());
  const workerHistoryPaymentMonthRef = useRef(getDefaultPaymentMonth());
  const lastDefaultPaymentMonthRef = useRef(getDefaultPaymentMonth());
  const workerContextReqSeqRef = useRef(0);

  function getCachedDashboardSummary(rangeKey) {
    const entry = adminDashboardCacheRef.current.get(rangeKey);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ADMIN_CACHE_TTL_MS) {
      adminDashboardCacheRef.current.delete(rangeKey);
      return null;
    }
    return entry.summary;
  }

  function setCachedDashboardSummary(rangeKey, summary) {
    adminDashboardCacheRef.current.set(rangeKey, {
      summary,
      cachedAt: Date.now(),
    });
  }

  function getCachedEarningsPayouts(rangeKey) {
    const entry = adminEarningsCacheRef.current.get(rangeKey);
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ADMIN_CACHE_TTL_MS) {
      adminEarningsCacheRef.current.delete(rangeKey);
      return null;
    }
    return entry.payouts;
  }

  function setCachedEarningsPayouts(rangeKey, payouts) {
    adminEarningsCacheRef.current.set(rangeKey, {
      payouts,
      cachedAt: Date.now(),
    });
  }

  const loadWorkerMetrics = useCallback(
    async (domain, allowedDomains = null) => {
      if (!user || user.role !== "worker") return;
      const validDomains = Array.isArray(allowedDomains)
        ? allowedDomains
        : workerValidDomainsRef.current;
      // Sin dominios permitidos nunca pedimos métricas. Si la lista está vacía pero llega
      // un `domain` residual (otra sesión / estado viejo), antes se enviaba igual → 400.
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
            const ctx = await fetchWorkerContext({
              paymentMonth: workerPaymentMonthRef.current,
            });
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
    [user],
  );

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      if (user.role === "admin") {
        const range = getAdminDateRange("today");
        const [summary, workers, payouts, paymentHistory, sites, sync] = await Promise.all([
          fetchSummary(range),
          fetchWorkers({ includeDeleted: true, paymentMonth: adminPaymentMonth }),
          fetchPayouts(range),
          fetchPaymentHistory(),
          fetchSites(),
          fetchSyncStatus().catch(() => null),
        ]);
        setCachedDashboardSummary("today", summary);
        setCachedEarningsPayouts("today", payouts);
        setData({ summary, workers, payouts, paymentHistory, sites });
        setSyncStatus(sync);
        setAdminReady(true);

        // Warm up all remaining ranges in background so either selector switch is instant.
        const remainingRanges = ["yesterday", "last7Days", "currentMonth"];
        remainingRanges.forEach((rangeKey) => {
          if (
            getCachedDashboardSummary(rangeKey) != null &&
            getCachedEarningsPayouts(rangeKey) != null
          ) {
            return;
          }
          const r = getAdminDateRange(rangeKey);
          Promise.all([fetchSummary(r), fetchPayouts(r)])
            .then(([s, p]) => {
              setCachedDashboardSummary(rangeKey, s);
              setCachedEarningsPayouts(rangeKey, p);
            })
            .catch(() => {});
        });
      } else {
        const [context, paymentHistory, sync] = await Promise.all([
          fetchWorkerContext({ paymentMonth: workerPaymentMonth }),
          fetchWorkerPaymentHistory({ paymentMonth: workerHistoryPaymentMonth }),
          fetchSyncStatus().catch(() => null),
        ]);
        const domains = getWorkerDomains(context);
        let initialDomain = domains[0] || null;
        if (typeof window !== "undefined") {
          const savedDomain = window.localStorage.getItem(
            getWorkerDomainStorageKey(context?.workerId),
          );
          if (savedDomain && domains.includes(savedDomain)) {
            initialDomain = savedDomain;
          }
        }
        setData({
          workerContext: context,
          workerMetrics: null,
          workerPaymentHistory: paymentHistory,
        });
        setSyncStatus(sync);
        setWorkerSelectedDomain(initialDomain);
        setWorkerMetricsError(null);
        if (initialDomain) {
          await loadWorkerMetrics(initialDomain, domains);
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
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meses de pago: otros useEffect; evita recarga completa en bucle
  }, [user, loadWorkerMetrics]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  useEffect(() => {
    if (typeof window === "undefined" || user?.role !== "admin") return;
    window.sessionStorage.setItem(ADMIN_ACTIVE_MODULE_STORAGE_KEY, adminActiveModule);
  }, [adminActiveModule, user?.role]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await fetchSyncStatus();
        setSyncStatus(status);
      } catch {
        // Keep last known sync status during transient errors.
      }
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [user]);

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
      const nextDefault = getDefaultPaymentMonth();
      const previousDefault = lastDefaultPaymentMonthRef.current;
      if (nextDefault !== previousDefault) {
        if (adminPaymentMonth === previousDefault) {
          setAdminPaymentMonth(nextDefault);
        }
        if (workerPaymentMonth === previousDefault) {
          setWorkerPaymentMonth(nextDefault);
        }
        if (workerHistoryPaymentMonth === previousDefault) {
          setWorkerHistoryPaymentMonth(nextDefault);
        }
        lastDefaultPaymentMonthRef.current = nextDefault;
      }
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [adminPaymentMonth, workerPaymentMonth, workerHistoryPaymentMonth]);

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
    if (!highlightedEarningsWorkerId) return;
    const timer = window.setTimeout(() => {
      setHighlightedEarningsWorkerId(null);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [highlightedEarningsWorkerId]);

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
        const summary = await fetchSummary(range);
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
  }, [adminDashboardRange, user, adminReady]);

  useEffect(() => {
    async function refreshEarningsByRange() {
      if (!user || user.role !== "admin" || !adminReady) return;
      const cached = getCachedEarningsPayouts(adminEarningsRange);
      if (cached != null) {
        setData((prev) => ({ ...prev, payouts: cached }));
        return;
      }
      setRefreshingAdmin(true);
      setError(null);
      try {
        const range = getAdminDateRange(adminEarningsRange);
        const payouts = await fetchPayouts(range);
        setCachedEarningsPayouts(adminEarningsRange, payouts);
        setData((prev) => ({ ...prev, payouts }));
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else setError(toUserErrorMessage(err, "No se pudo actualizar la tabla de ganancias."));
      } finally {
        setRefreshingAdmin(false);
      }
    }
    refreshEarningsByRange();
  }, [adminEarningsRange, user, adminReady]);

  // Keep ref in sync so loadWorkerMetrics always has current valid domains
  // without needing data in its dependency array (which would cause re-render loops).
  useEffect(() => {
    workerValidDomainsRef.current = getWorkerDomains(data?.workerContext);
  }, [data?.workerContext]);

  useEffect(() => {
    workerPaymentMonthRef.current = workerPaymentMonth;
  }, [workerPaymentMonth]);

  useEffect(() => {
    workerHistoryPaymentMonthRef.current = workerHistoryPaymentMonth;
  }, [workerHistoryPaymentMonth]);

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

  const refreshAdminWorkersAndPayouts = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const dashRangeObj = getAdminDateRange(adminDashboardRange);
      const earnRangeObj = getAdminDateRange(adminEarningsRange);
      const [workers, payouts, summary, paymentHistory] = await Promise.all([
        fetchWorkers({ includeDeleted: true, paymentMonth: adminPaymentMonth }),
        fetchPayouts(earnRangeObj),
        fetchSummary(dashRangeObj),
        fetchPaymentHistory(),
      ]);
      setCachedDashboardSummary(adminDashboardRange, summary);
      setCachedEarningsPayouts(adminEarningsRange, payouts);
      setData((prev) => ({ ...prev, workers, payouts, summary, paymentHistory }));
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else
        setError(toUserErrorMessage(err, "No se pudo actualizar la información de trabajadores."));
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminDashboardRange, adminEarningsRange, adminPaymentMonth]);

  const refreshAdminWorkerStatusesOnly = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const [workers, paymentHistory] = await Promise.all([
        fetchWorkers({
          includeDeleted: true,
          paymentMonth: adminPaymentMonth,
        }),
        fetchPaymentHistory(),
      ]);
      setData((prev) => ({ ...prev, workers, paymentHistory }));
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else setError(toUserErrorMessage(err, "No se pudo actualizar el estado de pagos."));
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminPaymentMonth]);

  const refreshWorkerContextByPaymentMonth = useCallback(async () => {
    if (!user || user.role !== "worker") return;
    const reqSeq = ++workerContextReqSeqRef.current;
    try {
      const [ctx, paymentHistory] = await Promise.all([
        fetchWorkerContext({ paymentMonth: workerPaymentMonthRef.current }),
        fetchWorkerPaymentHistory({ paymentMonth: workerHistoryPaymentMonthRef.current }),
      ]);
      if (workerContextReqSeqRef.current !== reqSeq) return;
      const domains = getWorkerDomains(ctx);
      const stillValid = workerSelectedDomain && domains.includes(workerSelectedDomain);
      const nextDomain = stillValid ? workerSelectedDomain : domains[0] || null;
      setWorkerSelectedDomain(nextDomain);
      setData((prev) => ({ ...prev, workerContext: ctx, workerPaymentHistory: paymentHistory }));
      setError(null);
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else if (rawMessage.includes("cuenta de trabajador fue eliminada")) handleLogout(rawMessage);
      // No elevamos este error al estado global para no romper la UI del worker
      // por fallos transitorios del refresco liviano de contexto.
    }
  }, [user, workerSelectedDomain]);

  useEffect(() => {
    async function refreshWorkersPaymentStatusByMonth() {
      if (!user || user.role !== "admin" || !adminReady) return;
      setRefreshingAdmin(true);
      setError(null);
      try {
        const [workers, paymentHistory] = await Promise.all([
          fetchWorkers({
            includeDeleted: true,
            paymentMonth: adminPaymentMonth,
          }),
          fetchPaymentHistory(),
        ]);
        setData((prev) => ({ ...prev, workers, paymentHistory }));
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else setError(toUserErrorMessage(err, "No se pudo actualizar el periodo de pagos."));
      } finally {
        setRefreshingAdmin(false);
      }
    }
    refreshWorkersPaymentStatusByMonth();
  }, [adminPaymentMonth, user, adminReady]);

  useEffect(() => {
    if (!user || user.role !== "worker" || !data?.workerContext) return;
    refreshWorkerContextByPaymentMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evitar `data.workerContext` completo (re-disparos en cada refresh)
  }, [
    workerPaymentMonth,
    workerHistoryPaymentMonth,
    user,
    data?.workerContext?.workerId,
    refreshWorkerContextByPaymentMonth,
  ]);

  useEffect(() => {
    if (!user || user.role !== "worker" || !data?.workerContext?.workerId) return;
    const timer = window.setInterval(() => {
      refreshWorkerContextByPaymentMonth();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [user, data?.workerContext?.workerId, refreshWorkerContextByPaymentMonth]);

  function handleLogin(loggedUser) {
    setSessionNotice(null);
    // Reset any worker-specific state from a previous session so stale domains
    // never leak into the incoming session.
    setData(null);
    setWorkerSelectedDomain(null);
    workerValidDomainsRef.current = [];
    setAdminMenuOpen(false);
    setAdminActiveModule("dashboard");
    setHighlightedEarningsWorkerId(null);
    setWorkerFormOpenRequestId(0);
    setAdminPaymentMonth(getDefaultPaymentMonth());
    setWorkerPaymentMonth(getDefaultPaymentMonth());
    setWorkerHistoryPaymentMonth(getDefaultPaymentMonth());
    setSyncStatus(null);
    setAdminMenuOpen(false);
    setAdminActiveModule("dashboard");
    setHighlightedEarningsWorkerId(null);
    setHighlightedEarningsWorkerId(null);
    setUser(loggedUser);
  }

  function handleLogout(noticeMessage = null) {
    const notice =
      typeof noticeMessage === "string" && noticeMessage.trim() ? noticeMessage.trim() : null;
    logout();
    if (notice) setSessionNotice(notice);
    setUser(null);
    setData(null);
    setAdminReady(false);
    setWorkerMetricsLoading(false);
    setWorkerMetricsError(null);
    setWorkerSelectedDomain(null);
    setAdminPaymentMonth(getDefaultPaymentMonth());
    setWorkerPaymentMonth(getDefaultPaymentMonth());
    setWorkerHistoryPaymentMonth(getDefaultPaymentMonth());
    setSyncStatus(null);
    workerValidDomainsRef.current = [];
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
    adminEarningsCacheRef.current.clear();
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
                    if (item.id !== "earnings") setHighlightedEarningsWorkerId(null);
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
          <header className="app-header">
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
              <p className="app-sync-status">
                {formatSyncStatusLabel(syncStatus?.lastSyncedAt, "admin")}
              </p>
              {(loading || refreshingAdmin) && (
                <div className="header-progress" aria-hidden="true" />
              )}
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
                onWorkersUpdate={refreshAdminWorkersAndPayouts}
                onWorkersPaymentStatusRefresh={refreshAdminWorkerStatusesOnly}
                adminDashboardRange={adminDashboardRange}
                onChangeAdminDashboardRange={setAdminDashboardRange}
                adminEarningsRange={adminEarningsRange}
                onChangeAdminEarningsRange={setAdminEarningsRange}
                adminPaymentMonth={adminPaymentMonth}
                onChangeAdminPaymentMonth={setAdminPaymentMonth}
                activeModule={adminActiveModule}
                highlightedEarningsWorkerId={highlightedEarningsWorkerId}
                workerFormOpenRequestId={workerFormOpenRequestId}
                onAddWorkerFromDashboard={() => {
                  setAdminActiveModule("workers");
                  setWorkerFormOpenRequestId((n) => n + 1);
                }}
                onNavigateToEarnings={(workerId) => {
                  setAdminActiveModule("earnings");
                  setHighlightedEarningsWorkerId(workerId);
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
              />
            )}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-title-group">
          <h1 className="worker-header-brand">XerviaLinks Metrics</h1>
          <p className="app-current-date">{currentDateLabel}</p>
        </div>
        <div className="header-right">
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
          workerMetrics={data?.workerMetrics ?? null}
          workerPaymentHistory={data?.workerPaymentHistory ?? null}
          selectedDomain={workerSelectedDomain}
          onDomainChange={async (nextDomain) => {
            setWorkerSelectedDomain(nextDomain);
            await loadWorkerMetrics(nextDomain, getWorkerDomains(data?.workerContext));
          }}
          contextLoading={loading}
          metricsLoading={workerMetricsLoading}
          metricsError={workerMetricsError}
          error={error}
          syncStatusLabel={formatSyncStatusLabel(syncStatus?.lastSyncedAt, "worker")}
          workerId={data?.workerContext?.workerId ?? null}
          paymentMonth={workerPaymentMonth}
          onPaymentMonthChange={setWorkerPaymentMonth}
          paymentHistoryMonth={workerHistoryPaymentMonth}
          onPaymentHistoryMonthChange={setWorkerHistoryPaymentMonth}
          onContextRefresh={async () => {
            try {
              const [ctx, paymentHistory] = await Promise.all([
                fetchWorkerContext({ paymentMonth: workerPaymentMonth }),
                fetchWorkerPaymentHistory({ paymentMonth: workerHistoryPaymentMonth }),
              ]);
              const domains = getWorkerDomains(ctx);
              const stillValid = workerSelectedDomain && domains.includes(workerSelectedDomain);
              const nextDomain = stillValid ? workerSelectedDomain : domains[0] || null;
              setWorkerSelectedDomain(nextDomain);
              setData((prev) => ({
                ...prev,
                workerContext: ctx,
                workerPaymentHistory: paymentHistory,
              }));
            } catch {
              /* ignore refresh errors */
            }
          }}
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
  onWorkersPaymentStatusRefresh,
  adminDashboardRange,
  onChangeAdminDashboardRange,
  adminEarningsRange,
  onChangeAdminEarningsRange,
  adminPaymentMonth,
  onChangeAdminPaymentMonth,
  activeModule,
  highlightedEarningsWorkerId,
  workerFormOpenRequestId,
  onAddWorkerFromDashboard,
  onNavigateToEarnings,
  workerEditLaunchId,
  workerEditLaunchNonce,
  onNavigateToWorkerEdit,
  onAdminUserUpdated,
  onForceLogout,
}) {
  const { summary, workers, payouts, paymentHistory = [], sites } = data;

  const activeWorkers = (workers || []).filter((w) => !w.deleted_at);

  if (activeModule === "workers") {
    return (
      <WorkersList
        workers={workers}
        sites={sites}
        onUpdate={onWorkersUpdate}
        mode="management"
        workerFormOpenRequestId={workerFormOpenRequestId}
        autoEditWorkerId={workerEditLaunchId}
        autoEditNonce={workerEditLaunchNonce}
      />
    );
  }

  if (activeModule === "earnings") {
    return (
      <section>
        <div className="admin-range-row">
          <select
            className="form-select admin-range-select"
            value={adminEarningsRange}
            onChange={(e) => onChangeAdminEarningsRange(e.target.value)}
            aria-label="Rango de fechas para ganancias"
          >
            {Object.entries(ADMIN_RANGE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <SectionHeader title="Ganancias por trabajador" />
        <PayoutsTable
          payouts={payouts.payouts}
          totalPayout={payouts.totalPayout}
          workers={workers}
          highlightedWorkerId={highlightedEarningsWorkerId}
          paymentMonth={adminPaymentMonth}
          onPaymentMonthChange={onChangeAdminPaymentMonth}
          onRefresh={onWorkersPaymentStatusRefresh}
          isLoading={isRefreshing}
        />
      </section>
    );
  }

  if (activeModule === "payment-history") {
    return (
      <section>
        <SectionHeader title="Historial de pagos" />
        <PaymentHistoryTable rows={paymentHistory} isLoading={isRefreshing} />
      </section>
    );
  }

  if (activeModule === "profile") {
    return (
      <AdminProfile user={user} onUserUpdated={onAdminUserUpdated} onForceLogout={onForceLogout} />
    );
  }

  if (activeModule !== "dashboard") {
    return (
      <section>
        <h2>{activeModule === "network-codes" ? "Codigos de red" : "Perfil"}</h2>
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
              Aún no hay trabajadores activos. Crea el primero para asignar subdominios y ver
              ganancias.
            </p>
            <button
              type="button"
              className="btn workers-module-add-btn"
              onClick={() => onAddWorkerFromDashboard?.()}
            >
              Agregar trabajador
            </button>
          </div>
        ) : (
          <WorkersList
            workers={activeWorkers}
            sites={sites}
            onUpdate={onWorkersUpdate}
            mode="dashboard"
            onGoToEarnings={onNavigateToEarnings}
            onNavigateToWorkerEdit={onNavigateToWorkerEdit}
          />
        )}
      </section>
    </>
  );
}
