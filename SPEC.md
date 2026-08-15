# Especificación universal para implementación de software con IA

## 1. Principio rector: comprensión antes que implementación

La prioridad máxima no es escribir código rápido: es entender exactamente qué quiere el usuario antes de modificar, crear o proponer una implementación.

El agente no debe asumir, completar huecos, inventar requisitos ni elegir decisiones de producto o tecnología por el usuario.

Si una instrucción, requisito, flujo, alcance, tecnología, restricción o criterio de aceptación es ambiguo, incompleto, contradictorio o técnicamente inviable, el agente debe detenerse y hacer preguntas precisas. Debe repetir este ciclo tantas veces como sea necesario hasta eliminar la necesidad de inferir.

No se implementa nada mientras exista incertidumbre relevante.

Una respuesta del tipo “entendí” no basta. Antes de avanzar, el agente debe poder expresar con precisión:

- Qué se construirá.
- Qué no se construirá.
- Para quién se construirá.
- Qué comportamiento debe tener.
- Qué tecnologías están autorizadas.
- Qué restricciones existen.
- Qué criterios determinan que la implementación está terminada.
- Qué dependencias, cuentas, infraestructura, permisos o servicios externos son necesarios.

El agente no sustituye la intención del usuario. Su función es hacer visible lo que el usuario podría no saber todavía y ayudarle a decidir.

---

## 2. Protocolo obligatorio de aclaración

Antes de planear o implementar, el agente debe revisar la solicitud buscando:

- Ambigüedades funcionales.
- Requisitos faltantes.
- Conflictos entre requisitos.
- Restricciones incompatibles con las tecnologías elegidas.
- Dependencias externas no consideradas.
- Costos, cuentas, permisos o publicación necesarios.
- Riesgos de seguridad, rendimiento, escalabilidad, legalidad, privacidad o mantenimiento.
- Conceptos que el usuario menciona pero que no existen, no son compatibles o no aplican técnicamente.

Cuando exista algún punto incierto, debe responder con este formato:

1. **Lo que se entendió**
2. **Lo que falta por definir**
3. **Por qué esa decisión afecta la implementación**
4. **Opciones reales disponibles y sus consecuencias**
5. **Pregunta concreta que el usuario debe responder**

No debe rellenar silenciosamente los huecos con “buenas prácticas”, preferencias propias o supuestos comunes.

### Regla de antítesis técnica

El agente debe cuestionar peticiones cuando sea necesario.

Ejemplo: si el usuario pide “haz una app móvil y publícala”, no debe pasar directamente a generar React Native o Flutter. Primero debe explicar que la petición implica decisiones como:

- Plataforma: iOS, Android o ambas.
- Tecnología: React Native, Flutter, Swift, Kotlin u otra.
- Tipo de aplicación: nativa, híbrida, web móvil o PWA.
- Cuenta de Apple Developer.
- Cuenta de Google Play Console.
- Firma de aplicaciones, certificados, pruebas, privacidad, políticas de tienda y publicación.
- Backend, autenticación, base de datos, notificaciones, analítica o pagos, si aplican.

Después debe pedir las decisiones faltantes.

El agente puede recomendar una opción, pero nunca elegirla sin autorización explícita del usuario.

---

## 3. Flujo obligatorio de trabajo

### Fase 1: requisitos

El usuario define antes de implementar:

- Objetivo del sistema.
- Alcance.
- Funcionalidades.
- Tecnologías autorizadas.
- Restricciones.
- Criterios de aceptación.
- Plataformas objetivo.
- Integraciones externas.
- Requisitos de seguridad, rendimiento o despliegue, cuando existan.

El agente debe validar que esos requisitos sean suficientes y consistentes.

### Fase 2: planificación iterativa

Cuando los requisitos estén claros, el agente debe entregar un plan antes de escribir código.

El plan debe incluir:

1. Resumen verificable de requisitos.
2. Alcance y fuera de alcance.
3. Arquitectura propuesta.
4. Módulos de negocio.
5. Contratos entre módulos.
6. Datos, entidades y flujos principales.
7. Estrategia de pruebas.
8. Archivos que se crearán o modificarán.
9. Orden de implementación.
10. Riesgos técnicos y decisiones pendientes.
11. Criterios de aceptación verificables.

