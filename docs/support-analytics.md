# Analítica privada de apoyo voluntario

La página de apoyo no registra pagos, importes, nombres, correos, identificadores de visitantes, cookies de seguimiento ni referencias de navegación completas. El navegador envía exclusivamente dos valores de un catálogo cerrado; PostgreSQL añade la fecha de Ciudad de México y un identificador aleatorio del evento, que no identifica al visitante. Los registros técnicos del proveedor de infraestructura quedan fuera de esta tabla.

| Evento | Significado |
|---|---|
| entry_click | Clic en el acceso del menú o en Acerca de hacia la página de apoyo. |
| page_view | Carga de la página de apoyo (incluidas recargas). |
| checkout_click | Clic hacia Mercado Pago, incluso desde Acerca de. No equivale a una aportación. |

Origen: menu, acerca o directo. Los valores de origen de enlaces no son una prueba de atribución individual. Los conteos pueden incluir recargas, bots y solicitudes automatizadas; no son usuarios únicos. Si el navegador solicita DNT o GPC, se omite el registro. Si falla la red o Supabase, el sitio y el enlace de pago siguen funcionando.

## Consulta privada

En el SQL Editor del proyecto Investigación Filosófica, con una cuenta administrativa:

```sql
select event_day, source,
  count(*) filter (where event_type = 'entry_click') as accesos,
  count(*) filter (where event_type = 'page_view') as visitas,
  count(*) filter (where event_type = 'checkout_click') as clics_mercado_pago
from private.support_events
where event_day >= (now() at time zone 'America/Mexico_City')::date - 29
group by event_day, source
order by event_day desc, source;
```

Los pagos realizados y sus importes se concilian por separado en Mercado Pago. No se puede atribuir un pago a una visita con esta información agregable.

## Permisos

La tabla está en el esquema privado con RLS. El rol anon únicamente puede insertar las columnas event_type y source y ejecutar el RPC de escritura con SECURITY INVOKER. No tiene SELECT, UPDATE o DELETE. No se usa una clave privilegiada en el cliente.

Migración aplicada en el proyecto: 20261124052006_private_support_analytics. Validación SQL: dos inserciones bajo rol anon dentro de una transacción revertida; cero filas de prueba persistentes. RLS activo, sin lectura para anon o authenticated, sin capacidad del rol anon de asignar la fecha y sin alertas de seguridad de Supabase en la revisión.

