import { useEffect, useState } from "react";
import {
  fetchAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from "../../../shared/api/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import SectionHeader from "@/components/SectionHeader";

function formatLastLogin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Sin registro previo";
  const date = /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/.test(raw)
    ? new Date(raw.replace(" ", "T") + "Z")
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return "Sin registro previo";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AdminProfile({ onUserUpdated, onForceLogout }) {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lastLoginAt, setLastLoginAt] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const profile = await fetchAdminProfile();
        if (cancelled) return;
        setName(profile.name || "");
        setEmail(profile.email || "");
        setLastLoginAt(profile.lastLoginAt || null);
      } catch (err) {
        if (!cancelled) setProfileErr(err.message || "No se pudo cargar el perfil");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileErr("");
    setProfileMsg("");
    setProfileSaving(true);
    try {
      const updated = await updateAdminProfile({ name, email });
      setName(updated.name || "");
      setEmail(updated.email || "");
      setLastLoginAt(updated.lastLoginAt || null);
      setProfileMsg("Perfil actualizado correctamente.");
      onUserUpdated?.({ name: updated.name, email: updated.email });
    } catch (err) {
      setProfileErr(err.message || "No se pudo actualizar el perfil");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordErr("");
    setPasswordMsg("");
    if (newPassword !== confirmPassword) {
      setPasswordErr("La confirmación no coincide con la nueva contraseña");
      return;
    }
    setPasswordSaving(true);
    try {
      await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setPasswordMsg("Contraseña actualizada. Debes iniciar sesión nuevamente.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      onForceLogout?.("Tu contraseña fue actualizada. Inicia sesión nuevamente.");
    } catch (err) {
      setPasswordErr(err.message || "No se pudo cambiar la contraseña");
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return <p className="status-msg">Cargando perfil…</p>;
  }

  return (
    <section className="space-y-6">
      <SectionHeader
        title="Perfil"
        description="Actualiza tu informacion personal y credenciales de acceso."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tu cuenta</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div className="space-y-2">
                <Label htmlFor="admin-name">Nombre</Label>
                <Input
                  id="admin-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-email">Correo</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {profileErr && <p className="text-sm font-medium text-danger">{profileErr}</p>}
              {profileMsg && <p className="text-sm font-medium text-success">{profileMsg}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={profileSaving}>
                  {profileSaving ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handlePasswordSubmit}>
              <div className="space-y-2">
                <Label htmlFor="admin-current-password">Contraseña actual</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="admin-current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    aria-label={showCurrentPassword ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
                  >
                    {showCurrentPassword ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-new-password">Nueva contraseña</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="admin-new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
                  >
                    {showNewPassword ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-confirm-password">Confirmar nueva contraseña</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="admin-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Ocultar confirmacion de contraseña" : "Mostrar confirmacion de contraseña"}
                  >
                    {showConfirmPassword ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </div>
              {passwordErr && <p className="text-sm font-medium text-danger">{passwordErr}</p>}
              {passwordMsg && <p className="text-sm font-medium text-success">{passwordMsg}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? "Actualizando…" : "Cambiar contraseña"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultima sesion</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ultimo login</p>
          <p className="text-lg font-semibold tabular-nums">{formatLastLogin(lastLoginAt)}</p>
        </CardContent>
      </Card>
    </section>
  );
}
