# Referencia registrada

Referencia controlada de persistencia tras validar tres matrices independientes de 23 escenarios y sus tres comparaciones estrictas con igualdad exacta. Se completa la confirmación de recuperación en el navegador antes de cerrar; sustituye el método variable, sin aprobar consumo ni declarar ahorro del producto.

Esta captura conserva las mediciones originales; no aprueba su consumo como objetivo.

Se validaron tres ejecuciones independientes de 23 escenarios. Cada par obtuvo código 0 y equality completo: 4.573 mediciones, 18.084 cantidades costeadas y 14.133 partidas monetarias sin diferencias. Las fechas y RSS locales conservan sus valores propios.

repeatability-validation.json conserva condiciones, hashes de las tres capturas y de los tres informes. Los informes completos permanecen en las rutas locales que identifica ese manifiesto. reference-record.json documenta el registro explícito; reference.json conserva los bytes originales de la primera captura.

La referencia inicial permanece en ../persistence-2026-11-13 como evidencia histórica, sin conversión. El cambio de método no se presenta como ahorro del producto.

# Referencia de persistencia pública

Revisión base: 7c3f5715fdd1350e57c92026c8d01bfd6b467d59. Fecha: 2026-11-14T04:53:08.216Z.

Consumo actual medido en emuladores y presupuesto calculado antes de desplegar. Esta referencia no aprueba su consumo como objetivo.

Alcance monetario: recursos de Google Cloud del runtime. Moneda USD, bruto antes de cuotas, descuentos e impuestos. Un experimento, sesiones al inicio del horizonte de 30 días. Plan/espacio del proveedor, publicación, construcción y despliegue fuera de este alcance.

| Escenario | Eventos CSV | Lecturas | Escrituras | Borrados | Functions | Docs retenidos de sesión | USD variable/sesión | USD 1.000 sesiones + fijo | Rango 1.000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| normal-true-0 | 5 | 117 | 44 | 6 | 31 | 8 | 0.00045817 | 1.23075589 | 1.09201435–7.21155921 |
| normal-true-1 | 5 | 125 | 56 | 6 | 39 | 8 | 0.00055023 | 1.32282252 | 1.16194832–7.71566188 |
| normal-true-3 | 5 | 119 | 47 | 6 | 33 | 8 | 0.00048119 | 1.25377916 | 1.10950388–7.34621225 |
| normal-false-0 | 5 | 125 | 56 | 6 | 39 | 8 | 0.00055024 | 1.32282517 | 1.16195073–7.71566533 |
| normal-false-1 | 5 | 125 | 56 | 6 | 39 | 8 | 0.00055024 | 1.32282517 | 1.16195073–7.71566533 |
| normal-false-3 | 5 | 125 | 56 | 6 | 39 | 8 | 0.00055024 | 1.32282517 | 1.16195073–7.71566533 |
| volume-3 | 3 | 101 | 38 | 4 | 31 | 6 | 0.00043286 | 1.20544602 | 1.06924534–7.18619382 |
| volume-30 | 30 | 321 | 125 | 31 | 35 | 33 | 0.00082281 | 1.59540027 | 1.41545319–7.84559632 |
| volume-300 | 300 | 2538 | 1017 | 301 | 92 | 303 | 0.00488980 | 5.66238670 | 5.06798041–15.33948257 |
| visual-true | 3 | 105 | 44 | 4 | 35 | 6 | 0.00047913 | 1.25172131 | 1.10443716–7.45578465 |
| visual-false | 3 | 105 | 44 | 4 | 35 | 6 | 0.00047913 | 1.25172362 | 1.10443927–7.45578767 |
| resume-true | 5 | 162 | 67 | 6 | 58 | 8 | 0.00071942 | 1.49201034 | 1.29658921–8.73608841 |
| resume-false | 5 | 162 | 67 | 6 | 58 | 8 | 0.00071943 | 1.49201471 | 1.29659320–8.73609411 |
| expiry-true-0 | 2 | 100 | 38 | 3 | 38 | 6 | 0.00045430 | 1.22689349 | 1.09443994–7.47570658 |
| expiry-true-3 | 2 | 100 | 38 | 3 | 38 | 6 | 0.00045430 | 1.22689349 | 1.09443994–7.47570658 |
| expiry-false-1 | 2 | 104 | 39 | 3 | 39 | 5 | 0.00048509 | 1.25768340 | 1.10506107–7.54562785 |
| lost-ack-true | 5 | 128 | 58 | 6 | 41 | 8 | 0.00057205 | 1.34463799 | 1.17823072–7.84664223 |
| lost-ack-false | 5 | 128 | 58 | 6 | 41 | 8 | 0.00057205 | 1.34464080 | 1.17823329–7.84664590 |
| enqueue-failure | 5 | 138 | 60 | 6 | 45 | 8 | 0.00060525 | 1.37784177 | 1.20551404–8.12215722 |
| provider-lost-googledrive | 5 | 134 | 60 | 6 | 43 | 8 | 0.00058535 | 1.35793640 | 1.18853888–7.96526654 |
| provider-lost-dropbox | 5 | 134 | 60 | 6 | 43 | 8 | 0.00056445 | 1.33703795 | 1.17784169–7.88859244 |
| provider-lost-osf | 5 | 134 | 60 | 6 | 43 | 8 | 0.00057127 | 1.34385550 | 1.18459101–7.91580584 |

