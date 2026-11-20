# Firebase · perfiles privados de investigación

Esta capa **no sustituye** el corpus público ni la analítica existente. Firebase se usa exclusivamente para identidad y datos privados creados o guardados por cada usuario.

## 1. Crear o seleccionar un proyecto Firebase

En Firebase Console:

1. Cree un proyecto.
2. Añada una aplicación Web.
3. Copie el objeto `firebaseConfig`.
4. Pegue sus valores en `js/firebase-config.js`.

El objeto de configuración del SDK Web identifica el proyecto y se entrega al navegador. La seguridad de los datos depende de Authentication + Firestore Security Rules, no de ocultar ese objeto.

## 2. Authentication

En **Security → Authentication → Sign-in method** active:

- Email/Password
- Google

En **Settings → Authorized domains** agregue como mínimo:

- `kychan00.github.io`
- `localhost` para pruebas locales

La aplicación exige verificación de correo para cuentas Email/Password. Las reglas de Firestore también comprueban `email_verified == true`.

Personalice, si lo desea, las plantillas de:

- verificación de correo;
- restablecimiento de contraseña.

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

## 5. Despliegue recomendado

Antes de fusionar a producción:

1. Configure Firebase.
2. Despliegue las reglas.
3. Pruebe registro por correo, verificación, login, Google y recuperación de contraseña.
4. Compruebe con dos cuentas diferentes que ninguna pueda leer rutas del otro UID.
5. Considere activar Firebase App Check como defensa adicional para el cliente web.
