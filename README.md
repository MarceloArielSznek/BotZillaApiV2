# 🦖 BotZilla API v2

BotZilla es un sistema de notificaciones inteligente que integra múltiples fuentes de datos a través de una API robusta y un dashboard interactivo.

## 🎨 Guía de Estilos

### Paleta de Colores Principal (Botzilla)

```css
/* Colores Principales de Botzilla */
--botzilla-green: #4CAF50;     /* Verde principal del cuerpo */
--botzilla-orange: #FF9800;    /* Naranja de las espinas */
--botzilla-cream: #F5F5DC;     /* Color crema del vientre */
--botzilla-black: #2C2C2C;     /* Negro de los goggles */
--botzilla-blue-bg: #E3F2FD;   /* Azul del fondo circular */
```

### Paleta Dark Mode

```css
/* Dark Mode Theme */
--dark-bg-primary: #1A1C1E;    /* Fondo principal oscuro */
--dark-bg-secondary: #2D2F31;  /* Fondo secundario para cards y elementos */
--dark-surface: #373A3C;       /* Superficie de componentes */

/* Colores Adaptados */
--accent-primary: #6ECF73;     /* Verde Botzilla adaptado para dark mode */
--accent-secondary: #FFB74D;   /* Naranja Botzilla adaptado para dark mode */
--text-primary: #FFFFFF;       /* Texto principal */
--text-secondary: #B0B0B0;     /* Texto secundario */
--border-color: #404346;       /* Color de bordes */
```

### Uso de Colores

- **Fondos**:
  - Usar `--dark-bg-primary` como fondo principal de la aplicación
  - `--dark-bg-secondary` para cards y elementos elevados
  - `--dark-surface` para componentes interactivos

- **Acentos**:
  - `--accent-primary` para botones principales y elementos de acción
  - `--accent-secondary` para destacados y alertas
  - Usar los colores de Botzilla estratégicamente para mantener la identidad

- **Texto**:
  - `--text-primary` para texto principal
  - `--text-secondary` para texto secundario y descripciones

## 🎯 Características Principales

- Dashboard interactivo con React
- Sistema de autenticación y autorización
- Integración con Make.com
- Sistema de notificaciones
- Gestión de usuarios y roles
- Monitoreo de eventos y logs

## 🔒 Seguridad

- Tokens de autenticación
- Sistema de roles y permisos
- Validaciones robustas
- Headers de seguridad
- Rate limiting

## 🛠 Stack Tecnológico

### Backend
- Node.js
- Express
- JWT para autenticación
- PM2 para gestión de procesos

### Frontend
- React
- Sistema de componentes moderno
- Diseño responsive
- Tema dark mode personalizado

### Integraciones
- Make.com para automatizaciones
- Telegram Bot API
- Google Sheets API

## 🚀 Deployment
- Servidor con PM2
- Cloudflare para seguridad y rendimiento

---

*BotZilla: Automatización con actitud* 🦖 