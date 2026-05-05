import { useEffect, useState } from "react";
import {
  fetchAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
} from "../../../shared/api/auth";

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
    <section className="admin-profile">
      <h2>Perfil</h2>

      <div className="admin-profile-grid">
        <form className="admin-profile-card" onSubmit={handleProfileSubmit}>
          <h3>Tu cuenta</h3>
          <label className="worker-edit-label">
            Nombre
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="worker-edit-label">
            Correo
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          {profileErr && <p className="form-error">{profileErr}</p>}
          {profileMsg && <p className="form-success">{profileMsg}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn" disabled={profileSaving}>
              {profileSaving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>

        <form className="admin-profile-card" onSubmit={handlePasswordSubmit}>
          <h3>Contraseña</h3>
          <label className="worker-edit-label">
            Contraseña actual
            <div className="worker-edit-password-row">
              <input
                className="form-input"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCurrentPassword((prev) => !prev)}
                aria-label={showCurrentPassword ? "Ocultar contraseña actual" : "Mostrar contraseña actual"}
              >
                {showCurrentPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          <label className="worker-edit-label">
            Nueva contraseña
            <div className="worker-edit-password-row">
              <input
                className="form-input"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowNewPassword((prev) => !prev)}
                aria-label={showNewPassword ? "Ocultar nueva contraseña" : "Mostrar nueva contraseña"}
              >
                {showNewPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          <label className="worker-edit-label">
            Confirmar nueva contraseña
            <div className="worker-edit-password-row">
              <input
                className="form-input"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
                aria-label={showConfirmPassword ? "Ocultar confirmación de contraseña" : "Mostrar confirmación de contraseña"}
              >
                {showConfirmPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </label>
          {passwordErr && <p className="form-error">{passwordErr}</p>}
          {passwordMsg && <p className="form-success">{passwordMsg}</p>}
          <div className="modal-actions">
            <button type="submit" className="btn" disabled={passwordSaving}>
              {passwordSaving ? "Actualizando…" : "Cambiar contraseña"}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-profile-card admin-profile-readonly">
        <h3>Última sesión</h3>
        <p className="admin-profile-readonly-value">Último login: {formatLastLogin(lastLoginAt)}</p>
      </div>
    </section>
  );
}
