# Guía del Sistema de Automatización y Notificaciones de BotZilla

Este documento explica el funcionamiento y la configuración del sistema de automatización y notificaciones de BotZilla, diseñado para integrarse con servicios como **Make.com**.

## Visión General

El sistema está diseñado para realizar tres tareas diarias principales de forma automatizada:

1.  **Sincronizar Datos**: Actualizar la base de datos local con los últimos "estimates" de la fuente externa (Attic Tech).
2.  **Notificar a Vendedores**: Enviar una notificación individual a cada vendedor (SalesPerson) para advertirle si ha superado el límite de leads activos o para felicitarle si ha vuelto a estar por debajo.
3.  **Notificar a Gerencia**: Enviar un informe consolidado a cada Gerente de Sucursal (Manager) y un resumen general a todos los Administradores (Admins).

## Flujo de Trabajo Diario Recomendado

Para una correcta ejecución, estas tareas deben realizarse en orden. Se recomienda configurar un escenario en Make.com que ejecute los siguientes pasos de forma secuencial:

---

### **Paso 1: Sincronizar los Estimates (Sync Estimates)**

Este es el primer paso y el más crucial. Se asegura de que la base de datos de BotZilla tenga la información más reciente antes de generar cualquier notificación.

-   **Endpoint**: `POST /api/automations/estimates/sync-external`
-   **Propósito**: Inicia el proceso de "escaneo" que se conecta a Attic Tech, descarga los estimates recientes y los guarda en la base de datos local.
-   **Configuración en Make.com**:
    -   Un módulo **HTTP** que llame a este endpoint.
    -   Debe ejecutarse **primero** que cualquier otro paso de notificación.

---

### **Paso 2: Notificar a los Vendedores (Notify Salespersons)**

Una vez que los datos están sincronizados, este endpoint genera las notificaciones individuales para los vendedores.

-   **Endpoint**: `POST /api/notifications/salesperson-warnings`
-   **Propósito**: Analiza todos los vendedores y prepara un array de notificaciones. La respuesta contiene un objeto por cada vendedor que necesite ser notificado (ya sea por una advertencia o una felicitación).
-   **Parámetro Opcional**: Incluye un modo de prueba (`?dryRun=true`) que permite ver la salida sin modificar la base de datos (muy útil para depurar).
-   **Configuración en Make.com**:
    1.  Módulo **HTTP** para llamar al endpoint.
    2.  El módulo de **Telegram** debe **iterar** sobre el array devuelto por la API para enviar un mensaje por cada notificación.

---

### **Paso 3: Notificar a Gerentes y Administradores (Notify Managers & Admins)**

Este es el último paso, que genera los informes consolidados para la gerencia.

-   **Endpoint**: `POST /api/notifications/manager-warnings`
-   **Propósito**: Genera un único array que contiene dos tipos de notificaciones:
    1.  **Para Managers**: Un mensaje formateado para cada manager, listando solo los vendedores de *su* sucursal que tienen advertencias.
    2.  **Para Admins**: Un mensaje de resumen general del estado de las advertencias en toda la empresa.
-   **Configuración en Make.com**:
    1.  Módulo **HTTP** para llamar al endpoint.
    2.  El módulo de **Telegram** debe **iterar** sobre el array devuelto para enviar cada notificación a su destinatario.

## Configuración General Importante

-   **Clave de API**: Todos los endpoints de esta guía están protegidos y requieren una `X-API-Key` en la cabecera de la solicitud.
-   **Parse Mode en Telegram**: Para todos los módulos de Telegram, es **crucial** establecer el `Parse Mode` en `HTML`. Esto asegura que los saltos de línea y el formato en negrita (`<b>`) se muestren correctamente.
-   **IDs de Telegram**: Asegúrate de que los `telegram_id` estén correctamente configurados en la base de datos para todos los `Users` (Admins, Managers) y `SalesPersons` que deban recibir notificaciones.

---
*Esta guía asegura que cualquier miembro del equipo pueda entender y configurar el flujo completo de automatización y notificaciones de BotZilla.* 