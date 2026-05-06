import { useEffect, useMemo, useRef, useState } from "react";
import { CircleDollarSign, SquarePen, Trash2, UserX } from "lucide-react";
import { addProperty, deleteWorker, purgeInactiveWorker } from "../../../shared/api/workers";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import WorkerForm from "./WorkerForm";
import WorkerEditModal from "./WorkerEditModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SectionHeader from "@/components/SectionHeader";
import EmptyState from "@/components/EmptyState";
import StatusBadge from "@/components/StatusBadge";

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
 *   onNavigateToWorkerEdit?: (workerId: number) => void,
 *   workerFormOpenRequestId?: number,
 *   autoEditWorkerId?: number | null,
 *   autoEditNonce?: number,
 * }} props
 */
export default function WorkersList({
  workers,
  sites = [],
  onUpdate,
  mode = "management",
  onGoToEarnings,
  onNavigateToWorkerEdit,
  workerFormOpenRequestId = 0,
  autoEditWorkerId = null,
  autoEditNonce = 0,
}) {
  const globallyAssignedDomains = useMemo(
    () =>
      new Set(
        workers
          .filter((w) => !w.deleted_at)
          .flatMap((w) =>
            (w.properties || []).filter((p) => p.type === "domain").map((p) => p.value),
          ),
      ),
    [workers],
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
      <EmptyState
        title="Sin trabajadores"
        description="Aún no hay trabajadores. Agrégalos desde el módulo Trabajadores."
      />
    );
  }

  const isMgmt = mode === "management";

  if (isMgmt) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Trabajadores"
          description="Activa o desactiva perfiles, asigna subdominios y libera cuentas cuando corresponda."
          action={
            <WorkerForm
              onCreated={onUpdate}
              triggerLabel="Agregar trabajador"
              triggerClassName="btn workers-module-add-btn"
              openRequestId={workerFormOpenRequestId}
            />
          }
        />

        {renderedWorkers.length === 0 ? (
          <EmptyState
            title="Aún no hay trabajadores"
            description="Usa el botón para crear el primero y asignar subdominios."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {renderedWorkers.map((worker) => (
              <WorkerManagementPanel
                key={worker.id}
                worker={worker}
                sites={sites}
                globallyAssignedDomains={globallyAssignedDomains}
                onUpdate={onUpdate}
                autoEditWorkerId={autoEditWorkerId}
                autoEditNonce={autoEditNonce}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {renderedWorkers.map((worker) => (
        <WorkerDashboardCard
          key={worker.id}
          worker={worker}
          onGoToEarnings={onGoToEarnings}
          onNavigateToWorkerEdit={onNavigateToWorkerEdit}
        />
      ))}
    </div>
  );
}

/** @param {{ worker: object, onGoToEarnings?: (id: number) => void, onNavigateToWorkerEdit?: (id: number) => void }} props */
function WorkerDashboardCard({ worker, onGoToEarnings, onNavigateToWorkerEdit }) {
  const domains = (worker.properties || []).filter((p) => p.type === "domain");
  const paymentStatus = worker.paymentStatus || "pending";
  const isPaid = paymentStatus === "paid";

  function handleCardActivate() {
    onNavigateToWorkerEdit?.(worker.id);
  }

  return (
    <Card
      className="cursor-pointer transition-all hover:border-primary/40"
      role="button"
      tabIndex={0}
      aria-label={`Editar trabajador ${worker.name}`}
      onClick={handleCardActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardActivate();
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{worker.name}</p>
            <p className="text-xs text-muted-foreground">{worker.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary tabular-nums">{worker.percentage}%</Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Ver ganancias de ${worker.name}`}
              title="Ir al módulo de Ganancias"
              onClick={(e) => {
                e.stopPropagation();
                onGoToEarnings?.(worker.id);
              }}
            >
              <CircleDollarSign className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {domains.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {domains.map((p) => (
              <Badge key={p.id} variant="outline">
                {p.value}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sin subdominios asignados.</p>
        )}
        <StatusBadge
          status={isPaid ? "paid" : "pending"}
          label={isPaid ? "Pagado" : "Pendiente de pago"}
        />
      </CardContent>
    </Card>
  );
}

/** @param {{ worker: object, sites: string[], globallyAssignedDomains: Set<string>, onUpdate: () => void, autoEditWorkerId?: number | null, autoEditNonce?: number }} props */
function WorkerManagementPanel({
  worker,
  sites,
  globallyAssignedDomains,
  onUpdate,
  autoEditWorkerId = null,
  autoEditNonce = 0,
}) {
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [purging, setPurging] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const autoEditHandledKeyRef = useRef(null);
  const isInactive = !!worker.deleted_at;

  useEffect(() => {
    if (isInactive) return;
    if (autoEditWorkerId == null || !autoEditNonce) return;
    if (worker.id !== autoEditWorkerId) return;
    const key = `${autoEditWorkerId}:${autoEditNonce}`;
    if (autoEditHandledKeyRef.current === key) return;
    autoEditHandledKeyRef.current = key;
    setEditOpen(true);
  }, [autoEditWorkerId, autoEditNonce, worker.id, isInactive]);
  const domains = (worker.properties || []).filter((p) => p.type === "domain");
  const hasAssignableSubdomain = sites.some((s) => !globallyAssignedDomains.has(s));

  useEffect(() => {
    if (!selectedSite) return;
    if (globallyAssignedDomains.has(selectedSite)) {
      setSelectedSite("");
    }
  }, [selectedSite, globallyAssignedDomains]);

  const initial = String(worker.name || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  async function handleAddDomain(e) {
    e.preventDefault();
    if (!selectedSite || isInactive || globallyAssignedDomains.has(selectedSite)) return;
    setError(null);
    setSubmitting(true);
    try {
      await addProperty(worker.id, { type: "domain", value: selectedSite });
      setSelectedSite("");
      await onUpdate();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo asignar el subdominio."));
    } finally {
      setSubmitting(false);
    }
  }

  function openDeleteConfirm() {
    setConfirmAction("deactivate");
  }

  function openPurgeConfirm() {
    setConfirmAction("purge");
  }

  function closeConfirmDialog() {
    if (deleting || purging) return;
    setConfirmAction(null);
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    setError(null);
    try {
      await deleteWorker(worker.id);
      await onUpdate();
      setConfirmAction(null);
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo desactivar el trabajador."));
    } finally {
      setDeleting(false);
    }
  }

  async function handlePurgeConfirmed() {
    setPurging(true);
    setError(null);
    try {
      await purgeInactiveWorker(worker.id);
      await onUpdate();
      setConfirmAction(null);
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo eliminar definitivamente el trabajador."));
    } finally {
      setPurging(false);
    }
  }

  return (
    <Card className={isInactive ? "opacity-80" : ""}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{worker.name}</p>
                {isInactive && <StatusBadge status="inactive" label="Inactivo" />}
              </div>
              <p className="text-xs text-muted-foreground">{worker.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-primary/15 text-primary tabular-nums">{worker.percentage}%</Badge>
            {!isInactive && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Desactivar a ${worker.name}`}
                  title="Desactivar trabajador"
                  disabled={deleting}
                  onClick={openDeleteConfirm}
                >
                  {deleting ? "…" : <UserX className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Editar datos de ${worker.name}`}
                  title="Editar trabajador"
                  onClick={() => setEditOpen(true)}
                >
                  <SquarePen className="h-4 w-4" />
                </Button>
              </>
            )}
            {isInactive && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                aria-label={`Eliminar definitivamente a ${worker.name}`}
                title="Eliminar definitivamente (solo inactivos)"
                disabled={purging}
                onClick={openPurgeConfirm}
              >
                {purging ? "…" : <Trash2 className="h-4 w-4" />}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Subdominios</p>
          {domains.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {domains.map((p) => (
                <Badge key={p.id} variant="outline">
                  {p.value}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin subdominios asignados.</p>
          )}
        </div>

        {!isInactive && (
          <form className="flex flex-col gap-2" onSubmit={handleAddDomain}>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir subdominio disponible…" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((s) => {
                  const assignedGlobally = globallyAssignedDomains.has(s);
                  const ownedHere = domains.some((p) => p.value === s);
                  const disabled = assignedGlobally && !ownedHere;
                  const hint = assignedGlobally
                    ? ownedHere
                      ? " (asignado aquí)"
                      : " (no disponible)"
                    : "";
                  return (
                    <SelectItem key={s} value={s} disabled={disabled}>
                      {`${s}${hint}`}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !hasAssignableSubdomain || !selectedSite}
            >
              {submitting ? "Asignando…" : "Asignar subdominio"}
            </Button>
          </form>
        )}

        {isInactive && (
          <p className="text-xs text-muted-foreground">
            Este perfil está desactivado. Los subdominios quedaron libres. Puedes eliminar el
            registro definitivamente con el icono de papelera.
          </p>
        )}

        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </CardContent>

      {editOpen && !isInactive && (
        <WorkerEditModal
          worker={worker}
          sites={sites}
          globallyAssignedDomains={globallyAssignedDomains}
          onClose={() => setEditOpen(false)}
          onSaved={onUpdate}
        />
      )}

      <Dialog open={!!confirmAction} onOpenChange={(open) => (!open ? closeConfirmDialog() : null)}>
        <DialogContent className="sm:max-w-md border-border/60">
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "purge"
                ? "Eliminar trabajador definitivamente"
                : "Desactivar trabajador"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "purge"
                ? `Se eliminará definitivamente el perfil de ${worker.name} y su historial asociado. Esta acción no se puede deshacer.`
                : `¿Seguro que quieres desactivar a ${worker.name}? Sus subdominios quedarán libres para asignarlos a otros trabajadores.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={closeConfirmDialog}
              disabled={deleting || purging}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant={confirmAction === "purge" ? "destructive" : "default"}
              onClick={confirmAction === "purge" ? handlePurgeConfirmed : handleDeleteConfirmed}
              disabled={deleting || purging}
            >
              {confirmAction === "purge"
                ? purging
                  ? "Eliminando…"
                  : "Eliminar definitivamente"
                : deleting
                  ? "Desactivando…"
                  : "Desactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
