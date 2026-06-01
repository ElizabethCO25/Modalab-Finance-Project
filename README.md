Instrucciones para la interfaz de finanzas

- Archivo principal: `finance.html` (ubicado en esta carpeta).
- Abre la carpeta `mighty-html` en Visual Studio o Visual Studio Code.
- Para ver la página en el navegador desde VS Code: instala la extensión Live Server y haz clic en "Go Live", o ejecuta un servidor local:

  Para Python 3:

  ```bash
  python -m http.server 5500
  ```

  Luego abre `http://localhost:5500/finance.html`.

- La página guarda los registros en `localStorage` del navegador (no necesita servidor). Puedes exportar CSV o imprimir el reporte.
- Si quieres integrar en Visual Studio (IDE): crea un nuevo proyecto Web estático y añade `finance.html` y las carpetas `assets/js` y `assets/css`.
