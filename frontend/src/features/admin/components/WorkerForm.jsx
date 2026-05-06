import { useState, useEffect, useRef } from "react";
import { createWorker } from "../../../shared/api/workers";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * @param {{
 *   onCreated: () => void,
 *   triggerClassName?: string,
 *   triggerLabel?: string,
 *   openRequestId?: number,
 * }} props
 */
export default function WorkerForm({
  onCreated,
  triggerClassName = "btn btn-add-worker",
  triggerLabel = "+ Agregar trabajador",
  openRequestId = 0,
}) {
  const [open, setOpen] = useState(false);
  const lastOpenRequestId = useRef(0);

  useEffect(() => {
    if (openRequestId > lastOpenRequestId.current) {
      lastOpenRequestId.current = openRequestId;
      setOpen(true);
    }
  }, [openRequestId]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [percentage, setPercentage] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleClose() {
    setOpen(false);
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createWorker({
        name,
        email,
        percentage: parseFloat(percentage),
        password,
      });
      setName("");
      setEmail("");
      setPercentage("");
      setPassword("");
      handleClose();
      onCreated();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo crear el trabajador."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>
        <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
          {triggerLabel}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg border-border/60">
        <DialogHeader>
          <DialogTitle>Nuevo trabajador</DialogTitle>
          <DialogDescription>Completa los datos para crear el perfil del trabajador.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="worker-name">Nombre</Label>
            <Input
              id="worker-name"
              type="text"
              placeholder="Nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-email">Email</Label>
            <Input
              id="worker-email"
              type="email"
              placeholder="correo@dominio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-percentage">Porcentaje</Label>
            <Input
              id="worker-percentage"
              type="number"
              placeholder="% (ej. 70)"
              min="0.01"
              max="100"
              step="0.01"
              value={percentage}
              onChange={(e) => setPercentage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="worker-password">Contraseña</Label>
            <Input
              id="worker-password"
              type="password"
              placeholder="Contraseña para acceso"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-sm font-medium text-danger">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Guardar trabajador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
