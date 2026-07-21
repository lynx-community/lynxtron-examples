// Mirrors @blueprintjs/core enums we actually use. Values kept string-compatible with BP3.

export const Intent = {
  NONE: 'none',
  PRIMARY: 'primary',
  SUCCESS: 'success',
  WARNING: 'warning',
  DANGER: 'danger',
} as const;
export type Intent = typeof Intent[keyof typeof Intent];

export const Classes = {
  DARK: 'bp3-dark',
  BUTTON: 'bp3-button',
  MINIMAL: 'bp3-minimal',
  INTENT_PRIMARY: 'bp3-intent-primary',
  INTENT_SUCCESS: 'bp3-intent-success',
  INTENT_WARNING: 'bp3-intent-warning',
  INTENT_DANGER: 'bp3-intent-danger',
  ACTIVE: 'bp3-active',
  ICON: 'bp3-icon',
  INPUT: 'bp3-input',
  INPUT_GROUP: 'bp3-input-group',
  CONTROL_GROUP: 'bp3-control-group',
  BUTTON_GROUP: 'bp3-button-group',
  FILL: 'bp3-fill',
  DIALOG: 'bp3-dialog',
  DIALOG_HEADER: 'bp3-dialog-header',
  DIALOG_BODY: 'bp3-dialog-body',
  DIALOG_FOOTER: 'bp3-dialog-footer',
} as const;
export type Classes = typeof Classes[keyof typeof Classes];
