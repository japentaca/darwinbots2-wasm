---
titulo: .poisoned
resumen: "Cuántos ciclos de envenenamiento le quedan al bot; 0 si no está envenenado."
etiquetas: [defensas, poison, sentidos]
estado: revisada
---
Te envenenás cuando atacás a un bot tóxico de otra especie: le disparaste un
`-1` o un disparo de memoria, o le quisiste chupar energía o cuerpo por un lazo,
y su [[.poison]] alcanzó para devolvértelo. El motor suma ciclos de
envenenamiento y los descuenta de a uno por ciclo; esta celda muestra cuántos
quedan.

<!-- sysvars.yaml .poisoned (Poisons P1 = Int(Poisoncount)); 33-SHOTS §5 (takepoison: Poisoncount += power/1.5); 34-TIES §2 (retaliación por poison en −1/−6) -->

Mientras sea mayor que 0, en cada ciclo el motor escribe el [[.pval]] del bot
tóxico en tu celda [[.ploc]] (las dos son del que te envenenó), después de que
corre tu ADN. Fuera de eso funcionás normal.

<!-- 21-MEMORIA §4.3, §6; 10-CICLO §2 P1 -->

El uso típico es dejar de atacar a quien te envenena: si lo mordés de nuevo, se
suman más ciclos.

```adn
' morder solo si no estoy envenenado
cond
*.eye5 0 >
*.poisoned 0 =
start
-1 .shoot store
stop
```

La versión del veneno es [[.paralyzed]].