El usuario debe poder corregir el plan antes de que inicie la implementación.

Si durante el desarrollo aparece un requisito nuevo, conflicto técnico o cambio de alcance, el agente debe detenerse, explicar el impacto y actualizar el plan antes de continuar.

### Fase 3: implementación

La implementación solo inicia cuando:

- Los requisitos están claros.
- Las tecnologías están definidas.
- No existen contradicciones pendientes.
- El plan fue validado por el usuario.
- Los criterios de aceptación son comprobables.

No se debe implementar “una aproximación” cuando la solicitud todavía admite interpretaciones distintas.

---

## 4. Desarrollo guiado por pruebas

Toda implementación debe seguir TDD.

Ciclo obligatorio:

1. Definir el comportamiento esperado.
2. Crear la prueba que falla.
3. Implementar únicamente lo necesario para que pase.
4. Refactorizar sin romper las pruebas.
5. Repetir por cada comportamiento relevante.

Las pruebas deben reflejar requisitos de negocio, no detalles accidentales de implementación.

La herramienta de pruebas depende de la tecnología elegida por el usuario.

Ejemplos:

- Java: JUnit.
- TypeScript/React: Vitest, Jest, React Testing Library u otra herramienta autorizada.
- Backend Node: Vitest, Jest, Supertest u otra herramienta autorizada.
- Aplicaciones móviles: la herramienta correspondiente al framework elegido.

No se debe declarar una funcionalidad terminada si:

- Sus pruebas no existen.
- Sus pruebas no pasan.
- No cumple los criterios de aceptación.
- Rompe pruebas existentes.
- Introduce errores de tipos, lint o compilación.
- Deja comportamiento relevante sin verificar.

---

## 5. Arquitectura: modular por dominio, no por capa técnica global

La estructura del proyecto debe organizarse primero por módulos de negocio o dominios funcionales.

No usar una estructura global basada únicamente en categorías técnicas como:

```text
/services
/utils
/components
/hooks
/types
/controllers
```

cuando esas carpetas mezclan conceptos de distintos dominios.

La estructura debe partir de conceptos reales del sistema:

```text
src/
  modules/
    users/
    payments/
    products/
    orders/
    authentication/
  shared/
  app/
```

Dentro de cada módulo sí se permite organizar por responsabilidad técnica cuando sea necesario:

```text
src/
  modules/
    users/
      domain/
      application/
      infrastructure/
      ui/
      services/
      utilities/
      types/
      tests/
```

Ejemplo:

```text
src/
  modules/
    payments/
      domain/
        payment.ts
        payment-status.ts
      application/
        create-payment.ts
        refund-payment.ts
      infrastructure/
        payment-repository.ts
        stripe-payment-gateway.ts
      ui/
        payment-form.tsx
        payment-history.tsx
      tests/
        create-payment.test.ts
```

Reglas:

- Cada módulo debe concentrar su lógica, pruebas, tipos, utilidades, servicios y componentes relacionados.
- Un módulo no debe acceder internamente a otro módulo de forma arbitraria.
- La comunicación entre módulos debe ocurrir mediante contratos, APIs públicas o casos de uso definidos.
- `shared/` solo debe contener elementos realmente transversales y reutilizables. No debe convertirse en un basurero de utilidades.
- La arquitectura debe funcionar tanto en monolitos como en microservicios, monorepos, aplicaciones web, APIs, móviles o escritorio.

---

## 6. Tamaño y cohesión de archivos

Ningún archivo debe superar 300 líneas.

Sin embargo, llegar a 300 líneas ya indica que probablemente existe una mala separación de responsabilidades. Los archivos deben dividirse antes cuando pierdan cohesión.

Un archivo debe representar una responsabilidad clara.

Separar por concepto y por comportamiento del dominio, no simplemente porque el archivo “creció”.

No crear divisiones artificiales o carpetas innecesarias. La modularidad debe mejorar comprensión, pruebas, mantenimiento y evolución del sistema.

---

## 7. TypeScript y React

### Regla para `type` e `interface`

En TypeScript, usar `type` por defecto.

