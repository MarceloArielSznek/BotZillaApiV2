# 💰 Estimate Pricing Formula - Follow-Up Module

## 🎯 Objetivo

Desglosar el **Retail Price** de un estimate para mostrar claramente cómo se construye el precio, separando costos Non-Sub y Sub Services.

---

## 📊 Valores Guardados en BD

Cada estimate tiene los siguientes campos relevantes:

| Campo | Descripción | Ejemplo |
|-------|-------------|---------|
| `true_cost` | Costo total real (material + labor + gas) | $5,217.50 |
| `retail_cost` | Precio retail (antes de descuento) | $12,973.04 |
| `final_price` | Precio final (después de descuento) | $12,973.04 |
| `sub_service_retail_cost` | Costo retail de sub services (ya con multiplier) | $2,012.50 |
| `calculated_multiplier` | Multiplier aplicado al Non-Sub cost | 2.5 |
| `sub_multiplier` | Multiplier aplicado a sub services | 1.75 |
| `payment_method_factor` | Factor del método de pago | 1.065 |
| `discount` | Descuento aplicado (%) | 0 |

---

## 🧮 Fórmulas

### 1️⃣ Para Estimates **SIN** Sub Services

```javascript
// Mostrar directamente
True Cost = true_cost                                    // $2,088.24
Retail Price = true_cost × multiplier × payment_factor  // $2,088.24 × 2.5 × 1.065
```

---

### 2️⃣ Para Estimates **CON** Sub Services (`sub_service_retail_cost > 0`)

#### A. Separar True Cost en Non-Sub y Sub

```javascript
// 1. Calcular Sub Material Base (sin multiplier)
const subFactor = sub_multiplier || 1.75;
const subMaterialBase = sub_service_retail_cost / subFactor;
// Ejemplo: $2,012.50 / 1.75 = $1,150.00

// 2. Calcular True Cost (solo Non-Sub)
const trueCostNonSub = true_cost - subMaterialBase;
// Ejemplo: $5,217.50 - $1,150.00 = $4,067.50
```

#### B. Calcular Retail Price

```javascript
// 3. Non-Sub Retail (aplicar multiplier)
const nonSubRetail = trueCostNonSub × multiplier;
// Ejemplo: $4,067.50 × 2.5 = $10,168.75

// 4. Retail Price (sumar sub services retail)
const retailBeforePM = nonSubRetail + sub_service_retail_cost;
// Ejemplo: $10,168.75 + $2,012.50 = $12,181.25

// 5. Aplicar Payment Method Factor
const retailPrice = retailBeforePM × payment_method_factor;
// Ejemplo: $12,181.25 × 1.065 = $12,973.04 ✅
```

---

## 🎨 Presentación en UI (Follow-Up Module)

### Columna "Costs"

**Para estimates SIN sub services:**
```
True Cost: $2,088.24
Payment: Cash
```

**Para estimates CON sub services:**
```
True Cost (Non-Sub): $4,067.50  (verde)
Sub Price: $1,150.00             (azul)
Total: $5,217.50                 (gris)
Payment: Cash
```

### Columna "Details"

```
Multiplier: 2.5x         (verde)
Sub Multi: 1.75x         (azul, solo si hay subs)
PM Factor: 1.065x        (azul)
```

### Columna "Prices"

```
Retail Price: $12,973.04
After Discount: $12,973.04  (si hay descuento)
+ Taxes: $XXX              (si es WA)
Final w/ Taxes: $XXX       (si es WA)
```

---

## ✅ Verificación con Ejemplo Real

### Estimate: "Nicole Avinger - BP"

#### Valores Guardados:
- `true_cost`: $5,217.50
- `sub_service_retail_cost`: $2,012.50
- `sub_multiplier`: 1.75
- `calculated_multiplier`: 2.5
- `payment_method_factor`: 1.065

#### Cálculo:

```javascript
// 1. Sub Material Base
subMaterialBase = 2012.50 / 1.75 = $1,150.00 ✅

// 2. True Cost (Non-Sub)
trueCostNonSub = 5217.50 - 1150.00 = $4,067.50 ✅

// 3. Non-Sub Retail
nonSubRetail = 4067.50 × 2.5 = $10,168.75 ✅

// 4. Retail Before PM
retailBeforePM = 10168.75 + 2012.50 = $12,181.25 ✅

// 5. Retail Price
retailPrice = 12181.25 × 1.065 = $12,973.04 ✅
```

**¡Todos los valores coinciden con el frontend de Attic Tech!**

---

## 🔑 Conceptos Clave

### ¿Qué es un Sub Service?

Un **sub service** es un trabajo subcontratado (electricista, plomero, asbestos removal, etc.) que:
- Solo tiene **material cost** (no labor propio de AT)
- Usa un **sub multiplier** específico (generalmente 1.75x)
- Se suma al retail después de aplicar su propio multiplier

### ¿Por qué separar True Cost?

El `true_cost` guardado incluye TODO:
- Material + Labor de items normales
- Material base de sub services

Para calcular el retail correctamente:
1. Separar el sub material base del true cost
2. Aplicar el multiplier general solo al non-sub cost
3. Sumar el sub services retail (que ya tiene su multiplier aplicado)

### ¿Cómo se calcula el Sub Material Base?

El `sub_service_retail_cost` ya tiene el sub multiplier aplicado, entonces:

```javascript
sub_material_base = sub_service_retail_cost / sub_multiplier
```

Esto nos da el costo base del sub (lo que AT paga al subcontratista).

---

## 📝 Notas Importantes

1. **Payment Method Factor**:
   - Cash: 1.04
   - Credit Card: 1.065
   - Finance (3 meses): 1.5
   - Finance (6 meses): 1.25
   - Finance (12 meses): 1.15

2. **Sub Multiplier Default**: Si no está especificado, usar 1.75

3. **Taxes (solo WA)**: Se calculan sobre el `final_price` y se agregan al final

4. **Discount**: Se aplica al `retail_price` para obtener `final_price`

---

## 🔧 Implementación

### Frontend: `FollowUpEstimates.tsx`

```typescript
// Calcular costos separados
const trueCost = Number(estimate.price);
const subRetailCost = Number(estimate.sub_service_retail_cost) || 0;
const subFactor = estimate.sub_multiplier || 1.75;
const hasSubServices = subRetailCost > 0;

const subMaterialBase = hasSubServices ? subRetailCost / subFactor : 0;
const trueCostNonSub = hasSubServices ? trueCost - subMaterialBase : trueCost;

// Mostrar en UI
if (hasSubServices) {
  // Mostrar: True Cost (Non-Sub), Sub Price, Total
} else {
  // Mostrar: True Cost
}
```

### Backend: Ya calculado por Attic Tech

Los valores `true_cost`, `retail_cost`, `sub_service_retail_cost`, etc. ya vienen calculados desde Attic Tech durante el sync de estimates.

---

**Fecha de creación**: Noviembre 17, 2025  
**Última actualización**: Noviembre 17, 2025  
**Versión**: 1.0

