# my-app

App móvil (Expo SDK 58 + React Native Paper) con registro e inicio de sesión de usuarios contra un backend **Strapi 5** con **PostgreSQL**, ambos corriendo en Docker.

## Estructura

El proyecto está dividido en dos carpetas hermanas:

```
tci/my-app/
├── backend/    ← Strapi 5 + PostgreSQL (docker-compose.yml)
└── my-app/     ← esta app Expo
```

> Cada comando se corre en su carpeta. Si ejecutas `npx expo start` dentro de `backend/` verás el error
> `Cannot determine the project's Expo SDK version because the module expo is not installed`.

## Requisitos

- [Node.js](https://nodejs.org/) 22 o superior
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (con Docker Compose)
- [Expo Go](https://expo.dev/go) en el teléfono, o un emulador Android / simulador iOS

## 1. Levantar el backend (Strapi + PostgreSQL)

```bash
cd backend
```

**Solo la primera vez:** crea el archivo `.env` a partir de la plantilla y reemplaza cada `tobemodified` por un valor aleatorio:

```bash
cp .env.example .env
```

Para generar cada secreto puedes usar:

```bash
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

`APP_KEYS` lleva dos valores separados por coma.

Luego levanta los contenedores:

```bash
docker compose up -d --build
```

La primera vez tarda unos minutos en compilar. Strapi queda disponible en `http://localhost:1337` (puedes comprobarlo en `http://localhost:1337/_health`).

### Panel de administración

Entra a `http://localhost:1337/admin` y crea el usuario administrador. Desde ahí puedes ver los usuarios registrados en **Content Manager → User**.

Revisa también:

- **Settings → Users & Permissions → Roles → Public**: `register` y `callback` (login) habilitados.
- **Settings → Users & Permissions → Roles → Authenticated**: `User → me` habilitado.
- **Settings → Users & Permissions → Advanced settings**: *Enable email confirmation* desactivado (no hay servidor de correo configurado).

### Roles escolares

La app crea todas las cuentas nuevas como **alumno**. Al iniciar Strapi, también se crea el rol
**Administrador escolar**; no se puede elegir ese rol desde el formulario público.

Para autorizar a una persona administradora:

1. Registra su cuenta desde la app como cualquier alumno.
2. Entra al panel de Strapi y abre **Content Manager → User**.
3. Edita esa cuenta y cambia su rol a **Administrador escolar**.
4. Cierra e inicia sesión de nuevo en la app con esa cuenta.

El administrador puede asignar o actualizar el semestre, promedio y situación académica de las
cuentas de alumno. Cada alumno solo puede consultar su propia información; estas restricciones se
validan en el backend. Los datos se guardan en la colección `student_records` de PostgreSQL.

### Comandos útiles

```bash
docker compose ps               # estado de los contenedores
docker compose logs -f strapi   # ver logs de Strapi
docker compose stop             # apagar (los datos se conservan)
docker compose down             # eliminar contenedores (los datos se conservan en el volumen pgdata)
docker compose down -v          # eliminar contenedores Y la base de datos
```

## 2. Iniciar la app

```bash
cd my-app
npm install
```

Crea el archivo `.env` a partir de la plantilla:

```bash
cp .env.example .env
```

y ajusta `EXPO_PUBLIC_API_URL` según dónde corras la app:

| Dispositivo | Valor |
|---|---|
| Teléfono físico con Expo Go | `http://<IP-LAN-de-tu-PC>:1337` |
| Emulador Android | `http://10.0.2.2:1337` |
| Simulador iOS / web | `http://localhost:1337` |

Para saber la IP LAN en Windows ejecuta `ipconfig` y usa la dirección IPv4 del adaptador Wi-Fi o Ethernet. El teléfono y la PC deben estar en la misma red; si el teléfono no llega al backend, permite el puerto 1337 en el Firewall de Windows.

Inicia el servidor de desarrollo:

```bash
npx expo start
```

y escanea el código QR con Expo Go (o presiona `a` para Android / `i` para iOS).

> Si cambias el `.env`, reinicia `npx expo start` (con `--clear` si el valor no se actualiza).

## Cómo funciona la autenticación

La app usa el plugin **Users & Permissions** de Strapi:

| Acción | Endpoint |
|---|---|
| Registro | `POST /api/auth/local/register` |
| Login | `POST /api/auth/local` |
| Renovar sesión | `POST /api/auth/refresh` |
| Usuario actual | `GET /api/users/me` |
| Cerrar sesión | `POST /api/auth/logout` |

- `GET /api/school/me`: devuelve el rol y, para alumnos, únicamente sus propios datos académicos.
- `GET /api/school/students` y `POST /api/school/students`: listar alumnos y asignar/actualizar
  sus datos; están restringidos al rol **Administrador escolar**.
- El `jwt` dura **10 minutos**; el `refreshToken` se guarda en el dispositivo con `expo-secure-store` y se usa al abrir la app para obtener uno nuevo, así la sesión se mantiene.
- Al cerrar sesión, el refresh token se revoca en el servidor.

Código relevante:

- `src/api/auth.js`: llamadas al backend
- `src/context/AuthContext.js`: estado de la sesión (`login`, `logout`, restauración al iniciar)
- `src/components/LoginForm.jsx` y `src/components/RegisterForm.jsx`: formularios (Formik + Yup)
- `src/screens/Auth.jsx` y `src/screens/Home.jsx`: pantallas

## Problemas comunes

| Problema | Solución |
|---|---|
| `Cannot determine the project's Expo SDK version...` | Estás en `backend/`; corre `npx expo start` dentro de `my-app/`. |
| "No se pudo conectar con el servidor" en la app | Verifica que los contenedores estén arriba (`docker compose ps`), que `EXPO_PUBLIC_API_URL` tenga la IP correcta y el firewall. |
| `spawn yarnpkg ENOENT` al instalar paquetes | Usa `npx expo install <paquete> --npm`. |
