---
titulo: .stifftie
resumen: "Orden para cambiar la rigidez de un lazo endurecido, de 1 (blando) a 100 (muy rígido)."
etiquetas: [lazos, tie, multicelular, física]
estado: revisada
---
Ajusta qué tan fuerte el lazo elegido con [[.tienum]] (o el de [[.tiepres]])
vuelve a su largo y cuánto amortigua las oscilaciones. Vale para los dos extremos
y queda hasta que la cambies; el motor borra la orden después de usarla.

La escala va de 1 a 100. El motor se queda con el resto de dividir por 100, un 0
pasa a ser 100 y un negativo pasa a ser 1. Así, 150 es 50 y 100 es el máximo.
Como referencia, un lazo recién endurecido equivale a 20, y uno blando, recién
hecho, a 4.

<!-- sysvars.yaml .stifftie (Mod 100 in place, 0 → 100, < 0 → 1; b/k de ambos lados); 34-TIES §1 (k = 0.01/b = 0.02 al crear, k = 0.05/b = 0.1 hueso); port/core ties.hpp (b = 0.005·v, k = 0.0025·v) -->

Solo actúa sobre lazos endurecidos de un bot multicelular ([[.multi]]). Si el bot
no tiene lazos, el valor queda escrito.

<!-- 21-MEMORIA §9.8 (reset tras el gate tienum/tiepres) -->

```adn
' lazos muy rígidos para un organismo compacto
cond
*.multi 1 =
start
100 .stifftie store
stop
```

El largo se ajusta con [[.fixlen]] y el ángulo con [[.fixang]].
