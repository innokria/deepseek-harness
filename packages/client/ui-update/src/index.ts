/**
 * Desktop auto-update footer action, node half. Pure UI plugin: the empty
 * apply exists so the plugin appears in the host cordis.yml / Loader; the
 * browser half ships via exports["./client"], discovered through the
 * package.json dshClient declaration. Update state lives entirely in the
 * Electron main process and reaches the renderer through the preload bridge,
 * so there is no host-side Cordis surface.
 */

/** Host plugin body — no host-side behavior for this source plugin. */
export function apply(): void {}