Usar `interface` únicamente cuando representa un contrato propio de programación orientada a objetos que será implementado por clases o utilizado como una abstracción de ese tipo.

Ejemplo válido:

```ts
interface PaymentGateway {
  charge(input: ChargePaymentInput): Promise<PaymentResult>
}

class StripePaymentGateway implements PaymentGateway {
  async charge(input: ChargePaymentInput): Promise<PaymentResult> {
    // implementación
  }
}
```

Usar `type` para:

- DTOs.
- Props de componentes.
- Respuestas de API.
- Entidades sin comportamiento orientado a objetos.
- Uniones.
- Intersecciones.
- Tipos discriminados.
- Estados.
- Eventos.
- Parámetros.
- Resultados.
- Objetos de configuración.

Ejemplo:

```ts
type User = {
  id: string
  name: string
  email: string
}

type UserProfileProps = {
  user: User
  onEdit: (userId: string) => void
}
```

No mezclar `type` e `interface` sin una razón arquitectónica explícita.

No usar `interface` únicamente porque representa “la forma de un objeto”.

### Reglas adicionales de TypeScript

- Evitar `any`.
- Usar `unknown` cuando el tipo sea realmente desconocido y validarlo antes de usarlo.
- Mantener `strict` activado.
- No ocultar errores de tipo con conversiones forzadas injustificadas.
- Modelar estados inválidos para que sean imposibles o difíciles de representar.
- Preferir tipos discriminados para flujos con estados distintos.

### Reglas para React

- Los componentes deben enfocarse en UI y composición.
- La lógica de negocio no debe vivir dentro de componentes visuales si puede pertenecer a un caso de uso, servicio o módulo.
- Los hooks deben pertenecer al módulo al que sirven, salvo que sean verdaderamente transversales.
- Los componentes reutilizables globales deben ir en `shared/ui/` solo cuando no dependan de un dominio específico.
- No crear componentes “genéricos” prematuramente sin una necesidad real de reutilización.
- Los formularios, validaciones, estados y llamadas de red deben respetar los límites del módulo correspondiente.

---

## 8. Calidad de implementación

Toda implementación debe:

- Compilar.
- Pasar pruebas.
- Pasar validación de tipos.
- Pasar linting, si está configurado.
- Mantener consistencia con la arquitectura.
- Tener nombres comprensibles.
- Evitar duplicación innecesaria.
- Evitar código muerto.
- Evitar dependencias no autorizadas.
- Evitar endpoints, APIs, datos o integraciones ficticias sin avisar.
- Documentar decisiones no obvias.
- Mantener el alcance acordado.

No agregar funcionalidades no solicitadas.

No “mejorar” el producto cambiando requisitos sin aprobación del usuario.

No introducir abstracciones, patrones, librerías o capas arquitectónicas solo por moda. Toda complejidad debe justificar el problema que resuelve.

---

## 9. Manejo de conflictos e imposibilidades

Si el usuario solicita algo incompatible con la tecnología, plataforma, presupuesto, seguridad, tiempo, arquitectura o reglas externas, el agente debe explicarlo claramente.

Debe indicar:

1. Qué parte no es posible o entra en conflicto.
2. Por qué.
3. Qué alternativas reales existen.
4. Qué se perdería o ganaría con cada alternativa.
5. Qué decisión debe tomar el usuario.

No debe fingir que una limitación no existe.

No debe entregar una solución incompleta como si cumpliera todo el requisito.

No debe sustituir una funcionalidad requerida por una simulación sin avisarlo explícitamente.

---

## 10. Cierre de cada implementación

Al finalizar, el agente debe entregar:

1. Qué se implementó.
2. Qué requisitos fueron cubiertos.
3. Qué pruebas se agregaron.
4. Qué pruebas se ejecutaron y su resultado.
5. Qué archivos se modificaron.
6. Qué decisiones arquitectónicas se tomaron.
7. Qué limitaciones, deudas técnicas o pendientes permanecen.
8. Qué pasos externos faltan, si existen: credenciales, cuentas, variables de entorno, migraciones, despliegue, publicación o configuración.

La implementación solo se considera terminada cuando puede verificarse contra los criterios de aceptación definidos por el usuario.