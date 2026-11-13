# Referencia de persistencia pública

Revisión base: f97870ca0a73bc4a7633fed512215092e3cb2f1a. Fecha: 2026-11-13T21:51:36.034Z.

Consumo actual medido en emuladores y presupuesto calculado antes de desplegar. Esta referencia no aprueba su consumo como objetivo.

Alcance monetario: recursos de Google Cloud del runtime. Moneda USD, bruto antes de cuotas, descuentos e impuestos. Un experimento, sesiones al inicio del horizonte de 30 días. Plan/espacio del proveedor, publicación, construcción y despliegue fuera de este alcance.

| Escenario | Eventos CSV | Lecturas | Escrituras | Borrados | Functions | Docs retenidos de sesión | USD variable/sesión | USD 1.000 sesiones + fijo | Rango 1.000 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| normal-true-0 | 5 | 115 | 44 | 6 | 29 | 8 | 0.00044134 | 1.21392880 | 1.07828886–7.09034071 |
| normal-true-1 | 5 | 123 | 56 | 6 | 37 | 8 | 0.00053331 | 1.30589400 | 1.14813022–7.59923607 |
| normal-true-3 | 5 | 117 | 47 | 6 | 31 | 8 | 0.00046434 | 1.23692633 | 1.09575488–7.20279767 |
| normal-false-0 | 5 | 123 | 56 | 6 | 37 | 8 | 0.00053331 | 1.30589708 | 1.14813303–7.59924008 |
| normal-false-1 | 5 | 123 | 56 | 6 | 37 | 8 | 0.00053331 | 1.30589721 | 1.14813315–7.59924025 |
| normal-false-3 | 5 | 123 | 56 | 6 | 37 | 8 | 0.00053331 | 1.30589696 | 1.14813291–7.59923992 |
| volume-3 | 3 | 99 | 38 | 4 | 29 | 6 | 0.00041632 | 1.18890803 | 1.05580832–7.06526658 |
| volume-30 | 30 | 319 | 125 | 31 | 33 | 33 | 0.00079985 | 1.57243773 | 1.39806765–7.69603471 |
| volume-300 | 300 | 2533 | 1016 | 301 | 87 | 303 | 0.00481472 | 5.58731158 | 4.99918428–15.11259286 |
| visual-true | 3 | 103 | 44 | 4 | 33 | 6 | 0.00046530 | 1.23788518 | 1.09606648–7.31573985 |
| visual-false | 3 | 103 | 44 | 4 | 33 | 6 | 0.00046530 | 1.23788677 | 1.09606793–7.31574192 |
| resume-true | 5 | 161 | 69 | 6 | 55 | 8 | 0.00070924 | 1.48183028 | 1.28727833–8.57574761 |
| resume-false | 5 | 158 | 67 | 6 | 54 | 8 | 0.00069124 | 1.46382755 | 1.27453556–8.49938190 |
| expiry-true-0 | 2 | 100 | 38 | 3 | 36 | 6 | 0.00042455 | 1.19713572 | 1.07517178–7.34401810 |
| expiry-true-3 | 2 | 100 | 38 | 3 | 36 | 6 | 0.00042455 | 1.19713572 | 1.07517178–7.34401810 |
| expiry-false-1 | 2 | 107 | 39 | 3 | 37 | 5 | 0.00046001 | 1.23259873 | 1.08800485–7.41614526 |
| lost-ack-true | 5 | 126 | 58 | 6 | 38 | 8 | 0.00055150 | 1.32409309 | 1.16106522–7.67581256 |
| lost-ack-false | 5 | 126 | 58 | 6 | 38 | 8 | 0.00055151 | 1.32409540 | 1.16106733–7.67581558 |
| enqueue-failure | 5 | 126 | 57 | 6 | 39 | 8 | 0.00054382 | 1.31641376 | 1.15564923–7.74334423 |
| provider-lost-googledrive | 5 | 132 | 60 | 6 | 41 | 8 | 0.00057112 | 1.34370759 | 1.17496010–7.84907052 |
| provider-lost-dropbox | 5 | 132 | 60 | 6 | 41 | 8 | 0.00055029 | 1.32287492 | 1.16432746–7.77246650 |
| provider-lost-osf | 5 | 132 | 60 | 6 | 41 | 8 | 0.00055681 | 1.32939578 | 1.17078182–7.79937721 |

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
