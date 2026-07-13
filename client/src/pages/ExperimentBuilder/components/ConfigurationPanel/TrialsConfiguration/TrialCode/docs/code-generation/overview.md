# Arquitectura de Generación de Código para Experimentos jsPsych

## Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Fundamentos jsPsych](#fundamentos-jspsych)
3. [Features Implementados](#features-implementados)
4. [Arquitectura del Sistema](#arquitectura-del-sistema)
5. [Flujo de Datos](#flujo-de-datos)
6. [Estrategias de Implementación](#estrategias-de-implementación)

---

## Visión General

Esta aplicación es un **builder visual** que genera código JavaScript compatible con **jsPsych** para crear experimentos psicológicos. El sistema convierte configuraciones visuales (trials, loops, condiciones) en código JavaScript ejecutable mediante **generación de templates** (template-based code generation).

### Desafío Principal

El desafío más grande es generar código **dinámicamente** que:

- Sea compatible con la API de jsPsych
- Soporte features complejos (branching, loops condicionales, parameter override)
- Mantenga el estado entre trials
- Permita anidamiento ilimitado de estructuras (nested loops)

### Solución: Generación Basada en Templates

Todo el código se genera como **strings de JavaScript** que luego se ejecutan en el navegador. Esto permite:

- **Flexibilidad total**: Podemos generar cualquier código válido de JavaScript
- **Compatibilidad**: El código generado usa la API estándar de jsPsych
- **Extensibilidad**: Fácil añadir nuevos features sin cambiar el core

---

## Fundamentos jsPsych

### Timeline: La Base de Todo

jsPsych organiza experimentos usando **timelines** (líneas de tiempo). Un timeline es un array de objetos que pueden ser:

1. **Trials individuales**: Un solo estímulo/tarea
2. **Procedures**: Timelines anidados con configuración adicional

```javascript
// Timeline simple
const timeline = [
  trial1,
  trial2,
  trial3
];

// Timeline con procedure (anidamiento)
const mainTimeline = [
  trial1,
  {
    timeline: [trialA, trialB, trialC],  // Timeline anidado
    timeline_variables: [...],            // Variables para repetir
    repetitions: 3                         // Repetir 3 veces
  },
  trial2
];
```

### Features Clave de jsPsych que Aprovechamos

#### 1. **Anidamiento Ilimitado** (`timeline`)

Podemos anidar timelines infinitamente:

```javascript
{
  timeline: [
    {
      timeline: [
        {
          timeline: [trial], // Nivel 3
        },
      ], // Nivel 2
    },
  ]; // Nivel 1
}
```

**Uso en Builder**: Implementación de **nested loops**

#### 2. **Timeline Variables** (`timeline_variables`)

Permite repetir un timeline con diferentes valores:

```javascript
{
  timeline: [trial],
  timeline_variables: [
    { stimulus: 'img1.jpg', correct_response: 'a' },
    { stimulus: 'img2.jpg', correct_response: 'b' }
  ]
}
```

**Uso en Builder**: Implementación de **loops básicos** y **repeticiones con data**

#### 3. **Conditional Function** (`conditional_function`)

Decide si ejecutar un trial/procedure:

```javascript
{
  timeline: [trial],
  conditional_function: function() {
    // Retorna true para ejecutar, false para saltar
    return someCondition;
  }
}
```

**Uso en Builder**: Implementación de **branching** y **jump/repeat**

#### 4. **Loop Function** (`loop_function`)

Decide si repetir un procedure:

```javascript
{
  timeline: [trial],
  loop_function: function(data) {
    // Retorna true para repetir, false para terminar
    return shouldRepeat;
  }
}
```

**Uso en Builder**: Implementación de **conditional loops (while loops)**

#### 5. **On Start / On Finish** (`on_start`, `on_finish`)

Callbacks que se ejecutan antes/después de un trial:

```javascript
{
  type: htmlKeyboardResponse,
  stimulus: 'Hello',
  on_start: function(trial) {
    // Modificar parámetros antes de mostrar
    trial.stimulus = 'Modified!';
  },
  on_finish: function(data) {
    // Procesar resultados después de completar
    console.log(data.response);
  }
}
```

**Uso en Builder**: Implementación de **params override** y **branching logic**

---
