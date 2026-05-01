import { useMemo, useState } from "react";
import { CircleDollarSign, Trash2, UserX } from "lucide-react";
import { addProperty, deleteWorker, purgeInactiveWorker } from "../../../shared/api/workers";
import WorkerForm from "./WorkerForm";

/**
 * @param {{
 *   workers: Array<{
 *     id: number,
 *     name: string,
 *     email: string,
 *     percentage: number,
 *     deleted_at?: string | null,
 *     paymentStatus?: string,
 *     properties: Array<{ id: number, type: string, value: string }>,
 *   }>,
 *   sites: string[],
 *   onUpdate: () => void | Promise<void>,
 *   mode?: "dashboard" | "management",
 *   onGoToEarnings?: (workerId: number) => void,
 * }} props
 */
export default function WorkersList({ workers, sites = [], onUpdate, mode = "management", onGoToEarnings }) {
  const globallyAssignedDomains = useMemo(
    () =>
      new Set(
        workers
          .filter((w) => !w.deleted_at)
          .flatMap((w) =>
            (w.properties || []).filter((p) => p.type === "domain").map((p) => p.value)
          )
      ),
    [workers]
  );

  const orderedForManagement = useMemo(() => {
    if (mode !== "management") return workers;
    return [...workers].sort((a, b) => {
      const ad = !!a.deleted_at;
      const bd = !!b.deleted_at;
      if (ad !== bd) return ad ? 1 : -1;
      return String(a.name || "").localeCompare(String(b.name || ""), "es");
    });
  }, [workers, mode]);

  const renderedWorkers = mode === "management" ? orderedForManagement : workers;

  if (renderedWorkers.length === 0 && mode !== "management") {
    return (
      <p className="empty-state">
        Aún no hay trabajadores. Agrégalos desde el módulo Trabajadores.
      </p>
    );
  }

  const isMgmt = mode === "management";

  if (isMgmt) {
    return (
      <div className="workers-module">
        <div className="workers-module-toolbar">
          <p className="workers-module-copy">
            Activa o desactiva perfiles, asigna subdominios y libera cuentas de forma permanente cuando
            corresponda.
          </p>
          <WorkerForm
            onCreated={onUpdate}
            triggerLabel="Agregar trabajador"
            triggerClassName="btn workers-module-add-btn"
          />
        </div>

        {renderedWorkers.length === 0 ? (
          <p className="empty-state">
            Aún no hay trabajadores. Usa el botón anterior para crear uno.
          </p>
        ) : (
          <div className="workers-mgmt-list">
            {renderedWorkers.map((worker) => (
              <WorkerManagementPanel
                key={worker.id}
                worker={worker}
                sites={sites}
                globallyAssignedDomains={globallyAssignedDomains}
                onUpdate={onUpdate}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="workers-list">
      {renderedWorkers.map((worker) => (
        <WorkerDashboardCard key={worker.id} worker={worker} onGoToEarnings={onGoToEarnings} />
      ))}
    </div>
  );
}

/** @param {{ worker: object, onGoToEarnings?: (id: number) => void }} props */
function WorkerDashboardCard({ worker, onGoToEarnings }) {
  const domains = (worker.properties || []).filter((p) => p.type === "domain");
  const paymentStatus = worker.paymentStatus || "pending";
  const isPaid = paymentStatus === "paid";

  const statusClassName = `payment-status-badge ${isPaid ? "is-paid" : "is-pending"}`;

  return (
    <div className="worker-card">
      <div className="worker-card-header">
        <div className="worker-card-info">
          <p className="worker-name">{worker.name}</p>
          <p className="worker-email">{worker.email}</p>
        </div>
        <div className="worker-card-actions">
          <span className="percentage-badge">{worker.percentage}%</span>
          <button
            type="button"
            className="btn-icon btn-earnings"
            aria-label={`Ver ganancias de ${worker.name}`}
            title="Ir al módulo de Ganancias"
            onClick={() => onGoToEarnings?.(worker.id)}
          >
            <CircleDollarSign size={16} />
          </button>
        </div>
      </div>

      <div className="worker-properties">
        {domains.length > 0 ? (
          <div className="domain-tags">
            {domains.map((p) => (
              <span key={p.id} className="tag tag-domain">
                {p.value}
              </span>
            ))}
          </div>
        ) : (
          <p className="no-domains">Sin subdominios asignados.</p>
        )}
      </div>

      <div className="worker-payment-status-row">
        <span className={statusClassName}>{isPaid ? "Pagado" : "Pendiente de pago"}</span>
      </div>
    </div>
  );
}

/** @param {{ worker: object, sites: string[], globallyAssignedDomains: Set<string>, onUpdate: () => void }} props */
function WorkerManagementPanel({ worker, sites, globallyAssignedDomains, onUpdate }) {
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purging, setPurging] = useState(false);

  const isInactive = !!worker.deleted_at;
  const domains = (worker.properties || []).filter((p) => p.type === "domain");
  const availableSites = sites.filter((s) => !globallyAssignedDomains.has(s));
  const initial = String(worker.name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  async function handleAddDomain(e) {
    e.preventDefault();
    if (!selectedSite || isInactive) return;
    setError(null);
    setSubmitting(true);
    try {
      await addProperty(worker.id, { type: "domain", value: selectedSite });
      setSelectedSite("");
      await onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`¿Desactivar a ${worker.name}? Podrás liberar dominios para otros trabajadores.`))
      return;
    setDeleting(true);
    try {
      await deleteWorker(worker.id);
      await onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePurge() {
    if (
      !confirm(
        `¿Eliminar definitivamente el perfil inactivo de ${worker.name}? Se borrará el historial asociado a este usuario y no se puede deshacer.`
      )
    )
      return;
    setPurging(true);
    try {
      await purgeInactiveWorker(worker.id);
      await onUpdate();
    } catch (err) {
      setError(err.message);
    } finally {
      setPurging(false);
    }
  }

  return (
    <article className={`worker-mgmt-panel ${isInactive ? "is-inactive" : ""}`}>
      <div className="worker-mgmt-accent" aria-hidden />
      <div className="worker-mgmt-main">
        <div className="worker-mgmt-head">
          <div className="worker-mgmt-avatar" aria-hidden="true">
            {initial}
          </div>
          <div className="worker-mgmt-identity">
            <div className="worker-mgmt-name-row">
              <p className="worker-mgmt-name">{worker.name}</p>
              {isInactive && (
                <span className="worker-activity-badge is-inactive">Inactivo</span>
              )}
            </div>
            <p className="worker-mgmt-email">{worker.email}</p>
          </div>
          <div className="worker-mgmt-actions">
            <span className="worker-mgmt-pct">{worker.percentage}%</span>
            {!isInactive && (
              <button
                type="button"
                className="btn-icon btn-mgmt-soft-delete"
                aria-label={`Desactivar a ${worker.name}`}
                title="Desactivar trabajador"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? "…" : <UserX size={18} strokeWidth={2} />}
              </button>
            )}
            {isInactive && (
              <button
                type="button"
                className="btn-icon btn-mgmt-purge"
                aria-label={`Eliminar definitivamente a ${worker.name}`}
                title="Eliminar definitivamente (solo inactivos)"
                disabled={purging}
                onClick={handlePurge}
              >
                {purging ? "…" : <Trash2 size={18} strokeWidth={2} />}
              </button>
            )}
          </div>
        </div>

        <div className="worker-mgmt-domains-block">
          <span className="worker-mgmt-field-label">Subdominios</span>
          {domains.length > 0 ? (
            <div className="worker-mgmt-chip-row">
              {domains.map((p) => (
                <span key={p.id} className="worker-mgmt-chip">
                  {p.value}
                </span>
              ))}
            </div>
          ) : (
            <p className="worker-mgmt-empty-tags">Sin subdominios asignados.</p>
          )}
        </div>

        {!isInactive && (
          <form className="worker-mgmt-assign" onSubmit={handleAddDomain}>
            <select
              className="form-select worker-mgmt-select"
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              required
              aria-label="Elegir subdominio disponible"
            >
              <option value="" disabled>
                Elegir subdominio disponible…
              </option>
              {availableSites.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-sm worker-mgmt-assign-btn" disabled={submitting || availableSites.length === 0}>
              {submitting ? "Asignando…" : "Asignar subdominio"}
            </button>
          </form>
        )}

        {isInactive && (
          <p className="worker-mgmt-inactive-hint">
            Este perfil está desactivado. Los subdominios quedaron libres. Puedes eliminar el registro
            definitivamente con el icono de papelera.
          </p>
        )}

        {error && <p className="form-error worker-mgmt-error">{error}</p>}
      </div>
    </article>
  );
}