## Sin participantes

| Ventana | USD fijo nominal |
|---|---:|
| 60 segundos | 0.00001788 |
| 86400 segundos | 0.02575292 |
| 2592000 segundos | 0.77258757 |

Las filas de escenarios incluyen las revisiones periódicas ejecutadas durante su ventana de prueba. Al presupuestar, se resta su trabajo vacío y se añade el costo fijo una sola vez por periodo. Los CSV se verifican en orden, completos y sin IDs duplicados; también se entregan las tareas obsoletas pendientes.

## Condiciones del cálculo

```json
{
  "source": "Explicit pre-deployment workload hypotheses, not measured cloud durations or an invoice. Change these inputs to cost another workload.",
  "low": {
    "baseMs": 5,
    "firestoreReadMs": 5,
    "firestoreCommitMs": 10,
    "realtimeMs": 5,
    "providerMs": 100,
    "coldFraction": 0.01,
    "startupMs": 200,
    "networkFactor": 1.05,
    "protocolBytes": 256,
    "logBytesPerInvocation": 512,
    "rtdbStoredFactor": 1.1
  },
  "nominal": {
    "baseMs": 20,
    "firestoreReadMs": 20,
    "firestoreCommitMs": 35,
    "realtimeMs": 30,
    "providerMs": 300,
    "coldFraction": 0.1,
    "startupMs": 500,
    "networkFactor": 1.15,
    "protocolBytes": 512,
    "logBytesPerInvocation": 1024,
    "rtdbStoredFactor": 1.3
  },
  "high": {
    "baseMs": 50,
    "firestoreReadMs": 60,
    "firestoreCommitMs": 100,
    "realtimeMs": 100,
    "providerMs": 1000,
    "coldFraction": 1,
    "startupMs": 2000,
    "networkFactor": 1.5,
    "protocolBytes": 1024,
    "logBytesPerInvocation": 4096,
    "rtdbStoredFactor": 2
  },
  "placement": {
    "firestore": "nam5",
    "functions": "us-central1",
    "realtime": "us-central1 (assumed)",
    "providersAndClients": "North America",
    "pubsub": "us-central1, no cross-region subscriptions/backlog over one day"
  },
  "compute": "gcfv2 request-based billing, 100ms increments, serial requests in separate instances; assigned CPU/RAM from endpoint/defaults; cold/startup allocation added separately, minInstances=0. This does not assert the deployed concurrency or actual cold rate.",
  "retention": "Sessions projected at the start of a 30-day window; retained documents and RTDB nodes stay until window end. No TTL is invented. Temporary Firestore inventory uses observed emulator residency including virtual waits. Config/log documents allocated once per experiment/window.",
  "network": "Provider and public HTTP content observed; TLS/protocol uplift assumed. RTDB 512 response bytes per SDK exchange plus 3500 TLS bytes per connection, including a backend connection per invocation with RTDB operations. Event payloads add 1024 envelope bytes, one publication and each delivery; model one message/request, minimum 1KiB. Eventarc Google-source rate zero, Pub/Sub charged separately.",
  "logs": "Cloud Logging bytes assumed per invocation, with 30-day retention. Firestore logs/{experimentID} writes/storage are measured separately.",
  "exclusions": [
    "Existing provider subscription/storage plan (Drive, Dropbox or OSF); bytes/files and API calls reported, no zero-priced unlimited storage assumed",
    "Publication/build/deployment/artifact storage and SDK/browser downloads: preparation outside runtime workload",
    "Actual billing account quotas, tax, discounts, currency conversion and unrelated project workloads",
    "Browser device CPU/storage and benchmark infrastructure: not Cloud Functions resources"
  ]
}
```

Los contadores por función, inventario por colección, tamaños con índices, tareas pendientes y sobrecarga del benchmark están en reference.json. Las partidas, unidades, entradas y fuentes de tarifas están en budget.json. El rango cambia hipótesis declaradas; no es un intervalo estadístico ni una factura.
