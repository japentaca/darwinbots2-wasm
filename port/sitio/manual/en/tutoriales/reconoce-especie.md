---
titulo: A bot that recognizes its own species
resumen: "The DNA signature and a public password, step by step, so your bot saves its shots for strangers."
etiquetas: [species, recognition, signature, password, shots]
estado: revisada
---
In [[tutoriales/busca-comida]] your bot learned to move toward food, and in
[[tutoriales/dispara]], to take it from another bot by shooting. This tutorial
adds the missing piece for many copies of the same bot to live together: knowing
who you're facing, and saving your shots for strangers.

## The shot doesn't choose {#problema}

<!-- 33-SHOTS §0.2-0.3 (el disparo le pega a cualquiera; inmunidad filial corregida en el port: port/README B3-1, solo del padre y age <= 1); sysvars .totalmyspecies (el ADN no lee el nombre de la especie) -->
The shot doesn't tell species apart: it hits any bot that crosses its path. A bot
never hits itself with its own shot, and a newborn is protected from its
parent's shots during its first cycles; from nobody else's. The DNA can't read
the species name either: for the engine it's a name that gets inherited (see
[[simulacion/especies]]), and no sysvar brings it. The closest thing is
[[.totalmyspecies]], which counts how many living bots carry your name: it's
useful for knowing how many are left, not who you're facing.

Seed four copies of this unfiltered hunter (the one from the previous tutorial,
cut down to the essentials) in a small world with no vegetables:

```adn
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
start
 -1 .shoot store
stop
```

