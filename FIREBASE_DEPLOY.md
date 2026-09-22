# Activación segura de Firebase

El frontend ya no contiene la clave de Groq. Antes de publicar esta versión hay que desplegar la función, las reglas y configurar el secreto en el proyecto `control-de-gastos-e858a`.

## Primera instalación

1. Inicia sesión y selecciona el proyecto:

   ```bash
   npx firebase-tools login
   npx firebase-tools use control-de-gastos-e858a
   ```

2. Guarda la clave como secreto de Cloud Functions (no uses una variable `VITE_*`):

   ```bash
   npx firebase-tools functions:secrets:set GROQ_API_KEY
   ```

3. Despliega backend y reglas:

   ```bash
   npx firebase-tools deploy --only functions,firestore:rules,storage
   ```

4. Publica el frontend en GitHub Pages mediante el workflow existente.

## Verificación

- Inicia sesión con `yocoimadejesus@gmail.com`.
- Genera un análisis financiero y escanea una boleta.
- Sube y elimina una evidencia general y una de arriendo.
- Confirma en Firebase Storage que los nuevos archivos estén bajo `users/<uid>/<mes>/`.
- Verifica que otro usuario no pueda leer ni escribir documentos o archivos.

Las evidencias antiguas en Base64 seguirán mostrándose. Las nuevas se almacenan en Firebase Storage. No elimines el secreto de GitHub anterior hasta haber publicado y validado esta versión; después puede revocarse y borrarse del repositorio de secretos.

