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

/**
 * @param {{
 *   worker: object,
 *   sites: string[],
 *   globallyAssignedDomains: Set<string>,
 *   onClose: () => void,
 *   onSaved: () => void | Promise<void>,
 * }} props
 */
export default function WorkerEditModal({ worker, sites, globallyAssignedDomains, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  const [password, setPassword] = useState("");
  const [domains, setDomains] = useState([]);
  const [selectedSite, setSelectedSite] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!worker) return;
    setName(worker.name || "");
    setEmail(worker.email || "");
    setPercentage(String(worker.percentage ?? ""));
    setPassword(worker.password || "");
    setDomains(
      (worker.properties || [])
        .filter((p) => p.type === "domain")
        .map((p) => p.value)
    );
    setSelectedSite("");
    setError(null);
    setShowPassword(false);
  }, [worker]);

  const availableSites = useMemo(() => {
    const set = new Set(domains);
    return sites.filter((s) => !globallyAssignedDomains.has(s) || set.has(s));
  }, [sites, globallyAssignedDomains, domains]);

  function removeDomain(value) {
    setDomains((prev) => prev.filter((d) => d !== value));
  }

  function addDomainFromSelect(e) {
    e.preventDefault();
    if (!selectedSite) return;
    if (domains.includes(selectedSite)) return;
    setDomains((prev) => [...prev, selectedSite]);
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
        domains,
      };
      if (password.trim()) {
        payload.password = password.trim();
      }
      await updateWorker(worker.id, payload);
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
      <DialogContent className="sm:max-w-2xl border-border/60">
        <DialogHeader>
          <DialogTitle>Editar trabajador · {worker.name}</DialogTitle>
          <DialogDescription>Actualiza datos y subdominios asociados.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
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
              <Label htmlFor="worker-edit-password">Contraseña</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="worker-edit-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  placeholder="Contraseña del trabajador"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
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
          </div>

          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Subdominios</p>
              <p className="text-xs text-muted-foreground">
                Puedes quitar o añadir subdominios aquí. Los cambios se guardan al pulsar "Guardar cambios".
              </p>
            </div>

            {domains.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {domains.map((d) => (
                  <Badge key={d} variant="outline" className="gap-2">
                    {d}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Quitar ${d}`}
                      onClick={() => removeDomain(d)}
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
                <SelectTrigger className="sm:w-72">
                  <SelectValue placeholder="Elegir subdominio disponible…" />
                </SelectTrigger>
                <SelectContent>
                  {availableSites.map((s) => (
                    <SelectItem key={s} value={s} disabled={domains.includes(s)}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={!selectedSite || availableSites.length === 0}
                onClick={addDomainFromSelect}
              >
                Añadir
              </Button>
            </div>
          </div>

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <DialogFooter>
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
