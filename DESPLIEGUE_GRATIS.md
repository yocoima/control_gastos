# Despliegue gratuito: GitHub Pages + Firestore + Cloudflare Worker

Esta versión no usa Cloud Functions ni Firebase Storage, por lo que el proyecto Firebase puede permanecer en el plan Spark.

## 1. Publicar el Worker de IA

Desde la carpeta `worker`:

```powershell
npm install
npx wrangler login
npx wrangler secret put GROQ_API_KEY
npm run deploy
```

### Si `wrangler login` muestra `request_forbidden`

El flujo OAuth puede reemplazarse por un API Token limitado:

1. Abre `https://dash.cloudflare.com/profile/api-tokens`.
2. Selecciona **Create Token** y utiliza la plantilla **Edit Cloudflare Workers** para tu cuenta.
3. Copia el token una sola vez y, en la misma ventana de PowerShell, ejecuta:

   ```powershell
   $secureToken = Read-Host "Cloudflare API Token" -AsSecureString
   $env:CLOUDFLARE_API_TOKEN = [Net.NetworkCredential]::new('', $secureToken).Password
   Remove-Variable secureToken
   npx wrangler whoami
   npx wrangler secret put GROQ_API_KEY
   npm run deploy
   Remove-Item Env:CLOUDFLARE_API_TOKEN
   ```

No pegues el API Token ni la clave de Groq en archivos versionados, capturas o conversaciones. El token permanece solamente en la sesión actual de PowerShell y se elimina al terminar.

### Si Wrangler termina con `fetch failed` usando Node 24 en Windows

Ejecuta Wrangler temporalmente con Node 22, conservando el token cargado en la sesión:

```powershell
$wrangler = ".\node_modules\wrangler\bin\wrangler.js"
npx --yes --package node@22 node $wrangler whoami
npx --yes --package node@22 node $wrangler secret put GROQ_API_KEY
npx --yes --package node@22 node $wrangler deploy
```

El valor de `GROQ_API_KEY` se guarda como secreto en Cloudflare y nunca se incorpora al navegador ni al repositorio. Al finalizar, copia la URL que entrega Wrangler, por ejemplo:

```text
https://control-gastos-ai.<tu-subdominio>.workers.dev
```

El Worker valida el token de Firebase y permite únicamente el correo configurado en `worker/wrangler.jsonc`.

## 2. Conectar GitHub Pages con el Worker

En GitHub abre **Settings > Secrets and variables > Actions > Variables** y crea:

```text
VITE_AI_WORKER_URL=https://control-gastos-ai.<tu-subdominio>.workers.dev
```

Después vuelve a ejecutar el workflow **Deploy to GitHub Pages**. Esta dirección no es secreta; la clave de Groq sí lo es y permanece únicamente en Cloudflare.

Para desarrollo local crea un archivo `.env.local` no versionado con la misma variable.

## 3. Firestore y evidencias

Las reglas ya se despliegan sin Blaze con:

```powershell
npx firebase-tools deploy --only firestore:rules --project control-de-gastos-e858a
```

Las imágenes nuevas se comprimen a menos de 420 KiB y se guardan individualmente en:

```text
artifacts/gastos-chile-v2/users/<uid>/monthly_records/<mes>/evidence/<id>
```

Esto conserva las imágenes antiguas y evita guardar todas las fotos dentro del documento mensual. Conviene vigilar en Firebase el consumo gratuito de almacenamiento, lecturas y escrituras.

## Verificación

1. Inicia sesión con `yocoimadejesus@gmail.com`.
2. Genera un análisis financiero y escanea una boleta.
3. Sube y elimina una evidencia general y una de arriendo.
4. Cambia de mes y confirma que cada mes muestra solamente sus evidencias.
5. Comprueba en Firestore que modificar o eliminar un movimiento actualiza los totales derivados.
