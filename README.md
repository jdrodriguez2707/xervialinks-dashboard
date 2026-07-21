# 📊 XerviaLinks Dashboard

> Una plataforma de análisis y gestión de alto rendimiento para Google Ad Manager (GAM), que permite el seguimiento automatizado de ingresos publicitarios, pagos personalizados a trabajadores y asignación de ingresos por dominio en tiempo real.

---

## 📹 Video de Demostración

<!-- 🎬 ESPACIO RESERVADO PARA VIDEO DE DEMOSTRACIÓN -->
<!-- Reemplaza el enlace a continuación con tu video de demostración, enlace de YouTube o GIF animado -->
<div align="center">
  <a href="https://youtu.be/5sWEUIRuXsM" target="_blank">
    <img src="./frontend/src/assets/dashboard.png" width="800" alt="Ver Video de Demostración" />
    <p><strong>Ver la demostración y recorrido completo en video</strong></p>
  </a>
</div>

---

## 🖼️ Capturas de Pantalla

<!-- 📸 ESPACIOS RESERVADOS PARA CAPTURAS DE PANTALLA -->
<div align="center">
  <table width="100%">
    <tr>
      <td width="50%" align="center" valign="top">
        <h4>Portal del Trabajador</h4>
        <img src="./frontend/src/assets/portal-trabajador.png" alt="Portal del Trabajador" height="320" style="height: 320px; max-width: 100%; object-fit: contain;" />
        <p><em>Vista del trabajador con desglose por dominios, porcentajes de división de ingresos y estadísticas por fechas.</em></p>
      </td>
      <td width="50%" align="center" valign="top">
        <h4>Modo Oscuro y Claro</h4>
        <img src="./frontend/src/assets/portal-trabajador-white.png" alt="Interfaz en Modo Oscuro" height="320" style="height: 320px; max-width: 100%; object-fit: contain;" />
        <p><em>Conmutador de temas dinámico compatible con esquemas de color claros y oscuros.</em></p>
      </td>
    </tr>
    <tr>
      <td width="50%" align="center" valign="top">
        <h4>Gestión de Trabajadores</h4>
        <img src="./frontend/src/assets/trabajadores.png" alt="Gestión de Trabajadores" height="320" style="height: 320px; max-width: 100%; object-fit: contain;" />
        <p><em>Vista del administrador con la gestión de trabajadores y sus dominios asignados.</em></p>
      </td>
      <td width="50%" align="center" valign="top">
        <h4>Configuración de Códigos de Red</h4>
        <img src="./frontend/src/assets/codigos-de-red.png" alt="Códigos de Red GAM" height="320" style="height: 320px; max-width: 100%; object-fit: contain;" />
        <p><em>Gestión multired de códigos de Google Ad Manager y configuración de credenciales de cuenta de servicio.</em></p>
      </td>
    </tr>
  </table>
</div>

---

## ✨ Características Principales

### 👑 Panel de Control de Administrador
* **Resumen Completo de Métricas:** Visibilidad en tiempo real de Ingresos Brutos, Ganancias Netas, Pagos Pendientes y Trabajadores Activos.
* **Asignación de Trabajadores y Dominios:** Asignación de dominios a trabajadores con porcentajes de reparto de ingresos personalizados.
* **Gestión de Pagos:** Seguimiento de ganancias mensuales, marcado de estados de pago (`Pagado` vs `Pendiente`) y gestión del historial de pagos.
* **Soporte Multired GAM:** Manejo de múltiples códigos de red de Google Ad Manager y configuraciones de credenciales dentro de una sola instancia.
* **Motor de Sincronización Automatizado:** Programador en segundo plano flexible y endpoints de API para sincronizaciones por lotes y llenado retroactivo de datos históricos.

### 👥 Portal de Autoservicio para Trabajadores
* **Métricas de Rendimiento Aisladas:** Los trabajadores pueden consultar sus ganancias, el desglose del reparto de ingresos y sus historiales de pago específicos para sus dominios asignados.
* **Cambio de Dominio:** Alternancia sencilla entre subdominios gestionados para analizar el rendimiento de cada sitio web.
* **Transparencia en Liquidaciones:** Visibilidad completa sobre el estado de pago del mes actual y registros de desembolsos pasados.

---

## 🛠️ Stack Tecnológico

| Dominio | Tecnología | Detalles |
| :--- | :--- | :--- |
| **Framework Frontend** | React 18 + Vite | HMR ultrarrápido, arquitectura de UI basada en componentes |
| **Componentes de UI** | Tailwind CSS + Radix UI | Sistema de diseño personalizado, layouts responsivos, íconos Lucide |
| **Motor Backend** | Node.js + Express | Patrón de diseño Clean Architecture / DDD |
| **Base de Datos** | SQLite (`better-sqlite3`) | Base de datos relacional embebida SQL de alta velocidad |
| **Integraciones** | Google Ad Manager API | Integración mediante `google-auth-library` con fallback de datos mock |
| **Autenticación y Seguridad** | JWT + bcrypt | Tokens Bearer seguros, contraseñas encriptadas, limitación de tasa y cabeceras Helmet |
| **Gestor de Paquetes** | `pnpm` | Gestor de paquetes eficiente listo para monorepos |

---

## 📄 Licencia

Este proyecto está bajo la Licencia [MIT](LICENSE).
