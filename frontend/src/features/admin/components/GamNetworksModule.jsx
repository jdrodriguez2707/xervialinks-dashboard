import { useEffect, useState } from "react";
import { RefreshCw, ShieldCheck, Plus, Trash2, Star, Pencil, Loader2 } from "lucide-react";
import {
  fetchGamNetworks,
  fetchGamServiceAccountEmail,
  verifyGamNetwork,
  syncGamNetworkNow,
  createGamNetwork,
  setDefaultGamNetwork,
  deleteGamNetwork,
  updateGamNetworkDisplayName,
} from "../../../shared/api/gamNetworks";
import { toUserErrorMessage } from "../../../shared/lib/uiError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SectionHeader from "@/components/SectionHeader";

function statusLabel(s) {
  if (s === "ok") return "Acceso OK";
  if (s === "error") return "Error";
  return "Sin verificar";
}

export default function GamNetworksModule({ onNetworksChanged }) {
  const [rows, setRows] = useState([]);
  const [saEmail, setSaEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [codeInput, setCodeInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [busyCode, setBusyCode] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  /** @type {{ networkCode: string, title: string, description: string } | null} */
  const [progressDialog, setProgressDialog] = useState(null);

  function openProgress(networkCode, title, description) {
    setProgressDialog({ networkCode, title, description });
  }

  function closeProgress() {
    setProgressDialog(null);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const [list, emailRow] = await Promise.all([
        fetchGamNetworks(),
        fetchGamServiceAccountEmail().catch(() => ({ email: null })),
      ]);
      setRows(Array.isArray(list) ? list : []);
      setSaEmail(emailRow?.email || null);
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudieron cargar las redes."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(row) {
    setEditRow(row);
    setEditName(row?.displayName || "");
  }

  function closeEdit() {
    if (savingName) return;
    setEditRow(null);
    setEditName("");
  }

  async function handleSaveDisplayName(e) {
    e.preventDefault();
    if (!editRow?.networkCode) return;
    setError(null);
    setSavingName(true);
    try {
      await updateGamNetworkDisplayName(editRow.networkCode, editName.trim());
      closeEdit();
      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo actualizar el nombre."));
    } finally {
      setSavingName(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    const code = codeInput.trim();
    if (!/^\d+$/.test(code)) {
      setError("El código de red debe ser numérico.");
      return;
    }
    const displayName = nameInput.trim() || undefined;
    setBusyCode(code);
    openProgress(
      code,
      "Registrando red…",
      `Guardando el código ${code} en el panel. A continuación se verificará el acceso y se importarán los informes.`,
    );
    try {
      await createGamNetwork({ networkCode: code, displayName });
      setCodeInput("");
      setNameInput("");

      openProgress(
        code,
        "Verificando acceso a Ad Manager…",
        `Red ${code}: comprobando que la cuenta de servicio puede leer esta red. Si falla, invítala en GAM y pulsa «Verificar acceso» más adelante.`,
      );
      try {
        await verifyGamNetwork(code);
      } catch (verifyErr) {
        setError(
          toUserErrorMessage(
            verifyErr,
            "La red se registró, pero no se pudo verificar el acceso. Invita la cuenta de servicio en GAM y usa «Verificar acceso».",
          ),
        );
        await load();
        onNetworksChanged?.();
        return;
      }

      await load();
      onNetworksChanged?.();

      openProgress(
        code,
        "Sincronizando informes…",
        `Red ${code}: descargando datos recientes. Al terminar, los subdominios de esta red aparecerán en los selectores del panel.`,
      );
      try {
        await syncGamNetworkNow(code);
      } catch (syncErr) {
        setError(
          toUserErrorMessage(
            syncErr,
            "El acceso está verificado, pero la sincronización falló. Puedes reintentar con «Sincronizar».",
          ),
        );
        await load();
        onNetworksChanged?.();
        return;
      }

      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo registrar la red."));
    } finally {
      closeProgress();
      setBusyCode(null);
    }
  }

  async function handleVerify(code) {
    setError(null);
    setBusyCode(code);
    try {
      await verifyGamNetwork(code);
      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "La verificación falló."));
      await load();
    } finally {
      setBusyCode(null);
    }
  }

  async function handleSync(code) {
    setError(null);
    setBusyCode(code);
    openProgress(
      code,
      "Sincronización en curso",
      `Red ${code}: conectando con Ad Manager y actualizando informes locales. Los sitios disponibles en los selectores se refrescarán al finalizar.`,
    );
    try {
      await syncGamNetworkNow(code);
      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo sincronizar."));
    } finally {
      closeProgress();
      setBusyCode(null);
    }
  }

  async function handleDefault(code) {
    setError(null);
    setBusyCode(code);
    try {
      await setDefaultGamNetwork(code);
      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo marcar como predeterminada."));
    } finally {
      setBusyCode(null);
    }
  }

  function openDeleteDialog(row) {
    if (!row?.networkCode || row.isDefault) return;
    setDeleteTarget(row);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
  }

  async function confirmDelete() {
    const code = deleteTarget?.networkCode;
    if (!code) return;
    setError(null);
    setBusyCode(code);
    try {
      await deleteGamNetwork(code);
      setDeleteTarget(null);
      await load();
      onNetworksChanged?.();
    } catch (err) {
      setError(toUserErrorMessage(err, "No se pudo eliminar."));
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Códigos de red Ad Manager"
        description="Registra cada red, invita la cuenta de servicio en GAM y verifica el acceso antes de sincronizar informes."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Añadir red</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
            onSubmit={handleCreate}
          >
            <div className="space-y-1">
              <Label htmlFor="gam-net-code">Código de red (numérico)</Label>
              <Input
                id="gam-net-code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="p. ej. 12345678"
                className="sm:w-48"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gam-net-name">Nombre visible (opcional)</Label>
              <Input
                id="gam-net-name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Mi red principal"
                className="sm:w-56"
              />
            </div>
            <Button
              type="submit"
              disabled={!!busyCode || !codeInput.trim()}
              className="gam-register-net-btn shadow-sm font-medium"
            >
              <Plus className="mr-1 h-4 w-4" />
              Registrar
            </Button>
          </form>
        </CardContent>
      </Card>

      {saEmail && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Invitar la cuenta de servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              En Google Ad Manager ve a <strong>Administrar → Configuración global → Añadir un usuario de cuenta de servicio</strong> y coloca un nombre distintivo, el correo de abajo y asigna la función de Administrador (solo Ad Manager) para leer informes. Después pulsa{" "}
              <strong>Verificar acceso</strong> en la red correspondiente.
            </p>
            <code className="block rounded-md bg-muted px-3 py-2 text-xs break-all">{saEmail}</code>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Card key={row.networkCode}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{row.displayName}</span>
                    {row.isDefault ? (
                      <Badge variant="secondary" className="shrink-0">
                        <Star className="mr-1 h-3 w-3" />
                        Predeterminada
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="shrink-0">
                      {statusLabel(row.accessStatus)}
                    </Badge>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      title="Editar nombre visible"
                      disabled={busyCode === row.networkCode}
                      onClick={() => openEdit(row)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">Código: {row.networkCode}</p>
                  {row.lastError && row.accessStatus === "error" ? (
                    <p className="text-xs text-destructive break-words">{row.lastError}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busyCode === row.networkCode}
                    onClick={() => handleVerify(row.networkCode)}
                  >
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    Verificar acceso
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyCode === row.networkCode || row.accessStatus !== "ok"}
                    onClick={() => handleSync(row.networkCode)}
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Sincronizar
                  </Button>
                  {!row.isDefault ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busyCode === row.networkCode}
                        onClick={() => handleDefault(row.networkCode)}
                      >
                        Predeterminada
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        disabled={busyCode === row.networkCode}
                        onClick={() => openDeleteDialog(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">No hay redes registradas.</p>
          )}
        </div>
      )}

      <Dialog open={!!progressDialog}>
        <DialogContent
          hideClose
          className="sm:max-w-md border-border/60"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-left">
              <Loader2
                className="h-6 w-6 shrink-0 animate-spin text-primary"
                aria-hidden
              />
              <span>{progressDialog?.title}</span>
            </DialogTitle>
            <DialogDescription className="text-left pt-1 text-base leading-relaxed">
              {progressDialog?.description}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground font-mono">
            Código de red: {progressDialog?.networkCode}
          </p>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !busyCode) closeDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md border-border/60">
          <DialogHeader>
            <DialogTitle>Eliminar red del panel</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>
                  Vas a quitar la red{" "}
                  <span className="font-mono font-medium text-foreground">
                    {deleteTarget?.networkCode}
                  </span>{" "}
                  ({deleteTarget?.displayName || "sin nombre"}) de la configuración.
                </p>
                <p>
                  No se borran automáticamente los informes históricos ni las asignaciones de
                  subdominios en trabajadores; solo dejará de sincronizarse y de mostrarse en el
                  selector hasta que vuelvas a registrarla.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={closeDeleteDialog}
              disabled={busyCode === deleteTarget?.networkCode}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDelete}
              disabled={!!busyCode}
            >
              {busyCode === deleteTarget?.networkCode ? "Eliminando…" : "Eliminar red"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editRow} onOpenChange={(open) => (!open ? closeEdit() : null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar nombre visible</DialogTitle>
            <DialogDescription>
              Red <span className="font-mono">{editRow?.networkCode}</span>
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveDisplayName} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="gam-edit-display-name">Nombre visible</Label>
              <Input
                id="gam-edit-display-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre para el selector del panel"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={closeEdit}>
                Cancelar
              </Button>
              <Button type="submit" disabled={savingName || !editName.trim()}>
                {savingName ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
