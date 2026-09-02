# OPEN AI WORKSTATION

PWA móvil-first para el **Orquestador Universal de Google Colab**.

Consola profesional oscura y minimalista para cargar, ejecutar, detener, configurar y administrar **cualquier** cuaderno `.ipynb` a través de un backend común.

> OpenCode (u cualquier otro proyecto) es solo un caso de uso. El frontend no está acoplado a ningún notebook específico.

## Características

- **PWA real**: instalable en Android, iOS, Windows, macOS, Linux
- Diseño mobile-first + sidebar en desktop
- Estado real de Colab / Drive / Orquestador
- Lista de proyectos (cuadernos) con control total
- Carga y análisis de cualquier `.ipynb`
- Sistema de manifest para APIs, dependencias y servicios
- Gestión segura de credenciales (nunca se guardan en el frontend)
- Servicios activos con URLs dinámicas
- Terminal del runtime
- Explorador de archivos del workspace
- Polling de `/api/status` (preparado para WebSocket/SSE)
- Offline shell vía Service Worker

## Estructura

```
open-ai-workstation/
├── index.html
├── manifest.json
├── sw.js
├── css/styles.css
├── js/
│   ├── api.js      # Cliente REST del orquestador
│   └── app.js      # Lógica de la UI
└── icons/
    ├── icon-192.svg
    ├── icon-512.svg
    └── (png opcional)
```

## Cómo usar

1. Serví la carpeta con cualquier servidor estático (o desde Colab/ngrok).
2. Abrí la app en el navegador.
3. En la pantalla inicial ingresá la **URL del Orquestador** (ej. `https://xxxx.ngrok-free.app`).
4. La app consulta los endpoints reales del backend.

### Endpoints esperados (mínimos)

```
GET  /api/status
GET  /api/projects
POST /api/projects
GET  /api/projects/{id}
POST /api/projects/{id}/start
POST /api/projects/{id}/stop
POST /api/projects/{id}/restart
POST /api/projects/{id}/save
GET  /api/projects/{id}/services
POST /api/projects/{id}/credentials
GET  /api/services
GET  /api/files
POST /api/files/upload
DELETE /api/files
POST /api/terminal
POST /api/projects/analyze
```

Si un endpoint no existe o falla, la interfaz muestra **«No disponible»** (nunca inventa datos).

## Principios

- El backend proporciona capacidades universales.
- Cada proyecto (notebook + manifest) define qué necesita.
- Cero hardcode de proveedores, puertos o APIs específicas.
- Las claves API nunca se almacenan en HTML, JS, localStorage ni se devuelven en `/api/status`.

## Desarrollo local

```bash
# Cualquier servidor estático
npx serve .
# o
python -m http.server 8080
```

Luego abrí `http://localhost:8080`.

## Versión

v1.0 — Frontend listo para conectar al Orquestador Universal V7 de Google Colab.
