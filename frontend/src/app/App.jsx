import { useEffect, useState, useCallback, useRef } from "react";
import { getStoredUser, getToken, logout, setStoredUser, fetchSession } from "../shared/api/auth";
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
import { fetchGamNetworks } from "../shared/api/gamNetworks";
import { readAdminActiveGamNetworkCode, writeAdminActiveGamNetworkCode } from "../shared/lib/adminActiveNetwork";
import { toUserErrorMessage } from "../shared/lib/uiError";
import GamNetworksModule from "../features/admin/components/GamNetworksModule";
import LoginForm from "../features/auth/components/LoginForm";
import SummaryCards from "../features/admin/components/SummaryCards";
import PayoutsTable from "../features/admin/components/PayoutsTable";
import AdminEarningsPaymentStatusPanel from "../features/admin/components/AdminEarningsPaymentStatusPanel";
import PaymentHistoryTable from "../features/admin/components/PaymentHistoryTable";
import WorkersList from "../features/admin/components/WorkersList";
import WorkerDashboard from "../features/worker/components/WorkerDashboard";
import AdminProfile from "../features/admin/components/AdminProfile";
import SectionHeader from "../components/SectionHeader";
import ThemeToggle from "../components/ThemeToggle";
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

function getDefaultPaymentMonth(date = new Date()) {
  const target = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const month = String(target.getMonth() + 1).padStart(2, "0");
  return `${target.getFullYear()}-${month}`;
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
  const [highlightedEarningsWorkerId, setHighlightedEarningsWorkerId] = useState(null);
  const [workerEditLaunch, setWorkerEditLaunch] = useState({ id: null, nonce: 0 });
  const adminDashboardCacheRef = useRef(new Map());
  const adminEarningsCacheRef = useRef(new Map());
  const workerValidDomainsRef = useRef([]);
  const adminActiveNetworkCodeRef = useRef(adminActiveNetworkCode);
  const workerPaymentMonthRef = useRef(getDefaultPaymentMonth());
  const workerHistoryPaymentMonthRef = useRef(getDefaultPaymentMonth());
  const lastDefaultPaymentMonthRef = useRef(getDefaultPaymentMonth());
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
    setAdminPaymentMonth(getDefaultPaymentMonth());
    setWorkerPaymentMonth(getDefaultPaymentMonth());
    setWorkerHistoryPaymentMonth(getDefaultPaymentMonth());
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
    adminEarningsCacheRef.current.clear();
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

  function getCachedEarningsPayouts(rangeKey) {
    const entry = adminEarningsCacheRef.current.get(adminDashCacheKey(rangeKey));
    if (!entry) return null;
    if (Date.now() - entry.cachedAt > ADMIN_CACHE_TTL_MS) {
      adminEarningsCacheRef.current.delete(adminDashCacheKey(rangeKey));
      return null;
    }
    return entry.payouts;
  }

  function setCachedEarningsPayouts(rangeKey, payouts) {
    adminEarningsCacheRef.current.set(adminDashCacheKey(rangeKey), {
      payouts,
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
        const [summary, workers, payouts, paymentHistory, sites, sync] = await Promise.all([
          fetchSummary({ ...range, ...netOpts }),
          fetchWorkers({ includeDeleted: true, paymentMonth: adminPaymentMonth, ...netOpts }),
          fetchPayouts({ ...range, ...netOpts }),
          fetchPaymentHistory(netOpts),
          fetchSites(netOpts),
          fetchSyncStatus(netOpts).catch(() => null),
        ]);
        if (seq !== loadInitialSeqRef.current) return;
        setCachedDashboardSummary("today", summary);
        setCachedEarningsPayouts("today", payouts);
        setData({ summary, workers, payouts, paymentHistory, sites, gamNetworks: gamNetList });
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
          Promise.all([fetchSummary({ ...r, ...netOpts }), fetchPayouts({ ...r, ...netOpts })])
            .then(([s, p]) => {
              setCachedDashboardSummary(rangeKey, s);
              setCachedEarningsPayouts(rangeKey, p);
            })
            .catch(() => {});
        });
      } else {
        const [context, paymentHistory] = await Promise.all([
          fetchWorkerContext({ paymentMonth: workerPaymentMonth }),
          fetchWorkerPaymentHistory({ paymentMonth: workerHistoryPaymentMonth }),
        ]);
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
          workerPaymentHistory: paymentHistory,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adminPaymentMonth / worker months: otros useEffect; evita bucle
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
        const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
        const payouts = await fetchPayouts({ ...range, ...net });
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
  }, [adminEarningsRange, adminActiveNetworkCode, user, adminReady, handleLogout]);

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
      const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
      const [workers, payouts, summary, paymentHistory] = await Promise.all([
        fetchWorkers({ includeDeleted: true, paymentMonth: adminPaymentMonth, ...net }),
        fetchPayouts({ ...earnRangeObj, ...net }),
        fetchSummary({ ...dashRangeObj, ...net }),
        fetchPaymentHistory(net),
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
  }, [
    user,
    adminDashboardRange,
    adminEarningsRange,
    adminPaymentMonth,
    adminActiveNetworkCode,
    handleLogout,
  ]);

  const refreshAdminWorkerStatusesOnly = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setRefreshingAdmin(true);
    setError(null);
    try {
      const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
      const [workers, paymentHistory] = await Promise.all([
        fetchWorkers({
          includeDeleted: true,
          paymentMonth: adminPaymentMonth,
          ...net,
        }),
        fetchPaymentHistory(net),
      ]);
      setData((prev) => ({ ...prev, workers, paymentHistory }));
    } catch (err) {
      const rawMessage = String(err?.message || "");
      if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
      else setError(toUserErrorMessage(err, "No se pudo actualizar el estado de pagos."));
    } finally {
      setRefreshingAdmin(false);
    }
  }, [user, adminPaymentMonth, adminActiveNetworkCode, handleLogout]);

  const handleAdminNetworkChange = useCallback(
    async (nextCode) => {
      if (!nextCode || user?.role !== "admin" || !adminReady) return;
      writeAdminActiveGamNetworkCode(nextCode);
      setAdminActiveNetworkCode(nextCode);
      adminActiveNetworkCodeRef.current = nextCode;
      adminDashboardCacheRef.current.clear();
      adminEarningsCacheRef.current.clear();
      setRefreshingAdmin(true);
      setError(null);
      try {
        const dashRangeObj = getAdminDateRange(adminDashboardRange);
        const earnRangeObj = getAdminDateRange(adminEarningsRange);
        const net = { networkCode: nextCode };
        const [workers, payouts, summary, paymentHistory, sites, sync] = await Promise.all([
          fetchWorkers({ includeDeleted: true, paymentMonth: adminPaymentMonth, ...net }),
          fetchPayouts({ ...earnRangeObj, ...net }),
          fetchSummary({ ...dashRangeObj, ...net }),
          fetchPaymentHistory(net),
          fetchSites(net),
          fetchSyncStatus(net).catch(() => null),
        ]);
        setCachedDashboardSummary(adminDashboardRange, summary);
        setCachedEarningsPayouts(adminEarningsRange, payouts);
        setData((prev) => ({ ...prev, workers, payouts, summary, paymentHistory, sites }));
        setSyncStatus(sync);
      } catch (err) {
        const rawMessage = String(err?.message || "");
        if (isAuthSessionError(rawMessage)) handleLogout(rawMessage);
        else setError(toUserErrorMessage(err, "No se pudo cambiar el contexto de red."));
      } finally {
        setRefreshingAdmin(false);
      }
    },
    [
      user,
      adminReady,
      adminDashboardRange,
      adminEarningsRange,
      adminPaymentMonth,
      handleLogout,
    ],
  );

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
  }, [user, workerSelectedDomain, handleLogout]);

  useEffect(() => {
    async function refreshWorkersPaymentStatusByMonth() {
      if (!user || user.role !== "admin" || !adminReady) return;
      setRefreshingAdmin(true);
      setError(null);
      try {
        const net = adminActiveNetworkCode ? { networkCode: adminActiveNetworkCode } : {};
        const [workers, paymentHistory] = await Promise.all([
          fetchWorkers({
            includeDeleted: true,
            paymentMonth: adminPaymentMonth,
            ...net,
          }),
          fetchPaymentHistory(net),
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
  }, [adminPaymentMonth, adminActiveNetworkCode, user, adminReady, handleLogout]);

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
                onWorkersUpdate={refreshAdminWorkersAndPayouts}
                onWorkersPaymentStatusRefresh={refreshAdminWorkerStatusesOnly}
                adminDashboardRange={adminDashboardRange}
                onChangeAdminDashboardRange={setAdminDashboardRange}
                adminEarningsRange={adminEarningsRange}
                onChangeAdminEarningsRange={setAdminEarningsRange}
                adminPaymentMonth={adminPaymentMonth}
                onChangeAdminPaymentMonth={setAdminPaymentMonth}
                paymentMonthOptionsTick={currentDateLabel}
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
          workerMetrics={data?.workerMetrics ?? null}
          workerPaymentHistory={data?.workerPaymentHistory ?? null}
          paymentMonthOptionsTick={currentDateLabel}
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
  paymentMonthOptionsTick,
  activeModule,
  adminActiveNetworkCode,
  onGamNetworksUpdated,
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
  const { summary, workers, payouts, paymentHistory = [], sites, gamNetworks = [] } = data;

  const activeWorkers = (workers || []).filter((w) => !w.deleted_at);

  if (activeModule === "workers") {
    return (
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
          highlightedWorkerId={highlightedEarningsWorkerId}
          isLoading={isRefreshing}
        />
        <AdminEarningsPaymentStatusPanel
          payouts={payouts.payouts}
          workers={workers}
          paymentMonth={adminPaymentMonth}
          onPaymentMonthChange={onChangeAdminPaymentMonth}
          paymentMonthOptionsTick={paymentMonthOptionsTick}
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
              Aún no hay trabajadores activos. Crea el primero para asignar subdominios y ver
              ganancias.
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
          onGoToEarnings={onNavigateToEarnings}
          onNavigateToWorkerEdit={onNavigateToWorkerEdit}
        />
        )}
      </section>
    </>
  );
}
