---
titulo: .eye2dir
resumen: "Turns eye 2 relative to its factory position (30 degrees to the left): positive toward the left, negative toward the right; 1256 is a full turn."
etiquetas: [eyes, vision, configuration]
estado: revisada
---
Shifts the direction of [[.eye2]], which in the factory configuration looks 30 degrees to the left of [[.aim]].
It is measured in the same units as `.aim`: a full turn is 1256, a half
turn 628 and 10 degrees about 35. Positive values move the eye to the
left and negative ones to the right. The eye stays attached to the bot: if the bot
turns, the eye turns with it.
<!-- 32-VISION §0.2; sysvars.yaml .eye2dir -->

It is configuration: the engine reads it every cycle but never clears it, so
writing it once is enough. Only the remainder of dividing by 1256 counts, with
its sign: 1256 is equivalent to 0 and 1300 to 44. The change shows in what the eye sees
from the next cycle on.
<!-- sysvars.yaml .eye2dir (persiste); 32-VISION §0.1 -->

The bot _All Eyes_ by Spike43884 (in the Bestiary) opens all nine eyes in a fan to see almost everything around it; it sets this eye to 300, so it ends up looking about 116 degrees to the left:

```adn
cond
*.robage 0 =
start
300 .eye2dir store
stop
```

To change how much the eye covers, use [[.eye2width]]. The other eyes and
how they are laid out are covered in [[sysvars/ojos]].
