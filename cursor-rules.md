# PROJECT: Ad Revenue Dashboard (POST-MVP → PRODUCTION READY)

---

## 🎯 OBJETIVO

Evolucionar el MVP a un sistema estable, mantenible y escalable que:

- Integra Google Ad Manager API
- Calcula ingresos correctamente
- Asigna ganancias a workers según porcentaje
- Muestra métricas tipo AdSense (today, yesterday, 7 days, month)
- Garantiza aislamiento de datos (workers solo ven su ganancia)
- Listo para agregar nuevas features que te vaya pidiendo

---

## 🧠 PRINCIPIOS CLAVE

- Mantener simplicidad (NO sobreingeniería)
- Desarrollo iterativo
- Backend responsable de TODA la lógica
- Separación clara de responsabilidades
- Exactitud de datos financieros es PRIORIDAD
- No romper comportamiento existente

---

## 🚫 REGLAS CRÍTICAS

- NO reescribir lógica existente sin motivo
- NO cambiar contratos de API sin necesidad
- NO mover archivos fuera de la arquitectura definida
- NO mezclar capas
- NO agregar dependencias sin justificación clara

---

## 🏗️ ARQUITECTURA OFICIAL (OBLIGATORIA)

### Backend (Arquitectura por capas)

backend/src/
├── server.js
├── app.js
├── api/
│ ├── routes/
│ ├── controllers/
│ └── middleware/
├── application/
│ └── services/
├── domain/
│ └── repositories/
├── infrastructure/
│ ├── config/
│ ├── database/
│ └── integrations/
└── shared/
└── errors/

---

## 📌 RESPONSABILIDADES POR CAPA

### api/

- routes → definen endpoints
- controllers → manejan request/response
- middleware → auth, validación, etc.

❌ NO lógica de negocio aquí

---

### application/services/

- lógica de negocio (CRÍTICO)
- cálculos de ingresos
- orquestación de datos

✔ aquí vive el corazón del sistema

---

### domain/repositories/

- acceso a base de datos
- queries
- abstracción de persistencia

❌ NO lógica de negocio

---

### infrastructure/

- config (env, variables)
- database (setup, conexión)
- integrations (Ad Manager API)

---

### shared/

- errores comunes
- utilidades compartidas

---

## 🔁 FLUJO DE DATOS (OBLIGATORIO)

Client → Frontend → API Routes → Controllers → Services → Repositories → Database
↓
Integrations (Ad Manager)

---

## 💰 LÓGICA DE NEGOCIO (CRÍTICA)

- Los workers NO ven datos brutos
- Los workers SOLO ven su ganancia

Fórmula:

worker_payout = revenue * percentage

---

## 📊 DASHBOARD (WORKER)

Mostrar únicamente:

- Ingresos hoy (estimado)
- Ingresos ayer
- Últimos 7 días
- Este mes

❌ Nunca mostrar:

- ingresos totales del subdominio
- ingresos globales de la red
- cálculos intermedios

---

## 🌐 INTEGRACIÓN AD MANAGER

- network code ≠ subdominio
- un network contiene múltiples subdominios

Flujo:

1. Obtener métricas externas
2. Mapear subdominios de la red desde Ad Manager API
3. Aplicar lógica de negocio
4. Devolver datos agregados

---

## 🧪 TESTING

Tests obligatorios:

- cálculo de ingresos
- porcentaje
- agregación por fechas

Ejecutar siempre:

- backend: `npm test`
- frontend: `npm run build`

---

## 🎨 FRONTEND (ARQUITECTURA)

frontend/src/
├── main.jsx
├── app/
│ └── App.jsx
├── features/
│ ├── auth/
│ ├── admin/
│ └── worker/
├── shared/
│ └── api/
└── styles/

---

## 📌 REGLAS FRONTEND

- features = lógica de UI por subdominio
- shared = código reutilizable
- NO lógica de negocio compleja en frontend
- consumir datos ya procesados del backend

---

## 🔁 ESTRATEGIA DE DESARROLLO

1. NO romper funcionalidad existente
2. Cambios pequeños e iterativos
3. Validar después de cada cambio
4. Refactorizar solo cuando sea necesario

---

## ✅ CRITERIOS DE CALIDAD

- arquitectura respetada
- servicios limpios
- controllers simples
- datos correctos
- código mantenible

---

## 🧠 MENTALIDAD FINAL

Este proyecto es:

- un sistema real
- una base para escalar
- un producto, no un experimento

---

## 🚀 REGLA FINAL

Construir simple.
Respetar arquitectura.
No romper lo que ya funciona.
Iterar constantemente.
