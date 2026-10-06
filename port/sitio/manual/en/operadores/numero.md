---
titulo: <numero>
resumen: "A number written in the DNA, or the name of a sysvar without an asterisk, is pushed as is onto the integer stack."
etiquetas: [numbers, literal, address, range]
estado: revisada
---
<!-- 20-VM §1 (tipo 0), §2.4 (SysvarTok, val, error 6, bancario), §0.4 -->

A bare number in the DNA does nothing except get pushed. It's how you give
the operators their data: in `10 3 sub`, the 10 and the 3 are numbers and
[[op:sub]] uses them.

Besides digits, these also count as a number:

- **The name of a sysvar without an asterisk.** `.up` is exactly the same as
  `1`: it pushes the address of [[.up]], not its contents. That's why it's
  used to say _where_ a [[op:store]] writes.
- **A variable from [[adn/def]].** `def presa 50` makes `.presa` be 50.
- **Any word that isn't recognized.** It's not an error: it counts as 0 (see
  [[adn/errores#nombre]]).

Rules for the literal:

- It has to be between **−32768 and 32767**. Outside that range, the whole bot
  fails to load. A bigger number is built with operators: `200 200 mult`.
- Negatives are written with the sign attached: `-5`.
- A decimal is rounded to the nearest integer, and on an exact tie to the even
  one: `1.5` and `2.5` are both 2.

```adn
cond
start
  ' stack: 5   then: 5 1   store writes 5 to cell 1 (.up)
  5 .up store
stop
```

This bot pushes forward with 5 every cycle. Each number costs
[[param:cost:0]], which under the F1 rules is 0. More in
[[adn/numeros#literales]].
