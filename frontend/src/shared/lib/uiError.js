function extractMessage(error) {
  if (!error) return "";
  if (typeof error === "string") return error.trim();
  return String(error.message || "").trim();
}

const MESSAGE_RULES = [
  {
    test: (text) => text === "401" || text.includes("token") || text.includes("no autorizado"),
    message: "Tu sesión expiró. Inicia sesión nuevamente para continuar.",
  },
  {
    test: (text) => text.includes("credenciales fueron cambiadas"),
    message: "Tus credenciales fueron actualizadas por el administrador. Inicia sesión nuevamente.",
  },
  {
    test: (text) => text.includes("credenciales inválidas") || text.includes("invalid credentials"),
    message: "Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.",
  },
  {
    test: (text) => text.includes("network") || text.includes("failed to fetch"),
    message: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo nuevamente.",
  },
  {
    test: (text) => text.includes("429") || text.includes("too many requests"),
    message: "Hay muchas solicitudes en este momento. Intenta nuevamente en unos segundos.",
  },
  {
    test: (text) => text.includes("500") || text.includes("502") || text.includes("503"),
    message: "Ocurrió un problema temporal del servidor. Intenta nuevamente en unos segundos.",
  },
];

export function toUserErrorMessage(
  error,
  fallbackMessage = "Ocurrió un error. Inténtalo nuevamente.",
) {
  const rawMessage = extractMessage(error);
  if (!rawMessage) return fallbackMessage;
  const normalized = rawMessage.toLowerCase();
  const match = MESSAGE_RULES.find((rule) => rule.test(normalized));
  if (match) return match.message;
  return rawMessage;
}
