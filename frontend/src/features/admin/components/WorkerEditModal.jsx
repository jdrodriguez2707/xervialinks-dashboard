import { useEffect, useMemo, useState } from "react";
import { updateWorker } from "../../../shared/api/workers";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

function slotKey(value, gamNetworkCode) {
  return `${String(value || "").trim()}|||${String(gamNetworkCode || "").trim()}`;
}

function labelForNetwork(code, gamNetworks) {
  const row = (gamNetworks || []).find((n) => n.networkCode === code);
  return row?.displayName || code;
}

/**
 * @param {{
 *   worker: object,
 *   sites: string[],
 *   globallyAssignedSlots: Set<string>,
 *   activeNetworkCode: string,
 *   gamNetworks: object[],
 *   onClose: () => void,
 *   onSaved: () => void | Promise<void>,
 * }} props
 */
export default function WorkerEditModal({
  worker,
  sites,
  globallyAssignedSlots,
  activeNetworkCode = "",
  gamNetworks = [],
  onClose,
  onSaved,
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  /** Solo si el admin escribe aquí se envía al API (evita re-enviar la contraseña actual al guardar otros datos). */
  const [newPassword, setNewPassword] = useState("");
  /** @type {{ value: string, gamNetworkCode: string }[]} */
  const [domainSlots, setDomainSlots] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const net = String(activeNetworkCode || "").trim();

  useEffect(() => {
    if (!worker) return;
    setName(worker.name || "");
    setEmail(worker.email || "");
    setPercentage(String(worker.percentage ?? ""));
    setNewPassword("");
    setDomainSlots(
      (worker.properties || [])
        .filter((p) => p.type === "domain")
        .map((p) => ({
          value: String(p.value || "").trim(),
          gamNetworkCode: String(p.gamNetworkCode || p.gam_network_code || "").trim(),
        }))
        .filter((s) => s.value && s.gamNetworkCode),
    );
    setSelectedSite("");
    setError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  }, [worker]);

  const slotKeysInForm = useMemo(
    () => new Set(domainSlots.map((s) => slotKey(s.value, s.gamNetworkCode))),
    [domainSlots],
  );

  const availableSites = useMemo(() => {
    return sites.filter((s) => {
      const k = slotKey(s, net);
      if (!net) return false;
      if (slotKeysInForm.has(k)) return true;
      return !globallyAssignedSlots.has(k);
    });
  }, [sites, globallyAssignedSlots, slotKeysInForm, net]);

  function removeSlot(value, gamNetworkCode) {
    setDomainSlots((prev) =>
      prev.filter((x) => !(x.value === value && x.gamNetworkCode === gamNetworkCode)),
    );
  }

  function addDomainFromSelect(e) {
    e.preventDefault();
    if (!selectedSite || !net) return;
    const k = slotKey(selectedSite, net);
    if (domainSlots.some((x) => slotKey(x.value, x.gamNetworkCode) === k)) return;
    setDomainSlots((prev) => [...prev, { value: selectedSite, gamNetworkCode: net }]);
    setSelectedSite("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const pct = parseFloat(percentage);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        percentage: pct,
        domains: domainSlots,
      };
      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }
      await updateWorker(worker.id, payload, { networkCode: net || undefined });
      await onSaved();
      onClose();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudieron guardar los cambios del trabajador."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={!!worker} onOpenChange={(value) => (!value ? onClose() : null)}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "flex w-[min(100vw-1rem,42rem)] max-w-2xl flex-col gap-0 overflow-hidden border-border/60 p-0",
          "max-h-[min(90dvh,calc(100dvh-1.5rem))]",
        )}
      >
        <div className="shrink-0 space-y-1.5 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left sm:px-6 sm:pb-5 sm:pt-6">
          <DialogHeader className="space-y-2 p-0 text-left">
            <DialogTitle>Editar trabajador · {worker.name}</DialogTitle>
            <DialogDescription>
              Actualiza datos y subdominios. Los nuevos subdominios usan la red seleccionada en la
              cabecera del panel ({net ? labelForNetwork(net, gamNetworks) : "ninguna"}).
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="flex min-h-0 flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="worker-edit-name">Nombre</Label>
              <Input
                id="worker-edit-name"
                type="text"
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-edit-email">Correo</Label>
              <Input
                id="worker-edit-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="worker-edit-percentage">Porcentaje (%)</Label>
              <Input
                id="worker-edit-percentage"
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={percentage}
                onChange={(ev) => setPercentage(ev.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="worker-edit-password-current">Contraseña actual</Label>
              <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="worker-edit-password-current"
                  readOnly
                  tabIndex={-1}
                  type={showCurrentPassword ? "text" : "password"}
                  value={worker?.password ?? ""}
                  placeholder="Sin contraseña en el sistema"
                  className="bg-muted/50"
                  autoComplete="off"
                  aria-describedby="worker-edit-password-current-hint"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={
                    showCurrentPassword ? "Ocultar contraseña actual" : "Mostrar contraseña actual"
                  }
                >
                  {showCurrentPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              <p id="worker-edit-password-current-hint" className="text-xs text-muted-foreground">
                Solo lectura. Para cambiarla usa el campo siguiente; así no se reenvía al guardar el
                resto del perfil.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="worker-edit-password-new">Nueva contraseña (opcional)</Label>
              <div className="min-w-0 flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="worker-edit-password-new"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  placeholder="Vacío = no cambiar la contraseña actual"
                  autoComplete="new-password"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="shrink-0 self-start sm:self-auto"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                >
                  {showNewPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
            </div>
            </div>

            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Subdominios</p>
              <p className="text-xs text-muted-foreground">
                Puedes quitar o añadir subdominios. Cada uno queda vinculado a una red GAM.
              </p>
            </div>

            {domainSlots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {domainSlots.map((s) => (
                  <Badge key={slotKey(s.value, s.gamNetworkCode)} variant="outline" className="gap-2">
                    <span>
                      {s.value}{" "}
                      <span className="text-[10px] font-normal text-muted-foreground">
                        ({labelForNetwork(s.gamNetworkCode, gamNetworks)})
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar ${s.value}`}
                      onClick={() => removeSlot(s.value, s.gamNetworkCode)}
                    >
                      ✕
                    </button>
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sin subdominios en este perfil.</p>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Elegir subdominio disponible…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((s) => (
                    <SelectItem
                      key={s}
                      value={s}
                      disabled={net ? domainSlots.some((x) => slotKey(x.value, x.gamNetworkCode) === slotKey(s, net)) : true}
                    >
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={!selectedSite || !net || availableSites.length === 0}
                onClick={addDomainFromSelect}
              >
                Añadir
              </Button>
            </div>
          </div>
          </div>

          {error ? (
            <p className="shrink-0 border-t border-destructive/20 bg-destructive/5 px-5 py-3 text-sm font-medium text-destructive sm:px-6">
              {error}
            </p>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 bg-muted/30 px-5 py-4 sm:flex-row sm:justify-end sm:space-x-2 sm:px-6 sm:py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