<!-- probado: cazador.txt, --qty 4, campo 600x600, 60 ciclos, semilla 1: al 20 faltaba uno y al 30, otro; un superviviente cerró con kills=2 mientras el otro caía de 3000 a 2441 y el primero subía a 9175 -->
In the run, by cycle 20 one was already missing, and by 30, another. One of the
survivors closed with two deaths of its own siblings in [[.kills]]; the other was
being bled slowly (from 3000 down to 2441 energy, while the first went up to
9175). With no vegetables to repopulate, a species like this eats itself. (This
same pitfall, with its fix, is in [[adn/errores#especie]].)

## The two signals {#senales}

<!-- 32-VISION §2.6, §4 (lookoccurr desde la vista y desde los choques); sysvars/ref; sysvars/my (lo que ven los demás sale de la cuenta del motor, no de la celda); core senses.hpp makeoccurrlist (cuenta el texto del ADN, no lo que se ejecuta) -->
Everything a bot knows about the one in front of it arrives through sight (and
through collisions), and none of those things is a name. When the focus eye sees
something, the [[sysvars/ref|ref*]] cells describe it: where it is, how it
moves, how much energy and body it has ([[simulacion/vision#foco]]). Among that
data comes a _signature_ of its DNA: the same counters you have in
[[sysvars/my|the my* ones]], but for the other bot.

The signature doesn't come from what the other bot does, but from the text of its
DNA. [[.refeye]], for example, says how many times its DNA reads its eyes;
[[.refshoot]], how many times it commands a shot; [[.refup]], how many times it
pushes. Since the text is what's counted, it counts even if that code never runs,
and it can't be faked: writing your own `my*` by hand doesn't change what others
see. Two bots with the same DNA have exactly the same signature. The most widely
used comparison (it comes from Numsgil's _Animal Minimalis_, and hundreds of
Bestiary bots carry it) is [[.refeye]] against your [[.myeye]].
<!-- Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (*.refeye *.myeye != antes de -1 .shoot); 340 de los 684 bots de port/web/bots mencionan refeye y myeye -->

The other signal works the other way around: you don't deduce it from the other
bot, it publishes it. You write a number into [[.out1]] and it stays there: the
engine never clears it. Any bot that has you in its focus eye receives it in its
[[.in1]], with the one-cycle delay that all senses have. It's a public channel:
the 555 of _Artemis Minimalis_, from the Bestiary, is the classic example.
<!-- 21-MEMORIA §2 (800-819: out1-10 / in1-10), §3 (in*: se borran en «se borran los sentidos»); Bestiario: Artemis_Minimalis.txt (555 .out1 store mientras *.robage 5 <; dispara con *.in1 *.out1 !=) -->

| Signal | Strength | Weakness |
|---|---|---|
| The signature (`ref*` against `my*`) | It can't be copied | Two different DNAs can count the same |
| The password (`in1` against `out1`) | It doesn't match by chance | Anyone who sees you reads it |

We'll go through both, in order, because each one covers the other's gap.

## Step 1: the signature {#firma}

The hunter reads `*.eye5` twice, so its [[.myeye]] is 2: that's its signature.
Add the comparison to the gene that shoots:

```adn
' Shoot only if the other's signature doesn't match mine
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 -1 .shoot store
stop
```

What you should see:

1. **Against a clone** (the same species, two copies), not a single shot. In the
   run they ended up stuck face to face (the front eye read over 20000) with
   `*.refeye` and `*.myeye` at 2, and energy untouched at 3000 for 40 cycles.
   <!-- probado: firmado.txt, --qty 2, campo 600x600, 40 ciclos, semilla 1: eye5 20736, refeye=2=myeye, nrg 3000 en ambos -->
2. **Against a stranger** that reads its eyes only once, the signature doesn't
   match (1 against 2) and the hunter acts as usual: it turned until it saw it,
   stole energy from it until it died before cycle 25, and closed at 6160, up
   from the initial 3000.
   <!-- probado: firmado.txt contra distinto.txt (myeye 1), campo 600x600, 40 ciclos, semilla 2: muerto entre el 20 y el 25; firmado en 6159.89 -->

## Step 2: the traps of the signature {#trampas}

The signature is an approximation, and it has three pitfalls:

- **Corpses** arrive with the whole signature at 0: they look like a mute
  stranger. You can tell them apart because their [[.refnrg]] is also 0, while
  their [[.refbody]] is the real one (see [[simulacion/muerte]]).
  <!-- 32-VISION §2 notas (corpse: occurr borrado, refnrg/refbody reales) -->
- **The shapes** in the world, when they're visible, also leave the signature at
  0; [[.reftype]] at 1 is what warns you that what you're seeing is a shape.
  <!-- sysvars.yaml .reftype; 32-VISION §3 -->
- **Coincidences**: two different DNAs can count the same. The pitfall can be
  built on purpose: a peaceful bot that, without ever shooting, also reads its
  eyes twice. The signature said “it's one of mine” and in 40 cycles not a single
  shot went out.
  <!-- probado: firmado.txt contra gemelo.txt (myeye 2, myshoot 0), campo 600x600, 40 ciclos, semilla 2: 0 disparos, nrg 3000 en ambos -->

The fix is to compare more than one figure and shoot if _any_ of them doesn't
match, with [[op:or]] in the condition section:

```adn
' Shoot if any figure of the signature doesn't match
cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

cond
 *.eye5 0 >
 *.refeye *.myeye !=
 *.refshoot *.myshoot != or
start
 -1 .shoot store
stop
```

The false sibling above writes `.shoot` zero times, so its [[.refshoot]] (0) no
longer matches your [[.myshoot]] (1): in the run it ended up dead before cycle
25, with the hunter closing at 6160.
<!-- probado: firmado2.txt contra gemelo.txt, campo 600x600, 40 ciclos, semilla 2: gemelo muerto entre el 20 y el 25; firmado2 en 6159.89 -->

You can add a third figure ([[.refup]], [[.reftie]]…): each independent one makes
a chance match harder.

## Step 3: the password {#contrasena}

Each bot publishes the password on its own. It's enough to publish it once: since
`.out1` is never cleared and starts at 0, “while it's 0” means “the first time”.
Afterwards, before shooting, you compare `*.in1` with your own `*.out1`.

```adn
' Publish the species code, just once
cond
 *.out1 0 =
start
 555 .out1 store
stop

cond
 *.eye5 0 =
start
 314 rnd .aimdx store
stop

' Shoot whoever doesn't publish my code
cond
 *.eye5 0 >
 *.in1 *.out1 !=
start
 -1 .shoot store
stop
```

Two cautions. First, `*.in1` is 0 both when you're not seeing anyone and when the
other bot publishes nothing: the `*.eye5 0 >` is what warns you that someone is
in front of you. Second, pick a code other than 0, which is what any bot that
doesn't use the channel “publishes”.

What you should see:

1. **Against a stranger that publishes nothing**, the password works like one
   more signature: in the run it hunted it down just as before and closed at
   6152.
   <!-- probado: clave.txt contra distinto.txt (no publica), campo 600x600, 40 ciclos, semilla 4: muerto entre el 30 y el 35; clave en 6152.46 -->
2. **Against a spy**, the password shows its price: a bot that just copies into
   its `.out1` what it reads in `*.in1` publishes your code as soon as it sees
   you. In the run, the spy was already announcing 555 at cycle 5.
   <!-- probado: hermano.txt (publica 555) contra copion.txt (copia *.in1 a .out1), campo 600x600, 30 ciclos, semilla 3: copion con out1=555 en el ciclo 5 -->
3. **And the consequence**: against an intruder that publishes your code, a bot
   that only looks at passwords doesn't shoot. The intruder spent 40 cycles in
   plain sight, with its energy untouched.
   <!-- probado: clave.txt contra intruso.txt (publica 555, firma 1), campo 600x600, 40 ciclos, semilla 2: 0 disparos, nrg 3000 en ambos -->

It's a public channel: it's good for picking out your own, not for keeping a
secret.

## Step 4: the complete bot {#final}

Combined, each signal covers the other's gap. But note _how_: you have to shoot
if _any_ of them doesn't match, with [[op:or]]. If you required both to fail,
each trap would stay open: the signature would save the false sibling, and the
password would save the intruder with the stolen code.

| In front | Signature | Password | Shoots |
|---|---|---|---|
| A clone | matches | matches | no |
| A stranger that counts the same | matches | doesn't | yes |
| An intruder with the stolen code | doesn't | matches | yes |

The complete bot (the skeleton is that of _Animal Minimalis_, plus the password)
ends up like this:

```adn
' Publish the species code, just once
cond
 *.out1 0 =
start
 555 .out1 store
stop

' Something ahead that isn't one of mine: chase it, copying its velocity
cond
 *.eye5 0 >
 *.refeye *.myeye !=
start
 *.refveldx .dx store
 *.refvelup 30 add .up store
stop

' Stranger nearby: signature or password that don't match
cond
 *.eye5 50 >
 *.refeye *.myeye !=
 *.refshoot *.myshoot != or
 *.in1 *.out1 != or
start
 -1 .shoot store
stop

' Nothing ahead, or one of mine: turn, looking around
cond
 *.eye5 0 =
 *.refeye *.myeye = or
start
 314 rnd .aimdx store
stop

' Reproduce when there's energy to spare (10 percent for the child)
cond
 *.nrg 20000 >
start
 10 .repro store
stop
```

Each gene does one thing: publish the code, chase strangers by copying their
velocity, shoot them when they're close, turn when there's nothing (or what's
there is a sibling), and divide when there's energy to spare. The child is born
with the same DNA, that is, with the same signature, and publishes its 555 in its
first cycle; meanwhile, its parent's shots don't hit it.
<!-- port/README B3-1; 36-REPRO (el hijo no hereda la memoria: publica él mismo); Bestiario: Animal_Minimalis_4G_Numsgil_-10.03.05.txt (mismos genes de persecución y giro) -->

What you should see:

1. **Against its clones**, not a single shot. In the run, two copies each turned
   its own way; at cycle 35 one had the other straight ahead (`*.refeye` at 3,
   `*.in1` at 555) and went on its way, with its energy untouched.
   <!-- probado: final.txt, --qty 2, campo 600x600, 40 ciclos, semilla 3: en el ciclo 35, refeye=3=myeye e in1=555=out1; 0 disparos, nrg 3000 -->
2. **Against the intruder with the stolen password**, the signature gave it away:
   it chased it, kept taking its energy and left it dead before cycle 35, with
   the final bot closing at 5958 from the initial 3000.
   <!-- probado: final.txt contra intruso.txt (publica 555, firma 1), campo 600x600, 40 ciclos, semilla 2: intruso muerto entre el 30 y el 35; final en 5957.88 -->
3. **Against a stranger that counts the same** (three eye reads and one shot, like
   yours, but without publishing a code), the password gave it away: as soon as
   it saw it, it started shooting at it, and in 60 cycles it brought it down from
   3000 to 2244 energy.
   <!-- probado: final.txt contra gemelo3.txt (myeye 3, myshoot 1, sin out1), campo 600x600, 60 ciclos, semilla 2: primer avistamiento en el 15, primer daño hacia el 30; gemelo3 en 2244.04 al 60 -->

The whole block passes the lint with no warnings. Change the 555 to a number of
your own (anything but 0) and it should keep working just the same.

## What to try next {#despues}

**The complete spy.** The two signals together can still be fooled: a bot that
copies your password and also, by chance or by design, counts the same as you
fools the complete bot. Getting that by luck is hard; the more independent
signals you compare, the harder the deception.

**Relatives that mutated.** With mutations turned on
([[simulacion/mutaciones]]), every mutation redoes the bot's signature: a
descendant can end up with a different count and start receiving friendly fire
from its relatives. A mutation can also hit the 555 or the gene that publishes
it. Both signals drift with evolution; see
[[simulacion/especies#mutaciones]].
<!-- 40-MUTACIONES; port/README B6-9 (la firma se recalcula al mutar); sysvars/my #cuando -->

**Without seeing: through ties.** A bot tied to another recognizes it with
[[.trefeye]] instead of `refeye`, and compared with [[op:%=]] it allows up to a
10% difference, useful if you expect relatives that mutated a little. To learn
how to build ties, see [[tutoriales/multibot]].

**Hidden passwords.** With [[.memloc]] you can spy on any cell of the bot you see
and keep your code in a private variable, instead of publishing it in `out1` (see
[[simulacion/vision#espionaje]]). Spoiler: a spy with `.memloc` finds it too:
vision in DarwinBots has no secrets.
