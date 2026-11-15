# Referencia anterior a los ajustes sin republicar

Producto: `b392e886457bb30c3738e54319c6dac0b6ce9f78`, después de las optimizaciones de persistencia y antes de implementar los ajustes sin republicar. Esta es la referencia predeterminada del check local y de GitHub; usa `benchmarks/policies/no-increases.json`, sin tolerancias adicionales.

Se midió el producto anterior en un checkout aislado, sin modificar `api/functions`, `client/src`, `client/runtime-e2e`, `server` ni `shared`. Ambas versiones recibieron la misma prueba: generación mediante `PublicConfiguration`, entradas de autoría declaradas, 23 escenarios, calendario, navegador, SDK, bundles, índices y tarifas. Cada versión conserva su implementación real de generación, publicación, sesiones y exportación.

Se ejecutaron tres matrices anteriores y tres actuales. Las seis comparaciones entre repeticiones obtuvieron igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales. Las tres comparaciones anterior/actual pasaron con cero incidencias bajo la política estricta. Las operaciones y el costo variable permanecen iguales; disminuye ligeramente el almacenamiento compartido de configuración.

[repeatability-validation.json](repeatability-validation.json) conserva las identidades de las seis capturas y sus comparaciones. [reference-record.json](reference-record.json) identifica el registro explícito de la primera captura anterior; `reference.json` conserva sus bytes originales y `budget.json` su cálculo. El [informe de integración](../../../docs/investigaciones/public-settings-cost-comparison-2026-11-14.md) detalla el resultado.

B0 R3, la política de almacenamiento temporal y los informes de ahorro anteriores permanecen intactos. No son comparables directamente con el fixture nuevo; se conservan para reproducir sus mediciones originales. Esta referencia no convierte la candidata actual en su propia base ni aprueba su consumo como objetivo. Las mediciones se ejecutaron con emuladores y proveedores locales.
