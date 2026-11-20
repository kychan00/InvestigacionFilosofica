# Firebase · perfiles privados de investigación

Esta capa **no sustituye** el corpus público ni la analítica existente. Firebase se usa exclusivamente para identidad y datos privados creados o guardados por cada usuario.

## 1. Proyecto Firebase activo

Producción usa el proyecto:

- Project ID: `investigacion-filosofica`
- Firestore database: `(default)`
- Región: `northamerica-south1`
- Aplicación Web: Investigación Filosófica Web

El objeto `firebaseConfig` de producción ya está configurado en `js/firebase-config.js`.

El objeto de configuración del SDK Web identifica el proyecto y se entrega al navegador. La seguridad de los datos depende de Authentication + Firestore Security Rules, no de ocultar ese objeto.

## 2. Authentication

En **Security → Authentication → Sign-in method** active:

- Email/Password
- Google

En **Settings → Authorized domains** agregue como mínimo:

- `kychan00.github.io`
- `localhost` para pruebas locales

La aplicación exige verificación de correo para cuentas Email/Password. Las reglas de Firestore también comprueban `email_verified == true`.

Las plantillas de correo usan el remitente **Investigación Filosófica** y asuntos en español. El cliente fija `auth.languageCode = "es"` para solicitar a Firebase las acciones de correo en español.

## 3. Firestore

Cree una base Cloud Firestore y despliegue `firestore.rules`.

Estructura:

```text
users/{uid}
  library/{workId}
  savedAuthors/{authorId}
  projects/{projectId}
    subprojects/{subprojectId}
    works/{workId}
```

Cada ruta se restringe al UID autenticado y verificado.

## 4. Naturaleza de los datos

Las obras guardadas desde el motor se marcan como:

- `origin: "public-engine"`
- `privateOnly: false`

Las obras agregadas manualmente por el usuario se marcan como:

- `origin: "private-user-entry"`
- `privateOnly: true`

Una entrada privada nunca debe incorporarse automáticamente al corpus, los índices, las métricas públicas ni las fichas bibliográficas de Investigación Filosófica.

## 5. Estado de despliegue

Ya están configurados:

- Firebase Authentication con Email/Password y Google;
- `kychan00.github.io` y `localhost` como dominios autorizados;
- Cloud Firestore en `northamerica-south1`;
- reglas privadas por UID con requisito de correo verificado;
- configuración Web de producción.

Antes de considerar cerrada la validación funcional:

1. Pruebe registro por correo, verificación, login, Google y recuperación de contraseña en el despliegue real.
2. Compruebe con dos cuentas diferentes que ninguna pueda leer rutas del otro UID.
3. Considere activar Firebase App Check como defensa adicional para el cliente web.

## 6. Privacidad y licencia

La licencia MIT aplica al software del proyecto; no sustituye una política de privacidad.

Para crear e identificar una cuenta, la interfaz solicita un nombre visible y un correo electrónico. Las credenciales son gestionadas por Firebase Authentication. El contenido adicional —biblioteca, autores, proyectos, subproyectos, perfil y referencias privadas— solo se almacena cuando el usuario decide crearlo o guardarlo en su espacio privado.
