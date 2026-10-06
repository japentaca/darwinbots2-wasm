---
titulo: .sexrepro
resumen: "Orders a sexual reproduction: it only works if the bot has been fertilized, and the child mixes its DNA with the sperm's."
etiquetas: [reproduction, sexual, sperm, action]
estado: revisada
---
<!-- 36-REPRO §0.2, §3.1 (esperma = shot −8; fecundación de 10 ciclos) -->
Sexual reproduction has two roles. The one acting as the father doesn't have children: it
shoots sperm at another bot with `-8 .shoot store` (see [[.shoot]]). The one that receives it
is fertilized for about ten cycles ([[.fertilized]] tells it so), and if within that window
it writes a percentage to `.sexrepro`, it has a child whose DNA mixes its own with
the sperm's.

```adn
' It turns until it sees something and shoots it with sperm
cond
 *.eye5 0 =
start
 25 .aimdx store
stop
cond
 *.eye5 0 >
start
 -8 .shoot store
stop
' If it gets fertilized, it has a child with half of what it has
cond
 *.fertilized 0 >
start
 50 .sexrepro store
stop
```

<!-- comprobado: dos de estos bots en un campo de 1000×1000 tienen un hijo antes del ciclo 50 en 5 de 6 semillas -->
With two of these bots in a small field, it is normal for a child to be born within a few
dozen cycles. The child appears in front of the mother, in the direction she is pointing: if there
is another bot or a wall there, the birth waits. The percentage works as in
[[.repro]]: modulo 100, and the order stays written until the birth succeeds.

<!-- 36-REPRO §0.2, §0.3, §3.1, §3.4, §5.3; port/README A1-5 -->
What changes compared with the asexual one:

- **The mother supplies everything.** The child's energy, body and chloroplasts come from the bot
  that writes `.sexrepro`. The one that shot the sperm only paid for the shot, and
  doesn't count as a parent.
- **One sperm, one child.** After the birth the fertilization ends and
  `.fertilized` goes back to 0.
- **Relatives, not strangers.** If the sperm's DNA is too different (more than
  60% differences), there is no child, that sperm is no longer any use, and for about eight
  cycles the bot doesn't accept new sperm. To try again it needs another one
  to reach it.
- **The mix isn't fixed.** Two births with the same sperm give different children, and
  the child can come out shorter than both parents.
- **It goes before the asexual one.** As long as the bot is fertilized and has `.sexrepro`
  written, it only tries the sexual one; [[.repro]] waits even if the sexual one fails.

How the child's DNA is put together is in [[simulacion/reproduccion]].
