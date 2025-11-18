# 🎯 Effective Multiplier - Guía

## ¿Qué es el Effective Multiplier?

El **Effective Multiplier** (o "Real Multiplier") es el multiplicador **real** que se aplicó al estimate después de considerar el descuento dado al cliente.

Mientras que el **Theoretical Multiplier** (2.5x, 2.75x, etc.) es el multiplicador base según los rangos de precio, el **Effective Multiplier** muestra qué margen de ganancia se obtuvo realmente después del descuento.

---

## 🧮 Fórmula

### Trabajando hacia atrás desde Final Price:

```javascript
// 1. Remover Payment Method Factor
const beforePM = final_price / payment_method_factor;

// 2. Remover Sub Services Retail (si hay)
const nonSubRetailEffective = beforePM - sub_services_retail_cost;

// 3. Calcular True Cost Non-Sub
const subMaterialBase = sub_services_retail_cost / sub_multiplier;
const trueCostNonSub = true_cost - subMaterialBase;

// 4. Calcular Effective Multiplier
const effectiveMultiplier = nonSubRetailEffective / trueCostNonSub;
```

---

## 📊 Ejemplos

### Ejemplo 1: Sin Descuento

**Nicole Avinger - BP**

```
True Cost Non-Sub:      $4,067.50
Retail Price:           $12,973.04
Final Price:            $12,973.04 (0% discount)
Payment Method Factor:  1.065x

Cálculo:
1. Before PM: $12,973.04 / 1.065 = $12,181.25
2. Remove Subs: $12,181.25 - $2,012.50 = $10,168.75
3. Effective Multiplier: $10,168.75 / $4,067.50 = 2.5x

✅ Theoretical: 2.5x
✅ Effective: 2.5x
```

**Conclusión**: Sin descuento, ambos multipliers son iguales.

---

### Ejemplo 2: Con Descuento 20%

**Estimate hipotético con descuento**

```
True Cost Non-Sub:      $4,067.50
Retail Price:           $12,973.04
Discount:               20%
Final Price:            $10,378.43
Payment Method Factor:  1.065x

Cálculo:
1. Before PM: $10,378.43 / 1.065 = $9,745.00
2. Remove Subs: $9,745.00 - $2,012.50 = $7,732.50
3. Effective Multiplier: $7,732.50 / $4,067.50 = 1.90x

⚠️  Theoretical: 2.5x
⚠️  Effective: 1.90x
```

**Conclusión**: Con 20% de descuento, el multiplier efectivo bajó de 2.5x a 1.90x.

---

### Ejemplo 3: Estimate sin Sub Services

**Estimate sin subs, con descuento 15%**

```
True Cost:              $2,088.24
Retail Price:           $5,429.42
Discount:               15%
Final Price:            $4,615.01
Payment Method Factor:  1.065x

Cálculo:
1. Before PM: $4,615.01 / 1.065 = $4,333.34
2. No subs: $4,333.34 - $0 = $4,333.34
3. Effective Multiplier: $4,333.34 / $2,088.24 = 2.07x

⚠️  Theoretical: 2.5x
⚠️  Effective: 2.07x
```

**Conclusión**: Con 15% de descuento, el multiplier efectivo bajó de 2.5x a 2.07x.

---

## 🎨 Presentación en UI

### En la Tabla (Columna "Details")

```
Multiplier: 2.5x      ← Verde (teórico)
Effective: 1.90x      ← Naranja (real con descuento)
Sub Multi: 1.75x      ← Azul
PM Factor: 1.065x     ← Azul
```

**Nota**: El "Effective" solo se muestra si hay una diferencia significativa (>0.05) con el multiplier teórico.

### En el Modal de Detalles

```
Pricing Breakdown
─────────────────────────────────────────

Multiplier (Theoretical):    [2.5x]  ✅
Multiplier (Effective):      [1.90x] ⚠️  (after discount)
Sub Multiplier:              [1.75x] 🔵
Payment Method Factor:       [1.065x] 🔵
```

---

## 💡 ¿Para qué sirve?

### 1. **Follow-Up Strategies**

Ver el multiplier efectivo te dice **cuánto margen real** queda en el estimate:

- **Effective > 2.0x**: Buen margen, hay espacio para negociar
- **Effective 1.5x - 2.0x**: Margen medio, descuento moderado
- **Effective < 1.5x**: Margen bajo, poco espacio para más descuentos

### 2. **Análisis de Descuentos**

Compara ambos multipliers para entender cuánto impactó el descuento:

```javascript
const discountImpact = theoreticalMultiplier - effectiveMultiplier;

// Ejemplo: 2.5x - 1.90x = 0.6x de impacto
```

### 3. **Pricing Intelligence**

Para re-engagement, puedes:
- Ofrecer un descuento adicional si el effective multiplier es alto
- Mantener el precio si el effective multiplier ya es bajo
- Ajustar la estrategia según el margen real disponible

---

## 📐 Casos Especiales

### Caso 1: Sin Descuento

Si `final_price === retail_cost`, entonces:
- Effective Multiplier = Theoretical Multiplier
- **No se muestra** en la tabla (para reducir ruido)

### Caso 2: Descuento Mínimo (<5%)

Si la diferencia entre theoretical y effective es < 0.05:
- **No se muestra** en la tabla
- Se considera "insignificante"

### Caso 3: Estimate con Sub Services

El cálculo **excluye** correctamente los sub services:
- Solo calcula el multiplier sobre el Non-Sub cost
- Los subs mantienen su propio multiplier (1.75x)

---

## 🔍 Validación

### Verificar el Cálculo Manualmente:

```javascript
// Desde el frontend de AT o calculadora
const retail = trueCostNonSub * theoreticalMultiplier + subServicesRetail;
const beforePM = retail * paymentMethodFactor;
const finalPrice = beforePM * (1 - discount / 100);

// Ahora trabajar hacia atrás
const beforePM2 = finalPrice / paymentMethodFactor;
const nonSubRetail = beforePM2 - subServicesRetail;
const effective = nonSubRetail / trueCostNonSub;

console.log('Effective Multiplier:', effective.toFixed(2) + 'x');
```

---

## 🛠️ Implementación Técnica

### Frontend - Tabla

**Archivo**: `frontend/src/pages/FollowUpEstimates.tsx`

```typescript
// Calcular en línea dentro de la columna Details
const effectiveMultiplier = (finalPrice / pmFactor - subs) / trueCostNonSub;

// Solo mostrar si difference > 0.05
if (Math.abs(effectiveMultiplier - theoreticalMultiplier) > 0.05) {
  // Mostrar con color warning
}
```

### Frontend - Modal

**Archivo**: `frontend/src/components/estimates/EstimateDetailsModal.tsx`

```typescript
// Siempre mostrar en el modal (más espacio, más detalles)
<InfoRow 
  label="Multiplier (Effective)" 
  value={<Chip label={`${effectiveMultiplier.toFixed(2)}x`} color="warning" />} 
/>
```

---

## ⚠️ Limitaciones

1. **No considera impuestos**: El cálculo asume que taxes se agregan después
2. **Asume PM Factor correcto**: Si el factor guardado es incorrecto, el cálculo falla
3. **Redondeos**: Puede haber diferencias de centavos por redondeos

---

## 📝 Changelog

| Fecha | Versión | Cambios |
|-------|---------|---------|
| 2025-11-17 | 1.0 | Implementación inicial del Effective Multiplier |

---

**Última actualización**: Noviembre 17, 2025  
**Versión**: 1.0

