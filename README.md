# COLAB WORKSTATION

**Capa universal de administración para notebooks de Google Colab.**

No es un IDE acoplado a un proyecto concreto. Es una PWA mobile-first + un Orquestador Universal que corre dentro de Colab y permite cargar, analizar, configurar, ejecutar y administrar **cualquier** `.ipynb`.

```
Usuario (PWA)
    ↓ HTTP
Orquestador Universal (Colab)
    ↓
Cualquier notebook .ipynb
```

## Características

- PWA instalable (iPhone, Android, desktop)
- Mobile-first + sidebar en desktop
- Estado real: Colab / Drive / Orquestador
- **Cuadernos** genéricos (no “proyectos” de un proveedor)
- Carga y análisis automático de `.ipynb`
- Manifest opcional `colab-workstation.json`
- Credenciales seguras (nunca en frontend ni en `/api/status`)
- Servicios detectados dinámicamente
- Explorador de archivos del workspace
- Terminal web
- Persistencia en Google Drive
- Watchdog de procesos
- Compatible con GitHub Pages (frontend estático)

## Arquitectura

```
frontend/          → PWA (HTML/CSS/JS) en GitHub Pages o estático
orchestrator/      → FastAPI que corre en Colab
colab/             → ORCHESTRATOR.ipynb (punto de entrada)
examples/          → notebook de ejemplo + manifest
docs/              → API y manifest
schemas/           → JSON Schema del manifest
```

## Inicio rápido

### 1. Lanzar el orquestador en Colab

1. Abrí [`colab/ORCHESTRATOR.ipynb`](colab/ORCHESTRATOR.ipynb) en Google Colab.
2. Ejecutá todas las celdas.
3. Copiá la URL pública (ngrok / túnel) que imprime el notebook.

### 2. Abrir la PWA

- GitHub Pages del repo, o
- `npx serve .` / `python -m http.server 8080` en la raíz del frontend.

Pegá la URL del orquestador en la pantalla de conexión.

### 3. Cargar un cuaderno

1. **Cargar** → seleccioná cualquier `.ipynb`
2. El orquestador lo analiza
3. Configurá credenciales si hace falta
4. **Iniciar** → servicios detectados aparecen en **Servicios**

### 4. Ejemplo incluido

```
examples/example-notebook/
  example.ipynb
  colab-workstation.json
```

Levanta un servidor HTTP de prueba en el puerto 8766.

## API (resumen)

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Salud |
| GET | `/api/status` | Estado Colab/Drive/Orq + contadores |
| GET/POST | `/api/notebooks` | Listar / subir |
| POST | `/api/notebooks/{id}/start\|stop\|restart\|save` | Control |
| POST | `/api/notebooks/analyze` | Analizar sin guardar |
| GET | `/api/services` | Servicios activos |
| GET | `/api/files` | Explorador |
| POST | `/api/terminal` | Ejecutar comando |

Documentación completa: [`docs/api.md`](docs/api.md)

## Manifest

Ver [`docs/notebook-manifest.md`](docs/notebook-manifest.md).

El manifest es **opcional**. Sin él, el analizador infiere imports, `pip install`, puertos y pistas de credenciales.

## Seguridad

- Los secretos **nunca** se guardan en `localStorage`, HTML, JS ni se devuelven por la API de status.
- El frontend solo recibe `{ "configured": true }`.
- El Service Worker no cachea respuestas de API.

## Desarrollo local del orquestador

```bash
pip install -r requirements.txt
export CW_WORKSPACE=/tmp/cw_workspace
python -m orchestrator.main
# o: uvicorn orchestrator.main:app --host 0.0.0.0 --port 8765
```

## Principios

1. El notebook define qué necesita.
2. COLAB WORKSTATION provee la infraestructura.
3. Cero hardcode de proveedores, OpenCode, NVIDIA, Gradio, etc. como categorías de producto.
4. Datos reales del backend — sin mocks.

## Licencia

Ver repositorio.
