// @ts-check
// Estado compartido del inspector con la pantalla que lo monta (Observar).
// Cuando el bot con foco muere, la sesión suelta el foco (sesion.foco = 0),
// pero el inspector tiene que seguir a la vista para decir «El bot murió» y
// ofrecer cerrar. Observar lo monta mientras `inspectorVisible(sesion)`.

export const estadoInspector = $state({ murio: false });

/**
 * El panel del inspector tiene que estar a la vista.
 * @param {{ foco: number }} sesion
 */
export function inspectorVisible(sesion) {
  return sesion.foco > 0 || estadoInspector.murio;
}
