# PDFMaster - Editor y Suite de Herramientas PDF al estilo iLovePDF

Una aplicación web moderna, rápida y **100% privada** inspirada en la interfaz y practicidad de **iLovePDF**. Todos los procesos se ejecutan directamente en el navegador del usuario utilizando WebAssembly, Canvas y bibliotecas de procesamiento de PDF nativas, lo que garantiza que tus archivos **nunca salen de tu ordenador**.

---

## 🚀 Características y Herramientas Incluidas

1. **Unir PDF (Merge PDF)**
   - Combina múltiples documentos PDF en el orden que desees.
   - Reorganiza los archivos arrastrando o usando las flechas de posición.
   - Vista previa de número de páginas y tamaño de cada documento.

2. **Dividir PDF (Split PDF)**
   - Vistas en miniatura de todas las páginas del documento.
   - Modo de extracción visual de páginas seleccionadas.
   - Modo de división por rangos personalizados (ej: `1-3, 4-6`).
   - Modo de separación individual (descarga un ZIP con cada página en su propio PDF).

3. **Organizar PDF (Organize & Rotate)**
   - Cuadrícula visual con miniaturas interactivas de todas las páginas.
   - Reordena el orden de las páginas libremente.
   - Rota páginas 90° de manera individual o todas a la vez.
   - Elimina páginas innecesarias con opción de restaurarlas.

4. **Editar PDF (Visual PDF Editor & Signatures)**
   - Navegación interactiva entre páginas.
   - **Añadir Texto**: coloca cuadros de texto editables con tamaño y color personalizable.
   - **Dibujar / Lápiz**: trazos a mano alzada para anotaciones, correcciones o marcas.
   - **Firma Digital**: panel táctil para dibujar tu rúbrica e insertarla como un sello transparente en el documento.
   - **Insertar Imágenes**: coloca fotos, logos o firmas escaneadas.
   - Incorpora de forma permanente todos los elementos en el PDF final.

5. **Comprimir PDF (Compress PDF)**
   - 3 niveles de compresión: *Extrema*, *Recomendada* y *Baja*.
   - Medidor en tiempo real de porcentaje de reducción y megabytes ahorrados.

6. **JPG a PDF (Images to PDF)**
   - Convierte múltiples imágenes JPG, PNG o WebP a formato PDF.
   - Opciones de orientación (Vertical, Horizontal, Auto).
   - Formato A4 o ajustado al tamaño de la imagen, con márgenes configurables.

7. **PDF a JPG / PNG (PDF to Images)**
   - Extrae todas las páginas de un PDF en imágenes JPG o PNG de alta resolución (hasta 300 DPI).
   - Descarga imágenes individuales o todas empaquetadas en un archivo `.ZIP`.

8. **Marca de Agua (Watermark)**
   - Inserta marcas de agua como *CONFIDENCIAL*, *BORRADOR*, *COPIA* o texto personalizado.
   - Configura ángulo (0°, 45°), opacidad, color, tamaño y modo mosaico.
   - Vista previa en tiempo real sobre la primera página del documento.

9. **Proteger PDF (Password Protect)**
   - Protege tu PDF con una contraseña de cifrado estándar RC4 de 128 bits.
   - Compatible con cualquier visor de PDF estándar (Adobe Reader, Chrome, Edge).

---

## 🔒 Privacidad y Rendimiento

- **Cero subidas a la nube**: A diferencia de servicios tradicionales que requieren subir tus documentos a servidores remotos, **PDFMaster** procesa todo localmente con `pdf-lib` y `pdfjs-dist`.
- **Sin límites**: Procesa documentos del tamaño y páginas que necesites sin pagar suscripciones.

---

## 🛠️ Tecnologías Utilizadas

- **React 19** + **TypeScript**
- **Vite**
- **Tailwind CSS**
- **pdf-lib**
- **pdfjs-dist**
- **@pdfsmaller/pdf-encrypt-lite**
- **JSZip**
- **Lucide React** (Iconos modernos)
- **Canvas-Confetti**

---

## 💻 Cómo Ejecutar el Proyecto

1. Abrir la terminal en esta carpeta (`Editor PDF`).
2. Iniciar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
3. Abre tu navegador en la URL que aparece en la consola (por defecto: `http://localhost:5173`).

Para generar una versión optimizada de producción:
```bash
npm run build
```
O para previsualizar la compilación:
```bash
npm run preview
```
