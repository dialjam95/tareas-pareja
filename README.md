# Tareas de a dos (Firebase, plan Spark)

## 1. Firebase Console (console.firebase.google.com)
1. Crea un proyecto (plan Spark, sin tarjeta). Añade una **app web** y copia su config a `public/firebase-config.js`.
2. **Authentication** > Sign-in method > activa *Correo/contraseña*. En *Users* > *Add user* crea las dos cuentas. Si en Settings > User actions aparece "Enable create (sign-up)", desactívalo.
3. **Firestore Database** > Crear base de datos (modo producción, región cercana).
4. **Cloud Messaging** > Certificados push web > *Generar par de claves*; pega la clave en `VAPID_KEY`.
5. Edita `firestore.rules` con los dos correos.

## 2. Desplegar
    npm i -g firebase-tools
    firebase login
    firebase use --add        # elige tu proyecto
    firebase deploy --only hosting,firestore:rules

## 3. Recordatorios (GitHub Actions)
1. Sube esta carpeta a un repo de GitHub **público** (no contiene secretos; la config web de Firebase es pública y las reglas protegen los datos).
2. Console > Configuración > Cuentas de servicio > *Generar nueva clave privada*.
3. En GitHub: Settings > Secrets and variables > Actions > nuevo secreto `FIREBASE_SERVICE_ACCOUNT` con **todo** el JSON. Nunca lo subas al repo.
4. Pestaña Actions > Recordatorios > *Run workflow* para probar.

## 4. En los teléfonos
Abre la URL de Hosting, inicia sesión y toca **Activar avisos**.
- Android: menú de Chrome > Instalar app.
- iPhone (iOS 16.4+): Compartir > *Añadir a pantalla de inicio*, abre desde el icono y entonces activa avisos.

## Notas
- GitHub ejecuta el cron cada ~5 min y puede retrasarse unos minutos. En repos públicos es gratis; en uno privado 5 min consumiría más minutos de los gratuitos: usa `0 * * * *` (cada hora).
- GitHub desactiva los workflows programados tras 60 días sin actividad en el repo; reactívalos desde Actions.
- Si necesitas hora exacta: pasa a Blaze y reemplaza el workflow por una Cloud Function programada.
